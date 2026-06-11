"use client";

import { Eye, EyeOff } from "lucide-react";
import { Checkbox } from "../components/ui/checkbox";
import { Switch } from "../components/ui/switch";
import { NAV_GROUPS, ALL_HREFS } from "../lib/rbac/nav-items";

// ── Main Editor ───────────────────────────────────────────────────────────────
// `value` = list of sidebar hrefs visible to this role.
// Empty array means "no restriction" — the full sidebar is shown.

export function SidebarAccessEditor({
    value,
    onChange,
}: {
    value: string[];
    onChange: (next: string[]) => void;
}) {
    const restricted = value.length > 0;

    function toggleRestricted(on: boolean) {
        // Start a fresh restriction from "everything visible" so nothing
        // disappears from the sidebar until the admin unchecks something.
        onChange(on ? [...ALL_HREFS] : []);
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

            {/* ── Per-section checklist ────────────────────────────────────── */}
            <div className={["space-y-3", restricted ? "" : "opacity-50 pointer-events-none"].join(" ")}>
                {NAV_GROUPS.map(group => {
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
