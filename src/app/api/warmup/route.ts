import { NextResponse } from "next/server";

/**
 * 预热端点：被 Vercel Cron 每分钟 ping 一次，保持 webhook 函数实例暖着。
 *
 * 为什么需要：Vercel Serverless 函数空闲一段时间会被冻结，下次请求触发冷启动。
 * 冷启动期间 env/body 可能未就绪，导致 call.session_started 验签失败（401），
 * 而 Stream 不重试 session_started，智能体就进不来会议。
 * 每分钟 ping 保持实例常驻，从根本上消除冷启动。
 */
export async function GET() {
    return NextResponse.json({ ok: true, ts: Date.now() });
}
