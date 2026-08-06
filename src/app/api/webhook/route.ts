import OpenAI from "openai";
import { createHash } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { and, eq, not } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { ChatCompletionMessageParam } from "openai/resources/index.mjs";

import { db } from "@/db";
import { agents, meetings } from "@/db/schema";
import { streamVideo } from "@/lib/stream-video";
import { inngest } from "@/inngest/client";
import { generateAvatarUri } from "@/lib/avatar";
import { streamChat } from "@/lib/stream-chat";

const openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY! });

const AI_CONNECTION_TRIGGER_EVENTS = new Set([
    "call.session_started",
    "call.session_participant_joined",
    "call.recording_started",
    "call.transcription_started",
]);

const connectedAiMeetings = new Set<string>();

type StreamWebhookPayload = Record<string, unknown> & {
    type?: string;
    call?: {
        custom?: {
            meetingId?: string;
        };
    };
    call_cid?: string;
    channel_id?: string;
    user?: {
        id?: string;
    };
    message?: {
        text?: string;
    };
    call_transcription?: {
        url?: string;
    };
    call_recording?: {
        url?: string;
    };
};

function verifySignatureWithSDK(body: string | Buffer, signature: string): boolean {
    return streamVideo.verifyWebhook(body, signature);
}

function fingerprint(value?: string): string {
    if (!value) return "missing";

    return createHash("sha256")
        .update(value)
        .digest("hex")
        .slice(0, 10);
}

function getMeetingId(payload: StreamWebhookPayload): string | undefined {
    return payload.call?.custom?.meetingId ?? payload.call_cid?.split(":")[1];
}

function decodeWebhookBody(rawBody: Buffer, contentEncoding?: string | null) {
    const isGzip =
        contentEncoding?.toLowerCase().includes("gzip") ||
        (rawBody[0] === 0x1f && rawBody[1] === 0x8b);

    return isGzip ? gunzipSync(rawBody).toString("utf8") : rawBody.toString("utf8");
}

function serializeError(error: unknown) {
    if (error instanceof Error) {
        return {
            name: error.name,
            message: error.message,
            stack: error.stack,
        };
    }

    return error;
}

async function connectAiToMeeting(meetingId: string, eventType: string) {
    if (connectedAiMeetings.has(meetingId)) {
        console.log("[webhook] AI connection already attempted", {
            eventType,
            meetingId,
        });
        return;
    }

    const [existingMeeting] = await db
        .select()
        .from(meetings)
        .where(
            and(
                eq(meetings.id, meetingId),
                not(eq(meetings.status, "completed")),
                not(eq(meetings.status, "cancelled")),
                not(eq(meetings.status, "processing")),
            ),
        );

    if (!existingMeeting) {
        console.error("[webhook] meeting not available for AI connection", {
            eventType,
            meetingId,
        });
        return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (existingMeeting.status !== "active") {
        await db
            .update(meetings)
            .set({
                status: "active",
                startedAt: existingMeeting.startedAt ?? new Date(),
            })
            .where(eq(meetings.id, existingMeeting.id));
    }

    const [existingAgent] = await db
        .select()
        .from(agents)
        .where(eq(agents.id, existingMeeting.agentId));

    if (!existingAgent) {
        console.error("[webhook] agent not found for AI connection", {
            eventType,
            meetingId,
            agentId: existingMeeting.agentId,
        });
        return NextResponse.json({ error: "Agent not found" }, { status: 404 });
    }

    const call = streamVideo.video.call("default", meetingId);

    try {
        console.log("[webhook] connecting AI", {
            eventType,
            meetingId,
            agentUserId: existingAgent.id,
        });

        connectedAiMeetings.add(meetingId);

        const realtimeClient = await streamVideo.video.connectOpenAi({
            call,
            openAiApiKey: process.env.OPENAI_API_KEY!,
            agentUserId: existingAgent.id,
            model: "gpt-4o-realtime-preview",
        });

        realtimeClient.updateSession({
            instructions: existingAgent.instructions,
        });

        console.log("[webhook] AI connected", {
            eventType,
            meetingId,
            agentUserId: existingAgent.id,
        });
    } catch (error) {
        connectedAiMeetings.delete(meetingId);

        console.error("[webhook] connectOpenAi failed", {
            eventType,
            meetingId,
            agentUserId: existingAgent.id,
            error: serializeError(error),
        });

        return NextResponse.json(
            { error: "Failed to connect AI" },
            { status: 500 },
        );
    }
}

export async function POST(req: NextRequest) {
    const signature = req.headers.get("x-signature");
    const apiKey = req.headers.get("x-api-key");

    if (!signature || !apiKey) {
        return NextResponse.json(
            { error: "Missing signature or API key" },
            { status: 400 },
        );
    }

    if (apiKey !== process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY) {
        console.error("[webhook] invalid API key", {
            apiKeyFingerprint: fingerprint(apiKey),
            configuredApiKeyFingerprint: fingerprint(
                process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY,
            ),
        });
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const rawBody = Buffer.from(await req.arrayBuffer());
    const body = decodeWebhookBody(rawBody, req.headers.get("content-encoding"));

    let payload: StreamWebhookPayload;
    try {
        payload = JSON.parse(body) as StreamWebhookPayload;
    } catch {
        console.error("[webhook] invalid JSON", {
            bodyLen: body.length,
            rawBodyLen: rawBody.length,
            contentType: req.headers.get("content-type"),
            contentEncoding: req.headers.get("content-encoding"),
            userAgent: req.headers.get("user-agent"),
            bodyPreview: body.slice(0, 120),
        });

        return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const eventType = payload.type;

    console.log("[webhook] received", {
        eventType,
        bodyLen: body.length,
        rawBodyLen: rawBody.length,
        signatureLen: signature.length,
        apiKeyMatches:
            apiKey === process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY,
        apiKeyFingerprint: fingerprint(apiKey),
        configuredApiKeyFingerprint: fingerprint(
            process.env.NEXT_PUBLIC_STREAM_VIDEO_API_KEY,
        ),
        configuredSecretFingerprint: fingerprint(
            process.env.STREAM_VIDEO_SECRET_KEY,
        ),
    });

    let verified =
        verifySignatureWithSDK(rawBody, signature) ||
        verifySignatureWithSDK(body, signature);
    if (!verified) {
        console.warn("[webhook] first signature verification failed; retrying", {
            bodyLen: body.length,
            rawBodyLen: rawBody.length,
            sigLen: signature.length,
            secretLen: process.env.STREAM_VIDEO_SECRET_KEY?.length,
        });
        await new Promise((resolve) => setTimeout(resolve, 500));
        verified =
            verifySignatureWithSDK(rawBody, signature) ||
            verifySignatureWithSDK(body, signature);
    }

    if (!verified) {
        console.error("[webhook] signature verification failed", {
            bodyLen: body.length,
            rawBodyLen: rawBody.length,
            sigLen: signature.length,
            secretLen: process.env.STREAM_VIDEO_SECRET_KEY?.length,
            eventType,
        });
        return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
    }

    console.log("[webhook] signature verified", { eventType });

    if (eventType && AI_CONNECTION_TRIGGER_EVENTS.has(eventType)) {
        const meetingId = getMeetingId(payload);

        console.log("[webhook] AI trigger event", {
            eventType,
            meetingId,
        });

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const response = await connectAiToMeeting(meetingId, eventType);
        if (response) return response;
    } else if (eventType === "call.session_participant_left") {
        const meetingId = getMeetingId(payload);
        const userId = payload.user?.id;

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(eq(meetings.id, meetingId));

        if (
            userId &&
            (userId === existingMeeting?.agentId ||
                userId.startsWith("recording-egress-"))
        ) {
            console.log("[webhook] ignoring non-host participant left", {
                eventType,
                meetingId,
                userId,
            });
            return NextResponse.json({ status: "ok" });
        }

        const call = streamVideo.video.call("default", meetingId);
        await call.end();
    } else if (eventType === "call.session_ended") {
        const meetingId = getMeetingId(payload);

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        await db
            .update(meetings)
            .set({
                status: "processing",
                endedAt: new Date(),
            })
            .where(and(eq(meetings.id, meetingId), eq(meetings.status, "active")));
    } else if (eventType === "call.transcription_ready") {
        const meetingId = getMeetingId(payload);

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        const [updatedMeeting] = await db
            .update(meetings)
            .set({
                transcriptUrl: payload.call_transcription?.url,
            })
            .where(eq(meetings.id, meetingId))
            .returning();

        if (!updatedMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        await inngest.send({
            name: "meetings/processing",
            data: {
                meetingId: updatedMeeting.id,
                transcriptUrl: updatedMeeting.transcriptUrl,
            },
        });
    } else if (eventType === "call.recording_ready") {
        const meetingId = getMeetingId(payload);

        if (!meetingId) {
            return NextResponse.json({ error: "Missing meetingId" }, { status: 400 });
        }

        await db
            .update(meetings)
            .set({
                recordingUrl: payload.call_recording?.url,
            })
            .where(eq(meetings.id, meetingId));
    } else if (eventType === "message.new") {
        const userId = payload.user?.id;
        const channelId = payload.channel_id;
        const text = payload.message?.text;

        if (!userId || !channelId || !text) {
            return NextResponse.json(
                { error: "Missing required fields" },
                { status: 400 },
            );
        }

        const [existingMeeting] = await db
            .select()
            .from(meetings)
            .where(and(eq(meetings.id, channelId), eq(meetings.status, "completed")));

        if (!existingMeeting) {
            return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
        }

        const [existingAgent] = await db
            .select()
            .from(agents)
            .where(eq(agents.id, existingMeeting.agentId));

        if (!existingAgent) {
            return NextResponse.json({ error: "Agent not found" }, { status: 404 });
        }

        if (userId !== existingAgent.id) {
            const instructions = `
      You are an AI assistant helping the user revisit a recently completed meeting.
      Below is a summary of the meeting, generated from the transcript:

      ${existingMeeting.summary}

      The following are your original instructions from the live meeting assistant. Please continue to follow these behavioral guidelines as you assist the user:

      ${existingAgent.instructions}

      The user may ask questions about the meeting, request clarifications, or ask for follow-up actions.
      Always base your responses on the meeting summary above.

      You also have access to the recent conversation history between you and the user. Use the context of previous messages to provide relevant, coherent, and helpful responses. If the user's question refers to something discussed earlier, make sure to take that into account and maintain continuity in the conversation.

      If the summary does not contain enough information to answer a question, politely let the user know.

      Be concise, helpful, and focus on providing accurate information from the meeting and the ongoing conversation.
      `;

            const channel = streamChat.channel("messaging", channelId);
            await channel.watch();

            const previousMessages = channel.state.messages
                .slice(-5)
                .filter((message) => message.text && message.text.trim() !== "")
                .map<ChatCompletionMessageParam>((message) => ({
                    role: message.user?.id === existingAgent.id ? "assistant" : "user",
                    content: message.text || "",
                }));

            const GPTResponse = await openaiClient.chat.completions.create({
                messages: [
                    { role: "system", content: instructions },
                    ...previousMessages,
                    { role: "user", content: text },
                ],
                model: "gpt-4o",
            });

            const GPTResponseText = GPTResponse.choices[0].message.content;

            if (!GPTResponseText) {
                return NextResponse.json(
                    { error: "No response from GPT" },
                    { status: 400 },
                );
            }

            const avatarUrl = generateAvatarUri({
                seed: existingAgent.name,
                variant: "botttsNeutral",
            });

            streamChat.upsertUser({
                id: existingAgent.id,
                name: existingAgent.name,
                image: avatarUrl,
            });

            channel.sendMessage({
                text: GPTResponseText,
                user: {
                    id: existingAgent.id,
                    name: existingAgent.name,
                    image: avatarUrl,
                },
            });
        }
    }

    return NextResponse.json({ status: "ok" });
}
