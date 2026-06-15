"use client"

import { Button } from "@/components/ui/button";
import { authClient } from "@/lib/auth-client";
import { useTRPC } from "@/trpc/client";
import { useQuery } from "@tanstack/react-query";

import { useRouter } from "next/navigation"; // 1. 引入 Next.js 路由
import { useEffect } from "react";

export const HomeView = () => {

    const trpc = useTRPC();
    const { data } = useQuery(trpc.hello.queryOptions({ text: "Merakia" }));

    return (
        <div className="flex flex-col p-4 gap-y-4">
            {data?.greeting}
        </div>
    )
}