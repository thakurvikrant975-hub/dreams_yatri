"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
const inputCls =
    "h-9 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary";

/** Search + status/type/gateway filters for the transactions list; pushes to the URL. */
export default function TransactionsFilters({
    search, status, purpose, gateway, statusOptions, purposeOptions, gatewayOptions,
}: {
    search: string;
    status: string;
    purpose: string;
    gateway: string;
    statusOptions: string[];
    purposeOptions: { value: string; label: string }[];
    gatewayOptions: string[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [q, setQ] = useState(search);

    function push(next: Record<string, string>) {
        const merged = { search, status, purpose, gateway, ...next };
        const p = new URLSearchParams();
        if (merged.search) p.set("search", merged.search);
        if (merged.status) p.set("status", merged.status);
        if (merged.purpose) p.set("purpose", merged.purpose);
        if (merged.gateway) p.set("gateway", merged.gateway);
        const qs = p.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <form onSubmit={(e) => { e.preventDefault(); push({ search: q.trim() }); }} className="flex items-center gap-2">
                <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search booking #, gateway ref, customer…" className={`${inputCls} w-72`} />
                <button type="submit" className="h-9 rounded-md bg-dashboard-primary px-4 text-sm font-medium text-white hover:opacity-90">Search</button>
            </form>

            <select value={purpose} onChange={(e) => push({ purpose: e.target.value })} className={inputCls}>
                <option value="">All types</option>
                {purposeOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>

            <select value={status} onChange={(e) => push({ status: e.target.value })} className={inputCls}>
                <option value="">All statuses</option>
                {statusOptions.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </select>

            <select value={gateway} onChange={(e) => push({ gateway: e.target.value })} className={inputCls}>
                <option value="">All gateways</option>
                {gatewayOptions.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </select>

            {(search || status || purpose || gateway) && (
                <button type="button" onClick={() => { setQ(""); router.push(pathname); }} className="h-9 rounded-md border border-dashboard-base-300 px-3 text-sm text-dashboard-neutral hover:bg-dashboard-base-200">Clear</button>
            )}
        </div>
    );
}
