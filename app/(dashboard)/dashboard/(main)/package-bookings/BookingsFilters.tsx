"use client";

import { useState } from "react";
import { useRouter, usePathname } from "next/navigation";

const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const inputCls =
    "h-9 rounded-md border border-dashboard-base-300 bg-dashboard-base-100 px-3 text-sm text-dashboard-base-content outline-none focus:border-dashboard-primary";

/** Search + status filters; pushes to the URL (server component re-queries). */
export default function BookingsFilters({
    search,
    payment,
    status,
    paymentOptions,
    statusOptions,
}: {
    search: string;
    payment: string;
    status: string;
    paymentOptions: string[];
    statusOptions: string[];
}) {
    const router = useRouter();
    const pathname = usePathname();
    const [q, setQ] = useState(search);

    function push(next: Record<string, string>) {
        const p = new URLSearchParams();
        const merged = { search, payment, status, ...next };
        if (merged.search) p.set("search", merged.search);
        if (merged.payment) p.set("payment", merged.payment);
        if (merged.status) p.set("status", merged.status);
        // any filter change resets to page 1
        const qs = p.toString();
        router.push(qs ? `${pathname}?${qs}` : pathname);
    }

    return (
        <div className="flex flex-wrap items-center gap-2">
            <form
                onSubmit={(e) => { e.preventDefault(); push({ search: q.trim() }); }}
                className="flex items-center gap-2"
            >
                <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search booking #, name, email, phone…"
                    className={`${inputCls} w-72`}
                />
                <button type="submit" className="h-9 rounded-md bg-dashboard-primary px-4 text-sm font-medium text-white hover:opacity-90">
                    Search
                </button>
            </form>

            <select value={payment} onChange={(e) => push({ payment: e.target.value })} className={inputCls}>
                <option value="">All payments</option>
                {paymentOptions.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </select>

            <select value={status} onChange={(e) => push({ status: e.target.value })} className={inputCls}>
                <option value="">All statuses</option>
                {statusOptions.map((o) => <option key={o} value={o}>{titleCase(o)}</option>)}
            </select>

            {(search || payment || status) && (
                <button
                    type="button"
                    onClick={() => { setQ(""); router.push(pathname); }}
                    className="h-9 rounded-md border border-dashboard-base-300 px-3 text-sm text-dashboard-neutral hover:bg-dashboard-base-200"
                >
                    Clear
                </button>
            )}
        </div>
    );
}
