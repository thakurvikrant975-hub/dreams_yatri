"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Zap } from "lucide-react";
import { Switch } from "../../components/ui/switch";
import { setAutoAssignSetting } from "./actions";

export function AutoAssignToggle({ initialEnabled }: { initialEnabled: boolean }) {
    const [enabled, setEnabled] = useState(initialEnabled);
    const [isPending, startTransition] = useTransition();

    function handleToggle(next: boolean) {
        setEnabled(next); // optimistic
        startTransition(async () => {
            const result = await setAutoAssignSetting(next);
            if (result.success) {
                toast.success(result.message);
            } else {
                setEnabled(!next); // revert on failure
                toast.error(result.message);
            }
        });
    }

    return (
        <div className="flex items-center gap-2.5 rounded-lg border border-dashboard-base-300 bg-dashboard-base-100 px-3 py-1.5">
            <Zap className={`h-3.5 w-3.5 ${enabled ? "text-dashboard-success" : "text-dashboard-base-content/40"}`} />
            <div className="leading-tight">
                <p className="text-xs font-medium text-dashboard-base-content">Auto-Assign</p>
                <p className="text-[10px] text-dashboard-base-content/50">
                    {enabled ? "New leads auto-assigned" : "Assign leads manually"}
                </p>
            </div>
            <Switch checked={enabled} onCheckedChange={handleToggle} disabled={isPending} />
        </div>
    );
}
