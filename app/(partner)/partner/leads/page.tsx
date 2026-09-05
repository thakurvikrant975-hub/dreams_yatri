import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getCurrentAgency, partnerSignOut } from "@/app/lib/auth-partner";
import { getAgencyLeads, hasActiveFilters, parseLeadFilters, LEADS_PAGE_SIZE } from "./actions";
import LeadsToolbar from "./LeadsToolbar";
import LeadsTable from "./LeadsTable";

export const metadata: Metadata = {
  title: "Your Leads - Dreams Yatri Partners",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

type RawParams = Record<string, string | string[] | undefined>;

/** searchParams arrive as string | string[]; a repeated key is a hand-edited
 * URL, and the first value is as good a reading of it as any. */
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function PartnerLeadsPage({
  searchParams,
}: {
  searchParams: Promise<RawParams>;
}) {
  // proxy.ts already turns away a request with no session; this re-checks
  // against the row, so an account deactivated or moved off the agency role
  // loses access on its next request rather than when its token lapses.
  const agency = await getCurrentAgency();
  if (!agency) redirect("/partner/login");

  const raw = await searchParams;
  const filters = parseLeadFilters({
    q: one(raw.q), dateField: one(raw.dateField), from: one(raw.from),
    to: one(raw.to), destination: one(raw.destination), page: one(raw.page),
  });

  const { rows, total, totalAll, destinations } = await getAgencyLeads(agency.id, filters);

  const totalPages = Math.max(1, Math.ceil(total / LEADS_PAGE_SIZE));
  // A page number left behind by a filter change would show an empty table
  // with a "Previous" link as the only way out; send it back to the start.
  if (filters.page > totalPages && total > 0) {
    const back = new URLSearchParams(
      Object.entries(raw).flatMap(([k, v]) => {
        const s = one(v);
        return s && k !== "page" ? [[k, s] as [string, string]] : [];
      }),
    );
    redirect(back.toString() ? `/partner/leads?${back}` : "/partner/leads");
  }

  const firstIndex = total === 0 ? 0 : (filters.page - 1) * LEADS_PAGE_SIZE + 1;
  const lastIndex = firstIndex === 0 ? 0 : firstIndex + rows.length - 1;
  const filtered = hasActiveFilters(filters);

  /** Page links keep the filters; only the page number moves. */
  const pageHref = (p: number) => {
    const qs = new URLSearchParams();
    if (filters.q.trim()) qs.set("q", filters.q.trim());
    if (filters.dateField !== "received") qs.set("dateField", filters.dateField);
    if (filters.from) qs.set("from", filters.from);
    if (filters.to) qs.set("to", filters.to);
    if (filters.destination) qs.set("destination", filters.destination);
    if (p > 1) qs.set("page", String(p));
    return qs.toString() ? `/partner/leads?${qs}` : "/partner/leads";
  };

  return (
    <main className="min-h-screen bg-neutral-50">
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <div>
            <p className="text-sm font-semibold text-neutral-900">{agency.name}</p>
            <p className="text-xs text-neutral-500">Dreams Yatri partner leads</p>
          </div>
          <form action={async () => { "use server"; await partnerSignOut({ redirectTo: "/partner/login" }); }}>
            <button type="submit" className="cursor-pointer text-xs text-neutral-500 hover:text-neutral-900">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <div className="mx-auto max-w-6xl space-y-4 px-4 py-6">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-base font-semibold text-neutral-900">Your leads</h1>
          <span className="text-xs text-neutral-500">
            {filtered
              ? `${total} of ${totalAll} lead${totalAll === 1 ? "" : "s"} match`
              : `${totalAll} lead${totalAll === 1 ? "" : "s"} received`}
          </span>
        </div>

        {/* useSearchParams needs a boundary; the toolbar is the whole fallback
            it would render anyway, so the wait is never visible. */}
        <Suspense fallback={<div className="h-[6.5rem] rounded-lg border border-neutral-200 bg-white" />}>
          <LeadsToolbar destinations={destinations} />
        </Suspense>

        {totalAll === 0 ? (
          <div className="rounded-lg border border-neutral-200 bg-white px-4 py-12 text-center text-neutral-500">
            No leads yet. New ones appear here as they are assigned to you.
          </div>
        ) : (
          <Suspense fallback={<div className="h-64 rounded-lg border border-neutral-200 bg-white" />}>
            <LeadsTable rows={rows} total={total} firstIndex={firstIndex} />
          </Suspense>
        )}

        {total > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-neutral-500">
              Showing {firstIndex}–{lastIndex} of {total}
            </p>
            {totalPages > 1 && (
              <div className="flex items-center gap-2">
                <PageLink href={pageHref(filters.page - 1)} disabled={filters.page <= 1}>Previous</PageLink>
                <span className="text-xs text-neutral-500">Page {filters.page} of {totalPages}</span>
                <PageLink href={pageHref(filters.page + 1)} disabled={filters.page >= totalPages}>Next</PageLink>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}

function PageLink({ href, disabled, children }: {
  href: string; disabled: boolean; children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-disabled={disabled}
      tabIndex={disabled ? -1 : undefined}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium transition-colors ${
        disabled
          ? "pointer-events-none border-neutral-100 text-neutral-300"
          : "border-neutral-200 text-neutral-600 hover:bg-neutral-100"
      }`}
    >
      {children}
    </Link>
  );
}
