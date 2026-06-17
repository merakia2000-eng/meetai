// src/modules/dashboard/ui/components/dashboard-command.tsx

import {
    Command, // 确保导入了 Command
    CommandResponsiveDialog,
    CommandDialog,
    CommandInput,
    CommandList, // 建议加上 List 包装
    CommandEmpty
} from "@/components/ui/command";

interface Props {
    open: boolean;
    setOpen: (open: boolean) => void;
}

export const DashboardCommand = ({ open, setOpen }: Props) => {
    return (
        <CommandResponsiveDialog open={open} onOpenChange={setOpen}>
            {/* 重点：有些版本的 shadcn 需要在 Dialog 内部显式写一个 Command 标签 */}
            <Command>
                <CommandInput placeholder="Type a command or search..." />
                <CommandList>
                    <CommandEmpty>No results found.</CommandEmpty>
                </CommandList>
            </Command>
        </CommandResponsiveDialog>
    )
}