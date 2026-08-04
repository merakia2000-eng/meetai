import { db } from '@/db';
import { agents, meetings } from '@/db/schema';
import { auth } from '@/lib/auth';
import { polarClient } from '@/lib/polar';
import { MAX_FREE_AGENTS, MAX_FREE_MEETINGS } from '@/modules/premium/constants';
import { initTRPC, TRPCError } from '@trpc/server';
import { count, eq } from 'drizzle-orm';
import { headers } from 'next/headers';
import { cache } from 'react';
export const createTRPCContext = cache(async () => {
    // 1. 获取当前的请求头（包含用户的 Cookie）
    const heads = await headers();

    // 2. 调用 Better Auth 检查有没有 Session
    const session = await auth.api.getSession({
        headers: heads,
    });

    // 3. 返回真正的用户信息（如果没登录，session 就是 null）
    return {
        db,
        session,
        // 兼容你之前的逻辑，如果 session 存在就传真实 ID
        userId: session?.user.id ?? null
    };
});
// Avoid exporting the entire t-object
// since it's not very descriptive.
// For instance, the use of a t variable
// is common in i18n libraries.
const t = initTRPC.create({
    /**
     * @see https://trpc.io/docs/server/data-transformers
     */
    // transformer: superjson,
});
// Base router and procedure helpers
export const createTRPCRouter = t.router;
export const createCallerFactory = t.createCallerFactory;
export const baseProcedure = t.procedure;
export const protectedProcedure = baseProcedure.use(async ({ ctx, next }) => {
    const session = await auth.api.getSession({
        headers: await headers(),
    });

    if (!session) {
        throw new TRPCError({ code: "UNAUTHORIZED", message: "Unauthorized" });
    }

    return next({ ctx: { ...ctx, auth: session } });
});
export const premiumProcedure = (entity: "meetings" | "agents") =>
    protectedProcedure.use(async ({ ctx, next }) => {
        const customer = await polarClient.customers.getStateExternal({
            externalId: ctx.auth.user.id,
        });

        const [userMeetings] = await db
            .select({
                count: count(meetings.id),
            })
            .from(meetings)
            .where(eq(meetings.userId, ctx.auth.user.id));

        const [userAgents] = await db
            .select({
                count: count(agents.id),
            })
            .from(agents)
            .where(eq(agents.userId, ctx.auth.user.id));

        const isPremium = customer.activeSubscriptions.length > 0;
        const isFreeAgentLimitReached = userAgents.count >= MAX_FREE_AGENTS;
        const isFreeMeetingLimitReached = userMeetings.count >= MAX_FREE_MEETINGS;

        const shouldThrowMeetingError =
            entity === "meetings" && isFreeMeetingLimitReached && !isPremium;
        const shouldThrowAgentError =
            entity === "agents" && isFreeAgentLimitReached && !isPremium;

        if (shouldThrowMeetingError) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You have reached the maximum number of free meetings",
            });
        }

        if (shouldThrowAgentError) {
            throw new TRPCError({
                code: "FORBIDDEN",
                message: "You have reached the maximum number of free agents",
            });
        }

        return next({ ctx: { ...ctx, customer } });
    });