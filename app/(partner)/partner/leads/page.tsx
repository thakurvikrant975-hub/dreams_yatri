import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getCurrentAgency, partnerSignOut } from "@/app/lib/auth-partner";
import { getAgencyLeads } from "./actions";

export const metadata: Metadata = {
  title: "Your Leads - Dreams Yatri Partners",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

/** IST throughout: the agency works the same hours we do, and "2 hours ago"
 * cannot be checked against a call log. */
const fmtDateTime = (iso: string) => new Intl.DateTimeFormat("en-IN", {
  timeZone: "Asia/Kolkata", day: "numeric", month: "short",
  hour: "numeric", minute: "2-digit", hour12: true,
}).format(new Date(iso));

const fmtDate = (iso: string | null) => iso
  ? new Intl.DateTimeFormat("en-IN", {
      timeZone: "Asia/Kolkata", day: "numeric", month: "short", year: "numeric",
    }).format(new Date(iso))
  : "—";

export default async function PartnerLeadsPage() {
  // proxy.ts already turns away a request with no session; this re-checks
  // against the row, so an account deactivated or moved off the agency role
  // loses access on its next request rather than when its token lapses.
  const agency = await getCurrentAgency();
  if (!agency) redirect("/partner/login");

  const leads = await getAgencyLeads(agency.id);

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
        <div className="flex items-baseline justify-between">
          <h1 className="text-base font-semibold text-neutral-900">Your leads</h1>
          <span className="text-xs text-neutral-500">
            {leads.length} lead{leads.length === 1 ? "" : "s"} received
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-xs text-neutral-500">
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-normal">Received</th>
                <th className="px-3 py-2.5 text-left font-normal">Name</th>
                <th className="px-3 py-2.5 text-left font-normal">Phone</th>
                <th className="px-3 py-2.5 text-left font-normal">Email</th>
                <th className="px-3 py-2.5 text-left font-normal">Destination</th>
                <th className="px-3 py-2.5 text-right font-normal">People</th>
                <th className="whitespace-nowrap px-4 py-2.5 text-left font-normal">Travel date</th>
              </tr>
            </thead>
            <tbody>
              {leads.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-neutral-500">
                    No leads yet. New ones appear here as they are assigned to you.
                  </td>
                </tr>
              ) : leads.map((l) => (
                <tr key={l.id} className="border-b border-neutral-100 last:border-0">
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-500">{fmtDateTime(l.receivedAt)}</td>
                  <td className="px-3 py-3 font-medium text-neutral-900">{l.name}</td>
                  {/* Tappable on a phone — this is a list to be called from. */}
                  <td className="whitespace-nowrap px-3 py-3">
                    <a href={`tel:${l.phone}`} className="text-neutral-900 hover:underline">{l.phone}</a>
                  </td>
                  <td className="px-3 py-3 text-neutral-600">
                    {l.email ? <a href={`mailto:${l.email}`} className="hover:underline">{l.email}</a> : "—"}
                  </td>
                  <td className="px-3 py-3 text-neutral-600">{l.destination ?? "—"}</td>
                  <td className="px-3 py-3 text-right tabular-nums text-neutral-600">{l.groupSize ?? "—"}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-neutral-600">{fmtDate(l.travelDate)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  );
}
