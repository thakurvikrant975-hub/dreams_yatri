import { notFound } from "next/navigation";
import Link from "next/link";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { db } from "@/app/lib/db";
import { CheckCircleIcon } from "@heroicons/react/24/solid";

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;
const ymd = (d: Date) => d.toISOString().slice(0, 10);

export default async function BookedPage({
  params,
}: {
  params: Promise<{ slug: string; reservationId: string }>;
}) {
  const { slug, reservationId } = await params;

  const r = await db.hotel_reservation.findFirst({
    where: { id: reservationId, hotel: { slug } },
    select: {
      id: true, status: true, check_in: true, check_out: true, units: true,
      guest_name: true, guest_email: true, guest_phone: true, gross_amount: true, currency: true,
      room: { select: { name: true } },
      hotel: { select: { name: true, city: true } },
    },
  });
  if (!r) notFound();

  const row = (k: string, v: string) => (
    <div className="flex justify-between py-2 border-b border-neutral-100 last:border-0">
      <span className="text-sm text-neutral-500">{k}</span>
      <span className="text-sm font-medium text-neutral-800">{v}</span>
    </div>
  );

  return (
    <>
      <Header />
      <main className="screen-space py-10">
        <div className="max-w-xl mx-auto rounded-2xl border border-neutral-200 bg-white shadow-sm p-6">
          <div className="flex items-center gap-3">
            <CheckCircleIcon className="w-10 h-10 text-emerald-500" />
            <div>
              <h1 className="text-lg font-bold text-neutral-900">Room held!</h1>
              <p className="text-sm text-neutral-500">Reservation {r.id.slice(0, 8).toUpperCase()} · status {r.status}</p>
            </div>
          </div>

          <div className="mt-5">
            {row("Hotel", `${r.hotel.name}${r.hotel.city ? `, ${r.hotel.city}` : ""}`)}
            {row("Room", `${r.room.name} × ${r.units}`)}
            {row("Check-in", ymd(r.check_in))}
            {row("Check-out", ymd(r.check_out))}
            {row("Guest", r.guest_name ?? "—")}
            {row("Contact", [r.guest_email, r.guest_phone].filter(Boolean).join(" · ") || "—")}
            {r.gross_amount != null && row("Amount", money(Number(r.gross_amount)))}
          </div>

          <div className="mt-6 flex gap-2">
            <Link href={`/hotels/${slug}`} className="flex-1 text-center h-10 leading-10 rounded-xl border border-neutral-200 text-sm font-semibold text-neutral-700 hover:bg-neutral-50">
              Back to hotel
            </Link>
          </div>
          <p className="text-[11px] text-neutral-400 mt-3 text-center">
            Payment collection is coming soon. Your room inventory is already reserved.
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
