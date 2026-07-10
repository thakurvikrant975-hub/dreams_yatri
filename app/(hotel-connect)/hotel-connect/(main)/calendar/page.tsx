import Link from "next/link";
import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { Card } from "@/app/components/ui/Card";
import ConnectHeader from "../components/ConnectHeader";
import { CalendarBlankIcon, ArrowRightIcon } from "@phosphor-icons/react/dist/ssr";

// Entry point for the sidebar's "Rates & Inventory" link. The calendar
// itself lives at /properties/[id]/calendar (per property) — this route
// resolves which property to send the owner to, since the sidebar has no
// per-property context to link to directly.
export default async function CalendarEntryPage() {
  const session = await hotelConnectAuth();
  const ownerId = session!.user.id;

  const hotels = await db.hotels.findMany({
    where: { owner_id: ownerId, listing_status: { in: ["APPROVED", "LIVE"] } },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { name: "asc" },
  });

  if (hotels.length === 1) {
    redirect(`/hotel-connect/properties/${hotels[0].id}/rates`);
  }

  return (
    <div className="flex flex-col h-full min-h-0">
      <ConnectHeader title="Rates & Inventory" />
      <div className="flex-1 overflow-y-auto p-6">
        <div className="max-w-2xl mx-auto">
          {hotels.length === 0 ? (
            <Card variant="elevated" radius="md" className="border-dashed">
              <div className="py-14 text-center px-6">
                <div className="size-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4 mx-auto">
                  <CalendarBlankIcon size={26} className="text-neutral-400" />
                </div>
                <p className="text-sm font-semibold text-neutral-800 mb-1">No rates calendar yet</p>
                <p className="text-xs text-neutral-500 max-w-xs mx-auto leading-relaxed">
                  Your pricing &amp; availability calendar will appear here once a property is approved and live.
                </p>
              </div>
            </Card>
          ) : (
            <div className="space-y-2">
              <p className="text-sm text-neutral-500 mb-3">Select a property to manage its rates &amp; inventory.</p>
              {hotels.map((h) => (
                <Link
                  key={h.id}
                  href={`/hotel-connect/properties/${h.id}/rates`}
                  className="flex items-center justify-between gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3.5 hover:border-primary-300 hover:bg-primary-50/40 transition-colors"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-neutral-800 truncate">{h.name}</p>
                    {(h.city || h.state) && (
                      <p className="text-xs text-neutral-400 mt-0.5">{[h.city, h.state].filter(Boolean).join(", ")}</p>
                    )}
                  </div>
                  <ArrowRightIcon size={14} weight="bold" className="text-neutral-300 shrink-0" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
