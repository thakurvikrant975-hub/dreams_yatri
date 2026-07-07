"use client";

import { useState } from "react";
import { Eye, EyeOff, AlertTriangle } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { NAV_GROUPS } from "../lib/rbac/nav-items";

// ── Main Editor ───────────────────────────────────────────────────────────────
// `value` = list of sidebar hrefs visible to this role.
// Empty array means "no restriction" — the full sidebar is shown. Because of
// that, "restricted" can't be derived purely from value.length (an empty,
// freshly-restricted list would be indistinguishable from "not restricted"),
// so it's tracked as its own piece of state, seeded from the saved value.

export function SidebarAccessEditor({
    value,
    onChange,
}: {
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const [restricted, setRestricted] = useState(value.length > 0);

    function toggleRestricted(on: boolean) {
        setRestricted(on);
        // Turning restriction off always means "full sidebar" again.
        // Turning it on starts from an empty checklist — the admin picks
        // exactly which pages this role should see, instead of everything
        // being pre-granted and needing to be unchecked one by one.
        if (!on) onChange([]);
    }

    function toggleItem(href: string) {
        onChange(
            value.includes(href)
                ? value.filter(h => h !== href)
                : [...value, href]
        );
    }

    function toggleGroup(hrefs: string[]) {
        const allSelected = hrefs.every(h => value.includes(h));
        onChange(
            allSelected
                ? value.filter(h => !hrefs.includes(h))
                : [...new Set([...value, ...hrefs])]
        );
    }

    return (
        <div className="space-y-4">

            {/* ── Restrict toggle ──────────────────────────────────────────── */}
            <div className="flex items-center justify-between rounded-xl border bg-dashboard-base-100 px-4 py-3">
                <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        {restricted
                            ? <EyeOff className="h-4 w-4 text-primary" />
                            : <Eye className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                        <p className="text-sm font-medium">Restrict Sidebar Navigation</p>
                        <p className="text-xs text-muted-foreground">
                            {restricted
                                ? "Members with this role only see the pages checked below."
                                : "Members with this role see the full sidebar (all pages)."}
                        </p>
                    </div>
                </div>
                <Switch checked={restricted} onCheckedChange={toggleRestricted} />
            </div>

            {/* ── Empty-restriction warning ─────────────────────────────────── */}
            {restricted && value.length === 0 && (
                <div className="flex items-start gap-2.5 rounded-xl border border-dashboard-warning/40 bg-dashboard-warning/5 px-4 py-3">
                    <AlertTriangle className="h-4 w-4 text-dashboard-warning mt-0.5 shrink-0" />
                    <p className="text-xs text-dashboard-warning">
                        No pages selected yet — saving now will leave this role with the full sidebar,
                        since an empty selection means "no restriction." Check at least one page below first.
                    </p>
                </div>
            )}

            {/* ── Per-section checklist ────────────────────────────────────── */}
            <div className={["space-y-3", restricted ? "" : "opacity-50 pointer-events-none"].join(" ")}>
                {NAV_GROUPS.filter(group => group.items.length > 0).map(group => {
                    const hrefs = group.items.map(i => i.href);
                    const allSelected = hrefs.every(h => value.includes(h));
                    const someSelected = hrefs.some(h => value.includes(h));
                    const selectedCount = hrefs.filter(h => value.includes(h)).length;

                    return (
                        <div key={group.id} className="rounded-xl border bg-card overflow-hidden">
                            <div className="flex items-center gap-3 px-4 py-3 bg-dashboard-base-100">
                                <Checkbox
                                    checked={allSelected}
                                    indeterminate={someSelected && !allSelected}
                                    onChange={() => toggleGroup(hrefs)}
                                />
                                <span className="text-sm font-medium flex-1">{group.label}</span>
                                <span className="text-xs text-muted-foreground">
                                    {selectedCount}/{hrefs.length}
                                </span>
                            </div>
                            <div className="px-4 py-3 grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-2.5 border-t">
                                {group.items.map(item => {
                                    const Icon = item.icon;
                                    return (
                                        <Checkbox
                                            key={item.href}
                                            checked={value.includes(item.href)}
                                            onChange={() => toggleItem(item.href)}
                                            label={
                                                <span className="inline-flex items-center gap-1.5">
                                                    <Icon
                                                        weight={item.phosphor ? "duotone" : undefined}
                                                        className="size-3.5 shrink-0 text-muted-foreground"
                                                    />
                                                    {item.title}
                                                </span>
                                            }
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
