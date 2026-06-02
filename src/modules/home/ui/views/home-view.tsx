"use client"

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useRouter } from "next/navigation"; // 1. 引入 Next.js 路由
import { useEffect } from "react";

export const HomeView = () => {
    const router = useRouter();

    // 2. 从 Hook 中同时解构出 session 数据和真实的加载状态 isPending
    const { data: session, isPending } = authClient.useSession();

    // 3. 拦截：如果加载已经结束，但发现根本没有登录态，主动将其踢回登录页
    useEffect(() => {
        if (!isPending && !session) {
            router.push("/sign-in"); // 换成你实际的登录页路由，比如 /sign-in
        }
    }, [session, isPending, router]);

    // 4. 只有在【真正加载中】时，才显示 Loading...
    if (isPending) {
        return (
            <p>Loading...</p>
        )
    }

    // 5. 如果由于路由重定向存在微小延迟导致 session 临时为空，直接返回 null 挡住，防止后续报错
    if (!session) {
        return null;
    }

    return (
        <div className="flex flex-col p-4 gap-y-4">
            <p>Logged in as {session.user.name}</p>
            {/* 6. 在 signOut 的第二个参数中，注入 onSuccess 回调函数 */}
            <Button onClick={async () => {
                await authClient.signOut({
                    onSuccess: () => {
                        router.push("/sign-in"); // 登出成功，利索地重定向
                    }
                });
            }}>Sign Out</Button>
        </div>
    )
}