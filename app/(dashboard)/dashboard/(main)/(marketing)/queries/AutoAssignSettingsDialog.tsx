"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2, Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogTrigger,
} from "../../components/ui/dialog";
import { updateAutoAssignMemberSetting, type AutoAssignMemberSetting } from "./actions";

/** One row's local edit state — separate from the server-confirmed value so
 * a debounced number input can keep typing feel responsive without firing
 * a save on every keystroke. */  
function MemberRow({ member }: { member: AutoAssignMemberSetting }) {
    const [active, setActive] = useState(member.active);
    const [min, setMin] = useState(member.min?.toString() ?? "");
    const [max, setMax] = useState(member.max?.toString() ?? "");
    const [saving, setSaving] = useState(false);

    function parsed(v: string): number | null {
        const n = parseInt(v, 10);
        return v.trim() === "" || Number.isNaN(n) ? null : Math.max(0, n);
    }

    async function save(next: { active: boolean; min: string; max: string }) {
        setSaving(true);
        const result = await updateAutoAssignMemberSetting(member.id, {
            active: next.active,
            min: parsed(next.min),
            max: parsed(next.max),
        });
        setSaving(false);
        if (!result.success) toast.error(result.message);
    }

    function handleActiveChange(next: boolean) {
        setActive(next);
        save({ active: next, min, max });
    }

    // Debounced — min/max are typed digit by digit, no reason to fire a
    // save on every keystroke the way the switch does on every click.
    function handleNumberBlur() {
        save({ active, min, max });
    }

    return (
        <div className="flex items-center gap-3 px-3 py-2.5 border-b border-dashboard-base-300 last:border-b-0">
            <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-dashboard-base-content truncate">{member.name}</p>
                <p className="text-[10px] text-dashboard-base-content/50 truncate">{member.email}</p>
            </div>
            <span
                title="Current active-pipeline leads — the same count round-robin ranks by"
                className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-dashboard-base-200 text-dashboard-base-content/60 tabular-nums"
            >
                {member.activeCount} active
            </span>
            <label className="shrink-0 flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-dashboard-base-content/45 uppercase tracking-wide">Min</span>
                <Input
                    type="number" min={0}
                    value={min}
                    onChange={(e) => setMin(e.target.value)}
                    onBlur={handleNumberBlur}
                    disabled={!active}
                    placeholder="—"
                    className="h-7 w-14 text-xs text-center px-1"
                />
            </label>
            <label className="shrink-0 flex flex-col items-center gap-0.5">
                <span className="text-[9px] text-dashboard-base-content/45 uppercase tracking-wide">Max</span>
                <Input
                    type="number" min={0}
                    value={max}
                    onChange={(e) => setMax(e.target.value)}
                    onBlur={handleNumberBlur}
                    disabled={!active}
                    placeholder="—"
                    className="h-7 w-14 text-xs text-center px-1"
                />
            </label>
            <div className="shrink-0 flex items-center gap-1.5">
                {saving && <Loader2 className="h-3 w-3 animate-spin text-dashboard-base-content/40" />}
                <Switch checked={active} onCheckedChange={handleActiveChange} />
            </div>
        </div>
    );
}

export function AutoAssignSettingsDialog({ initialMembers }: { initialMembers: AutoAssignMemberSetting[] }) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                <Button variant="outline" size="sm" className="gap-1.5">
                    <Settings2 className="size-3.5" /> Auto-Assign Settings
                </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-hidden flex flex-col">
                <DialogHeader>
                    <DialogTitle className="text-sm">Auto-Assign Limits</DialogTitle>
                    <DialogDescription className="text-xs">
                        Off takes a Sales Executive out of the rotation entirely. Min is a floor
                        round-robin fills before anyone else gets a new lead; Max is a hard ceiling —
                        once reached, they stop receiving leads until one moves off their pipeline.
                        Leave either blank for no limit. Changes save immediately.
                    </DialogDescription>
                </DialogHeader>

                {initialMembers.length === 0 ? (
                    <p className="text-xs text-dashboard-base-content/50 py-6 text-center">
                        No Sales Executives found.
                    </p>
                ) : (
                    <div className="flex-1 overflow-y-auto rounded-lg border border-dashboard-base-300 -mx-1">
                        {initialMembers.map((m) => <MemberRow key={m.id} member={m} />)}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
