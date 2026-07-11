import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { getRoomBookingContext } from "../booking-data";
import { holdRoomReservation } from "../booking-actions";
import { resolveDates } from "../page";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ room?: string; in?: string; out?: string; plan?: string; error?: string }>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  const roomId = Number(sp.room);
  const { checkIn, checkOut } = resolveDates(sp);
  if (!roomId) notFound();

  // The synthetic "${roomId}-base" id (used when a room has no real pricing
  // row yet) isn't a real pricingId — only a genuine numeric id is threaded
  // through; anything else falls back to lead-plan behavior, same as before
  // rate plans existed.
  const pricingId = sp.plan && /^\d+$/.test(sp.plan) ? Number(sp.plan) : undefined;

  const ctx = await getRoomBookingContext(slug, roomId, checkIn, checkOut, pricingId);
  if (!ctx) notFound();

  const input = "h-10 w-full rounded-lg border border-neutral-300 bg-white px-3 text-sm shadow-sm focus:ring-2 focus:ring-primary-500/20 outline-none";
  const label = "block text-[11px] font-semibold text-neutral-600 mb-1";

  return (
    <>
      <Header />
      <main className="screen-space py-8">
        <Link href={`/hotels/${slug}`} className="text-xs text-primary-600 hover:underline">← Back to hotel</Link>
        <h1 className="text-xl font-bold text-neutral-900 mt-2 mb-5">Confirm your booking</h1>

        <div className="grid lg:grid-cols-[1fr_340px] gap-6 items-start">
          {/* Guest form */}
          <form action={holdRoomReservation} className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 space-y-4">
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="roomId" value={ctx.roomId} />
            <input type="hidden" name="checkIn" value={ctx.checkIn} />
            <input type="hidden" name="checkOut" value={ctx.checkOut} />
            <input type="hidden" name="units" value={1} />
            <input type="hidden" name="pricingId" value={pricingId ?? ""} />

            {sp.error && (
              <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">{sp.error}</div>
            )}
            {!ctx.available && (
              <div className="rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800">
                These dates are currently unavailable for this room.
              </div>
            )}

            <p className="text-sm font-bold text-neutral-800">Guest details</p>
            <div>
              <label className={label}>Full name</label>
              <input name="name" required placeholder="e.g. Ananya Sharma" className={input} />
            </div>
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className={label}>Email</label>
                <input name="email" type="email" required placeholder="you@example.com" className={input} />
              </div>
              <div>
                <label className={label}>Phone</label>
                <input name="phone" required placeholder="+91 …" className={input} />
              </div>
            </div>

            <button
              type="submit"
              disabled={!ctx.available}
              className="w-full h-11 rounded-xl bg-primary-600 hover:bg-primary-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
            >
              Reserve room
            </button>
            <p className="text-[11px] text-neutral-400 text-center">
              Your room is held instantly. Payment is collected separately (coming soon).
            </p>
          </form>

          {/* Summary */}
          <div className="rounded-2xl border border-neutral-200 bg-white shadow-sm p-5 h-fit">
            <p className="text-xs text-neutral-500">{ctx.hotelName}</p>
            <p className="text-sm font-bold text-neutral-800">{ctx.roomName}</p>
            <div className="mt-3 space-y-1.5 text-sm text-neutral-600 border-t border-neutral-100 pt-3">
              <div className="flex justify-between"><span>Check-in</span><span className="font-medium text-neutral-800">{ctx.checkIn}</span></div>
              <div className="flex justify-between"><span>Check-out</span><span className="font-medium text-neutral-800">{ctx.checkOut}</span></div>
              <div className="flex justify-between"><span>Nights</span><span className="font-medium text-neutral-800">{ctx.nights}</span></div>
            </div>
            <div className="mt-3 border-t border-neutral-100 pt-3">
              {ctx.nightly != null && (
                <div className="flex justify-between text-sm text-neutral-600">
                  <span>{money(ctx.nightly)} × {ctx.nights} night{ctx.nights === 1 ? "" : "s"}</span>
                  <span className="font-semibold text-neutral-900">{ctx.total != null ? money(ctx.total) : "—"}</span>
                </div>
              )}
              <p className="text-[11px] text-emerald-700 mt-2">{ctx.cancellationLabel}</p>
            </div>
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}