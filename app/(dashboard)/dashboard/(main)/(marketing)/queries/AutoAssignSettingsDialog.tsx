"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Settings2, Loader2, Handshake } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Switch } from "../../components/ui/switch";
import { Input } from "../../components/ui/input";
import {
    Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
    DialogTrigger,
} from "../../components/ui/dialog";
import { Label } from "../../components/ui/label";
import {
    updateAutoAssignMemberSetting, updatePartnerAgencySetting,
    type AutoAssignMemberSetting, type PartnerAgencySetting,
} from "./actions";
import type { QuerySource } from "@/app/generated/prisma";

/** The sources a manager may hold back, labelled as the rest of the dashboard
 * labels them. */
const SOURCES: { value: QuerySource; label: string }[] = [
    { value: "WEBSITE_FORM", label: "Website Form" },
    { value: "LANDING_PAGE", label: "Landing Page" },
    { value: "WHATSAPP", label: "WhatsApp Meta" },
    { value: "WHATSAPP_GOOGLE", label: "WhatsApp Google" },
    { value: "META", label: "Meta" },
    { value: "PHONE_CALL", label: "Phone Call" },
    { value: "REFERRAL", label: "Referral" },
    { value: "OTHER", label: "Other" },
];

/**
 * One agency's share of the day.
 *
 * Not a variant of the executive row above it: an exec's min/max bound how
 * much work one person carries at once, while an agency is bought from — so
 * many leads a day, spread out, and only the ones we choose to sell. Saved on
 * an explicit press rather than per keystroke, because these settings decide
 * what leaves the building.
 */
function AgencyRow({ agency }: { agency: PartnerAgencySetting }) {
    const [active, setActive] = useState(agency.active);
    const [dailyCap, setDailyCap] = useState(agency.dailyCap.toString());
    const [gapMin, setGapMin] = useState(agency.gapMin.toString());
    const [gapMax, setGapMax] = useState(agency.gapMax.toString());
    const [maxGroupSize, setMaxGroupSize] = useState(agency.maxGroupSize?.toString() ?? "");
    const [destinations, setDestinations] = useState(agency.allowedDestinations.join(", "));
    const [sources, setSources] = useState<QuerySource[]>(agency.blockedSources);
    const [saving, setSaving] = useState(false);

    const num = (v: string, fallback: number) => {
        const n = parseInt(v, 10);
        return v.trim() === "" || Number.isNaN(n) ? fallback : Math.max(0, n);
    };

    async function save() {
        setSaving(true);
        const r = await updatePartnerAgencySetting(agency.id, {
            active,
            dailyCap: num(dailyCap, 0),
            gapMin: num(gapMin, 7),
            gapMax: num(gapMax, 14),
            maxGroupSize: maxGroupSize.trim() === "" ? null : num(maxGroupSize, 1),
            allowedDestinations: destinations.split(",").map((d) => d.trim()).filter(Boolean),
            blockedSources: sources,
        });
        setSaving(false);
        if (r.success) toast.success(r.message);
        else toast.error(r.message);
    }

    return (
        <div className="space-y-4 px-4 py-4">
            <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-dashboard-base-content">
                        <Handshake className="size-3.5 text-dashboard-secondary" />
                        {agency.name}
                    </p>
                    <p className="text-[11px] text-dashboard-base-content/50">
                        {agency.givenToday} of {agency.dailyCap || "—"} given today
                    </p>
                </div>
                <Switch checked={active} onCheckedChange={setActive} />
            </div>

            <div className="grid grid-cols-3 gap-2">
                <div className="space-y-1">
                    <Label className="text-[11px] text-dashboard-base-content/60">Leads per day</Label>
                    <Input value={dailyCap} onChange={(e) => setDailyCap(e.target.value)} inputMode="numeric" placeholder="0" />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px] text-dashboard-base-content/60">Every … leads</Label>
                    <Input value={gapMin} onChange={(e) => setGapMin(e.target.value)} inputMode="numeric" placeholder="7" />
                </div>
                <div className="space-y-1">
                    <Label className="text-[11px] text-dashboard-base-content/60">… to</Label>
                    <Input value={gapMax} onChange={(e) => setGapMax(e.target.value)} inputMode="numeric" placeholder="14" />
                </div>
            </div>
            <p className="-mt-2 text-[11px] text-dashboard-base-content/45">
                Their next lead lands a random {gapMin || 7}–{gapMax || 14} leads after the last, up
                to {dailyCap || 0} a day, so they get a spread of the day rather than the first
                arrivals.
            </p>

            <div className="space-y-1">
                <Label className="text-[11px] text-dashboard-base-content/60">Largest group they may get</Label>
                <Input value={maxGroupSize} onChange={(e) => setMaxGroupSize(e.target.value)} inputMode="numeric" placeholder="No limit" />
            </div>

            <div className="space-y-1">
                <Label className="text-[11px] text-dashboard-base-content/60">Destinations they may receive</Label>
                <Input value={destinations} onChange={(e) => setDestinations(e.target.value)} placeholder="e.g. Goa, Kerala — comma separated" />
                <p className="text-[11px] text-dashboard-base-content/45">
                    {destinations.trim()
                        ? "Only these destinations go to this agency; a lead for anywhere else stays in-house, as does one with no destination."
                        : "Empty means no restriction — any destination may go to this agency."}
                </p>
            </div>

            <div className="space-y-1.5">
                <Label className="text-[11px] text-dashboard-base-content/60">Sources to hold back</Label>
                <div className="flex flex-wrap gap-1.5">
                    {SOURCES.map((src) => {
                        const blocked = sources.includes(src.value);
                        return (
                            <button
                                key={src.value}
                                type="button"
                                onClick={() => setSources(blocked ? sources.filter((v) => v !== src.value) : [...sources, src.value])}
                                className={`rounded-full border px-2.5 py-1 text-[11px] transition-colors cursor-pointer ${
                                    blocked
                                        ? "border-dashboard-error/40 bg-dashboard-error/10 text-dashboard-error line-through"
                                        : "border-dashboard-base-300 text-dashboard-base-content/60 hover:bg-dashboard-base-200/60"
                                }`}
                            >
                                {src.label}
                            </button>
                        );
                    })}
                </div>
            </div>

            <Button type="button" size="sm" onClick={save} disabled={saving} className="w-full gap-1.5">
                {saving && <Loader2 className="size-3.5 animate-spin" />}
                Save agency settings
            </Button>
        </div>
    );
}

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

export function AutoAssignSettingsDialog({
    initialMembers, initialAgencies = [],
}: {
    initialMembers: AutoAssignMemberSetting[];
    initialAgencies?: PartnerAgencySetting[];
}) {
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
                    <div className="flex-1 overflow-y-auto -mx-1 space-y-4">
                        <div className="rounded-lg border border-dashboard-base-300">
                            {initialMembers.map((m) => <MemberRow key={m.id} member={m} />)}
                        </div>

                        {/* Agencies last: they are the exception to everything
                            above, and a manager reads the team first. */}
                        {initialAgencies.length > 0 && (
                            <div>
                                <p className="px-1 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-dashboard-base-content/50">
                                    Partner agencies
                                </p>
                                <div className="divide-y divide-dashboard-base-300 rounded-lg border border-dashboard-base-300">
                                    {initialAgencies.map((a) => <AgencyRow key={a.id} agency={a} />)}
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
