import {
    MessageNewEvent,
    CallEndedEvent,
    CallTranscriptionReadyEvent,
    CallRecordingReadyEvent,
    CallSessionParticipantLeftEvent,
    CallSessionStartedEvent,
} from "@stream-io/node-sdk";

import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { headers } from "next/headers";
import zlib from "zlib";

function verifySignatureWithSDK(body: string, signature: string): boolean {
    return streamVideo.verifyWebhook(body, signature);
};

export async function POST(req: NextRequest) {

    const arrayBuffer = await req.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawBody = buffer.toString("utf-8");

    const signature = req.headers.get("x-signature");
    const apiKey = req.headers.get("x-api-key");

    if (!signature || !apiKey) {
        return NextResponse.json(
            { error: "Missing signature or API key" },
            { status: 400 }
        );
    }


    if (!verifySignatureWithSDK(rawBody, signature)) {
        console.log("❌ 签名校验没过！");
        // return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    let payload: any;
    try {
        const encoding = req.headers.get("content-encoding");

        if (encoding === "gzip" || (buffer[0] === 0x1f && buffer[1] === 0x8b)) {
            console.log("📦 发现压缩包，正在解压...");
            const decompressed = zlib.gunzipSync(buffer);
            payload = JSON.parse(decompressed.toString());
        } else {
            payload = JSON.parse(buffer.toString());
        }
        console.log("✅ 解析成功，类型:", payload.type);
    } catch (err: any) {
        console.error("🔥 解析大失败:", err.message);
        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = (payload as Record<string, unknown>)?.type;

    if (eventType === "call.session_started") {

        const event = payload as CallSessionStartedEvent;
        const meetingId = event.call.custom?.meetingId;

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }
        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(
                and(
                    eq(meetings.id, meetingId),
                    not(eq(meetings.status, "completed")),
                    not(eq(meetings.status, "active")),
                    not(eq(meetings.status, "cancelled")),
                    not(eq(meetings.status, "processing")),
                )
            );

        if (!existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        await db
            .update(meetings)
            .set({
                status: "active",
                startedAt: new Date(),
            })
            .where(eq(meetings.id, existingMeeting.id));


        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentId));

        if (!existingAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }


        let realtimeClient;
        try {


            const call = streamVideo.video.call("default", meetingId);


            realtimeClient = await streamVideo.video.connectOpenAi({
                call,
                openAiApiKey: process.env.OPENAI_API_KEY!,
                agentUserId: existingAgent.id,

            });
            realtimeClient.updateSession({
                instructions: existingAgent.instructions,
            });

        } catch (error: any) {
            // 捕获并打印详细的上游错误
            console.error("❌ AI Agent 连接 OpenAI 失败详情:", error?.response?.data || error);
        }


    } else if (eventType === "call.session_participant_left") {
        const event = payload as CallSessionParticipantLeftEvent;
        const meetingId = event.call_cid.split(":")[1];
    }

    return NextResponse.json({ status: "ok" });
}