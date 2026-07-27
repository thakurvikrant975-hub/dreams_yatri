"use client";

import { useState, useTransition } from "react";
import { Check, Save, Users, ChevronDown, ChevronUp, LayoutGrid } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "../../components/ui/badge";
import { Button } from "../../components/ui/button";
import { updateRolePageAccess } from "../actions";

// ── Page tree ─────────────────────────────────────────────────────────────────

export const PAGE_GROUPS = [
    {
        id: "overview",
        label: "Overview",
        pages: [
            { title: "Dashboard",  href: "/dashboard" },
            { title: "Analytics",  href: "/dashboard/analytics" },
        ],
    },
    {
        id: "content",
        label: "Content Management",
        pages: [
            { title: "Regions",       href: "/dashboard/regions" },
            { title: "Destinations",  href: "/dashboard/destinations" },
            { title: "Categories",    href: "/dashboard/categories" },
            { title: "Policies",      href: "/dashboard/policies" },
            { title: "Blog Reviews",  href: "/dashboard/blogs" },
        ],
    },
    {
        id: "activities",
        label: "Activities",
        pages: [
            { title: "Activities",            href: "/dashboard/activities" },
            { title: "Activity Categories",   href: "/dashboard/activities/categories" },
        ],
    },
    {
        id: "hotels",
        label: "Hotels",
        pages: [
            { title: "Hotels",       href: "/dashboard/hotels" },
            { title: "Hotel Inventory", href: "/dashboard/hotel-inventory" },
            { title: "Expiring Rates", href: "/dashboard/expiring-rates" },
            { title: "Hotel Owners", href: "/dashboard/hotel-owners" },
            { title: "Meal Types",   href: "/dashboard/hotels/meal-types" },
            { title: "Diet Types",   href: "/dashboard/hotels/diet-types" },
            { title: "Verify Hotels", href: "/dashboard/verify-hotels" },
        ],
    },
    {
        id: "packages",
        label: "Packages",
        pages: [
            { title: "Travel Packages", href: "/dashboard/packages" },
        ],
    },
    {
        id: "cab",
        label: "Cab Management",
        pages: [
            { title: "Vehicle Types",   href: "/dashboard/vehicles" },
            { title: "Cab Pricing",     href: "/dashboard/cab-pricing" },
            { title: "Cab Drivers",     href: "/dashboard/cab-drivers" },
            { title: "Verify Cabs",     href: "/dashboard/verify-cabs" },
            { title: "Assign Drivers",  href: "/dashboard/assign-driver" },
        ],
    },
    {
        id: "marketing",
        label: "Marketing",
        pages: [
            { title: "Queries",           href: "/dashboard/queries" },
            { title: "Landing pages",           href: "/dashboard/landing-pages" },
            { title: "Email Marketing",   href: "/dashboard/email-marketing" },
            { title: "Follow Ups",        href: "/dashboard/follow-ups" },
            { title: "References",        href: "/dashboard/references" },
            { title: "Coupons & Offers",  href: "/dashboard/coupons" },
            { title: "Reviews",           href: "/dashboard/reviews" },
            { title: "Not Found",         href: "/dashboard/not-found" },
        ],
    },
    {
        id: "sales",
        label: "Sales",
        pages: [
            { title: "Sales Dashboard",      href: "/sales-dashboard" },
            { title: "Queries Management",   href: "/dashboard/sales-query" },
            { title: "Package Library",      href: "/dashboard/package-library" },
            { title: "Package Builder",      href: "/dashboard/package-builder" },
            { title: "My Bookings",      href: "/dashboard/my-bookings" },
        ],
    },
    {
        id: "transactions",
        label: "Transactions",
        pages: [
            { title: "Transactions",         href: "/dashboard/transactions" },
            { title: "Failed Transactions",  href: "/dashboard/failed-transactions" },
            { title: "Refunds",              href: "/dashboard/refunds" },
        ],
    },
    {
        id: "team",
        label: "Our Team",
        pages: [
            { title: "Team Members",          href: "/dashboard/team-members" },
            { title: "Activity Logs",         href: "/dashboard/activity-logs" },
            { title: "Roles & Permissions",   href: "/dashboard/roles-and-permissions" },
        ],
    },
    {
        id: "bookings",
        label: "Booking Management",
        pages: [
            { title: "Package Bookings",  href: "/dashboard/package-bookings" },
            { title: "Hotel Bookings",    href: "/dashboard/hotel-bookings" },
            { title: "Verify Hotels",     href: "/dashboard/verify-hotels" },
        ],
    },
    {
        id: "settings",
        label: "Settings",
        pages: [
            { title: "General", href: "/dashboard/settings" },
        ],
    },
];

const ALL_HREFS = PAGE_GROUPS.flatMap(g => g.pages.map(p => p.href));

// ── Types ─────────────────────────────────────────────────────────────────────

type RoleRow = {
    id: string;
    name: string;
    description: string | null;
    pageAccess: unknown;
    _count: { members: number };
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function parsePageAccess(raw: unknown): string[] {
    if (!Array.isArray(raw)) return [];
    return raw.filter((v): v is string => typeof v === "string");
}

// ── Checkbox ──────────────────────────────────────────────────────────────────

function Checkbox({
    checked,
    indeterminate = false,
    onChange,
    label,
}: {
    checked: boolean;
    indeterminate?: boolean;
    onChange: () => void;
    label?: string;
}) {
    return (
        <label className="flex items-center gap-2 cursor-pointer select-none">
            <button
                type="button"
                role="checkbox"
                aria-checked={indeterminate ? "mixed" : checked}
                onClick={onChange}
                className={[
                    "h-4 w-4 rounded border flex items-center justify-center shrink-0 transition-all",
                    checked || indeterminate
                        ? "bg-primary border-primary text-primary-foreground"
                        : "border-input bg-background hover:border-primary/60",
                ].join(" ")}
            >
                {indeterminate && !checked
                    ? <span className="block h-0.5 w-2 bg-current rounded" />
                    : checked
                        ? <Check className="h-2.5 w-2.5" strokeWidth={3} />
                        : null}
            </button>
            {label && <span className="text-sm">{label}</span>}
        </label>
    );
}

// ── Group Block ───────────────────────────────────────────────────────────────

function GroupBlock({
    group,
    allowed,
    onTogglePage,
    onToggleGroup,
}: {
    group: (typeof PAGE_GROUPS)[number];
    allowed: string[];
    onTogglePage: (href: string) => void;
    onToggleGroup: (hrefs: string[], on: boolean) => void;
}) {
    const [expanded, setExpanded] = useState(true);
    const groupHrefs = group.pages.map(p => p.href);
    const checked = groupHrefs.every(h => allowed.includes(h));
    const indeterminate = !checked && groupHrefs.some(h => allowed.includes(h));
    const activeCount = groupHrefs.filter(h => allowed.includes(h)).length;

    return (
        <div className="rounded-xl border bg-card overflow-hidden">
            <div className="flex items-center gap-3 px-4 py-3 bg-dashboard-base-100">
                <Checkbox
                    checked={checked}
                    indeterminate={indeterminate}
                    onChange={() => onToggleGroup(groupHrefs, !checked)}
                />
                <span className="text-sm font-medium flex-1">{group.label}</span>
                <Badge variant="outline" className="text-xs px-2 py-0.5 text-muted-foreground">
                    {activeCount}/{group.pages.length} pages
                </Badge>
                <button
                    type="button"
                    onClick={() => setExpanded(v => !v)}
                    className="p-1 rounded hover:bg-muted text-muted-foreground"
                >
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </button>
            </div>

            {expanded && (
                <div className="px-4 py-3 border-t grid grid-cols-2 gap-2">
                    {group.pages.map(page => (
                        <Checkbox
                            key={page.href}
                            checked={allowed.includes(page.href)}
                            onChange={() => onTogglePage(page.href)}
                            label={page.title}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

// ── Main Editor ───────────────────────────────────────────────────────────────

export function PageAccessEditor({ roles }: { roles: RoleRow[] }) {
    const [selectedId, setSelectedId] = useState<string>(roles[0]?.id ?? "");
    const [drafts, setDrafts] = useState<Record<string, string[]>>(
        () => Object.fromEntries(roles.map(r => [r.id, parsePageAccess(r.pageAccess)]))
    );
    const [isPending, startTransition] = useTransition();

    const selected = roles.find(r => r.id === selectedId);
    const allowed = drafts[selectedId] ?? [];

    const allChecked = ALL_HREFS.every(h => allowed.includes(h));
    const someChecked = ALL_HREFS.some(h => allowed.includes(h));

    function togglePage(href: string) {
        setDrafts(prev => {
            const cur = prev[selectedId] ?? [];
            const next = cur.includes(href) ? cur.filter(h => h !== href) : [...cur, href];
            return { ...prev, [selectedId]: next };
        });
    }

    function toggleGroup(hrefs: string[], on: boolean) {
        setDrafts(prev => {
            const cur = prev[selectedId] ?? [];
            const next = on
                ? [...new Set([...cur, ...hrefs])]
                : cur.filter(h => !hrefs.includes(h));
            return { ...prev, [selectedId]: next };
        });
    }

    function toggleAll() {
        setDrafts(prev => ({
            ...prev,
            [selectedId]: allChecked ? [] : [...ALL_HREFS],
        }));
    }

    function handleSave() {
        startTransition(async () => {
            const result = await updateRolePageAccess(selectedId, allowed);
            if (result.success) toast.success(result.message);
            else toast.error(result.message);
        });
    }

    if (roles.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
                <LayoutGrid className="h-10 w-10 opacity-30" />
                <p className="text-sm">No roles found. Create a role first.</p>
            </div>
        );
    }

    return (
        <div className="flex gap-6 min-h-[600px]">

            {/* ── Role list (left panel) ────────────────────────────────────── */}
            <div className="w-64 shrink-0 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground px-1 pb-1">
                    Roles
                </p>
                {roles.map(role => {
                    const roleDraft = drafts[role.id] ?? [];
                    const accessCount = roleDraft.length;
                    const isSelected = role.id === selectedId;
                    return (
                        <button
                            key={role.id}
                            type="button"
                            onClick={() => setSelectedId(role.id)}
                            className={[
                                "w-full text-left px-3 py-3 rounded-xl border transition-all",
                                isSelected
                                    ? "bg-primary/5 border-primary/40 shadow-sm"
                                    : "bg-card border-border hover:border-primary/30 hover:bg-primary/5",
                            ].join(" ")}
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <p className={["text-sm font-medium truncate", isSelected ? "text-primary" : ""].join(" ")}>
                                        {role.name}
                                    </p>
                                    {role.description && (
                                        <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                            {role.description}
                                        </p>
                                    )}
                                </div>
                                {isSelected && (
                                    <div className="shrink-0 h-4 w-4 rounded-full bg-primary/10 flex items-center justify-center mt-0.5">
                                        <Check className="h-2.5 w-2.5 text-primary" strokeWidth={3} />
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-3 mt-2">
                                <span className="text-xs text-muted-foreground flex items-center gap-1">
                                    <Users className="h-3 w-3" />
                                    {role._count.members}
                                </span>
                                <span className={[
                                    "text-xs font-medium",
                                    accessCount > 0 ? "text-green-600 dark:text-green-400" : "text-muted-foreground",
                                ].join(" ")}>
                                    {accessCount}/{ALL_HREFS.length} pages
                                </span>
                            </div>
                        </button>
                    );
                })}
            </div>

            {/* ── Page access editor (right panel) ─────────────────────────── */}
            <div className="flex-1 min-w-0 space-y-4">

                {/* Sticky header */}
                <div className="sticky top-0 z-10 rounded-xl px-5 py-3 bg-dashboard-base-100 border flex items-center justify-between">
                    <div>
                        <p className="text-sm font-semibold">{selected?.name}</p>
                        <p className="text-xs text-muted-foreground">
                            {allowed.length} of {ALL_HREFS.length} pages accessible
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <Checkbox
                            checked={allChecked}
                            indeterminate={someChecked && !allChecked}
                            onChange={toggleAll}
                            label={allChecked ? "Revoke all" : "Grant all"}
                        />
                        <Button size="sm" onClick={handleSave} disabled={isPending} className="gap-2 bg-dashboard-primary rounded-md">
                            <Save className="h-3.5 w-3.5" />
                            {isPending ? "Saving..." : "Save Access"}
                        </Button>
                    </div>
                </div>

                {/* Page groups */}
                <div className="space-y-3">
                    {PAGE_GROUPS.map(group => (
                        <GroupBlock
                            key={group.id}
                            group={group}
                            allowed={allowed}
                            onTogglePage={togglePage}
                            onToggleGroup={toggleGroup}
                        />
                    ))}
                </div>

                {/* Bottom save */}
                <div className="flex justify-end pt-2 border-t">
                    <Button onClick={handleSave} disabled={isPending} className="gap-2 bg-dashboard-primary rounded-md">
                        <Save className="h-3.5 w-3.5" />
                        {isPending ? "Saving..." : "Save Access"}
                    </Button>
                </div>
            </div>
        </div>
    );
}
