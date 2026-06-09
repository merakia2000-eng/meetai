"use client";

import { Separator } from "@/components/ui/separator";
import {
    Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarHeader, SidebarMenuItem, SidebarMenu, SidebarMenuButton
} from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";
import { BotIcon, SettingsIcon, StarIcon, VideoIcon } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { DashboardUserButton } from "./dashboard-user-button";
// import { DashboardTrial } from "./dashboard-trial";

const firstSection = [
    {
        icon: VideoIcon,
        label: "Meetings",
        href: "/meetings"
    },
    {
        icon: BotIcon,
        label: "Agents",
        href: "/agents"
    },
    {
        icon: SettingsIcon,
        label: "Settings",
        href: "/settings"
    }
]

const secondSection = [
    {
        icon: StarIcon,
        label: "Upgrade",
        href: "/upgrade"
    }
]

export const DashboardSidebar = () => {
    const pathname = usePathname();
    return (
        <Sidebar>
            <SidebarHeader className="text-sidebar-accent-foreground ">
                <Link href={"/"} className="flex items-center gap-2 px-2 pt-2">
                    <Image src={"/logo.svg"} height={36} width={36} alt="Meet.AI" />
                    <p className="text-2xl font-semibold">Meet.AI</p>
                </Link>
            </SidebarHeader>
            <div className="px-4 py-2">
                <Separator className="opacity-10 text-[#5D6B68]" />
            </div>
            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {firstSection.map((item) => {
                                const isActive = pathname === item.href;

                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            className={cn(
                                                // 1. 基础样式：重置背景，保持透明，并加上平滑过渡
                                                "h-10 bg-transparent border border-transparent transition-all duration-200",

                                                // 2. 未激活状态的 Hover 效果：
                                                // 只有在未激活时，Hover 才触发这套渐变，防止和激活状态冲突
                                                !isActive && "hover:bg-linear-to-r/oklch hover:from-sidebar-accent hover:from-5% hover:via-sidebar/50 hover:via-30% hover:to-sidebar/50 hover:border-[#5DD868]/10",

                                                // 3. 激活状态的固定效果：
                                                // 只有当前路径匹配时，才把完整的渐变色和边框挂载上去
                                                isActive && "bg-linear-to-r/oklch from-sidebar-accent from-5% via-sidebar/50 via-30% to-sidebar/50 border-[#5D6B68]/10"
                                            )}
                                        >
                                            <Link href={item.href}>
                                                <item.icon size={"6"} />
                                                <span className="text-sm font-medium tracking-tight">
                                                    {item.label}
                                                </span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
                <div className="px-4 py-1">
                    <Separator className="opacity-10 text-[#5D6B68]" />
                </div>
                <SidebarGroup>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {secondSection.map((item) => {
                                const isActive = pathname === item.href;

                                return (
                                    <SidebarMenuItem key={item.href}>
                                        <SidebarMenuButton
                                            asChild
                                            isActive={isActive}
                                            className={cn(
                                                // 1. 基础样式：重置背景，保持透明，并加上平滑过渡
                                                "h-10 bg-transparent border border-transparent transition-all duration-200",

                                                // 2. 未激活状态的 Hover 效果：
                                                // 只有在未激活时，Hover 才触发这套渐变，防止和激活状态冲突
                                                !isActive && "hover:bg-linear-to-r/oklch hover:from-sidebar-accent hover:from-5% hover:via-sidebar/50 hover:via-30% hover:to-sidebar/50 hover:border-[#5DD868]/10",

                                                // 3. 激活状态的固定效果：
                                                // 只有当前路径匹配时，才把完整的渐变色和边框挂载上去
                                                isActive && "bg-linear-to-r/oklch from-sidebar-accent from-5% via-sidebar/50 via-30% to-sidebar/50 border-[#5D6B68]/10"
                                            )}
                                        >
                                            <Link href={item.href}>
                                                <item.icon size={"6"} />
                                                <span className="text-sm font-medium tracking-tight">
                                                    {item.label}
                                                </span>
                                            </Link>
                                        </SidebarMenuButton>
                                    </SidebarMenuItem>
                                );
                            })}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
            <SidebarFooter className="text-white">
                {/* <DashboardTrial /> */}
                <DashboardUserButton />
            </SidebarFooter>
        </Sidebar>
    )
}