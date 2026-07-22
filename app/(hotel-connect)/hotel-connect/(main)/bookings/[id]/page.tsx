import { notFound } from "next/navigation";
import Link from "next/link";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { Card } from "@/app/components/ui/Card";
import ConnectHeader from "../../components/ConnectHeader";
import BookingRequestActions from "../BookingRequestActions";
import { ArrowLeftIcon, UserIcon, BedIcon, CurrencyInrIcon } from "@phosphor-icons/react/dist/ssr";

function fmtDate(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(d);
}
function fmtDateTime(d: Date): string {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(d);
}
function inr(n: number): string {
  return `₹${n.toLocaleString("en-IN")}`;
}
const titleCase = (s: string) => s.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());

const STATUS_STYLE: Record<string, string> = {
  HOTEL_VERIFICATION: "bg-amber-50 text-amber-700 border-amber-200",
  CONFIRMED: "bg-emerald-50 text-emerald-700 border-emerald-200",
  UPCOMING: "bg-blue-50 text-blue-700 border-blue-200",
  ONGOING: "bg-emerald-50 text-emerald-700 border-emerald-200",
  COMPLETED: "bg-neutral-100 text-neutral-500 border-neutral-200",
  CANCELLED: "bg-red-50 text-red-600 border-red-200",
  REJECTED: "bg-red-50 text-red-600 border-red-200",
  PENDING_REVIEW: "bg-neutral-100 text-neutral-500 border-neutral-200",
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">{label}</p>
      <p className="mt-0.5 text-sm text-neutral-800">{value || "—"}</p>
    </div>
  );
}

export default async function HotelConnectBookingDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await hotelConnectAuth();
  if (!session?.user?.id) notFound();

  const booking = await db.booking.findUnique({
    where: { id },
    select: {
      id: true, bookingNumber: true, status: true, paymentStatus: true, paymentPlan: true,
      startDate: true, endDate: true, travellers: true, createdAt: true,
      totalAmount_paise: true, advanceAmount_paise: true, balanceAmount_paise: true, balanceDueDate: true,
      contactEmail: true, contactPhone: true, gstStateCode: true, cancelReason: true, cancelledAt: true,
      travellersList: { orderBy: { isLead: "desc" }, select: { id: true, fullName: true, type: true, gender: true, isLead: true } },
      payments: { orderBy: { createdAt: "desc" }, select: { id: true, gateway: true, method: true, amount_paise: true, status: true, purpose: true, createdAt: true, paidAt: true } },
      hotelBookings: {
        select: {
          hotelId: true, checkInDate: true, checkOutDate: true, roomType: true, roomsCount: true,
          ratePerRoom: true, totalCost: true, isConfirmed: true, status: true,
          hotel: { select: { name: true, city: true, state: true, owner_id: true } },
        },
      },
    },
  });

  const stay = booking?.hotelBookings[0];
  if (!booking || !stay || stay.hotel.owner_id !== session.user.id) notFound();

  const isFull = booking.paymentPlan === "FULL";
  const paidPaise = booking.paymentStatus === "PENDING" ? 0 : isFull ? booking.totalAmount_paise : booking.advanceAmount_paise;

  return (
    <>
      <ConnectHeader title="Booking detail" />
      <div className="flex-1 overflow-y-auto">
        <div className="p-6 mx-auto w-full max-w-5xl space-y-5">
          <Link href="/hotel-connect/bookings" className="inline-flex items-center gap-1.5 text-sm text-neutral-500 hover:text-primary-600 transition-colors">
            <ArrowLeftIcon size={14} weight="bold" />
            Back to bookings
          </Link>

          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h1 className="text-xl font-bold text-neutral-900">{booking.bookingNumber}</h1>
              <p className="text-sm text-neutral-500 mt-0.5">Requested {fmtDateTime(booking.createdAt)}</p>
            </div>
            <span className={`inline-flex items-center text-[11px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full border ${STATUS_STYLE[booking.status] ?? "bg-neutral-100 text-neutral-500 border-neutral-200"}`}>
              {titleCase(booking.status)}
            </span>
          </div>

          {booking.status === "PENDING_REVIEW" && (
            <Card variant="default" radius="lg" padding="lg" className="border-amber-200 bg-amber-50">
              <p className="text-sm text-amber-800">
                This guest hasn&apos;t completed payment yet — there&apos;s nothing for you to accept or reject until they do.
                If payment succeeds, this request will move to <strong>Action needed</strong> automatically.
              </p>
            </Card>
          )}

          {booking.status === "HOTEL_VERIFICATION" && (
            <Card variant="default" radius="lg" padding="lg" className="border-amber-200 bg-amber-50/60">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="text-sm text-amber-800">The guest has paid — please accept or decline this request.</p>
                <BookingRequestActions bookingId={booking.id} />
              </div>
            </Card>
          )}

          {booking.status === "REJECTED" && booking.cancelReason && (
            <Card variant="default" radius="lg" padding="lg" className="border-red-200 bg-red-50">
              <p className="text-sm text-red-700">
                Rejected {booking.cancelledAt ? `on ${fmtDate(booking.cancelledAt)}` : ""} — {booking.cancelReason}
              </p>
            </Card>
          )}

          <div className="grid gap-5 lg:grid-cols-3 items-start">
            <div className="lg:col-span-2 flex flex-col gap-5">
              <Card variant="elevated" radius="md" padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <BedIcon size={16} weight="fill" className="text-primary-500" />
                  <h2 className="text-sm font-bold text-neutral-800">Stay details</h2>
                </div>
                <dl className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                  <Field label="Property" value={stay.hotel.name} />
                  <Field label="Location" value={[stay.hotel.city, stay.hotel.state].filter(Boolean).join(", ")} />
                  <Field label="Room type" value={stay.roomType} />
                  <Field label="Rooms" value={stay.roomsCount} />
                  <Field label="Check-in" value={fmtDate(stay.checkInDate)} />
                  <Field label="Check-out" value={fmtDate(stay.checkOutDate)} />
                  <Field label="Guests" value={booking.travellers} />
                  <Field label="Rate / room / night" value={inr(Number(stay.ratePerRoom))} />
                </dl>
              </Card>

              <Card variant="elevated" radius="md" padding="lg">
                <h2 className="text-sm font-bold text-neutral-800 mb-4">Travellers ({booking.travellersList.length})</h2>
                {booking.travellersList.length === 0 ? (
                  <p className="text-sm text-neutral-400">No traveller details captured.</p>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {booking.travellersList.map((t) => (
                      <li key={t.id} className="flex items-center justify-between py-2.5 first:pt-0 last:pb-0">
                        <span className="text-sm text-neutral-800">
                          {t.fullName}
                          {t.isLead && <span className="ml-2 rounded bg-primary-50 px-1.5 py-0.5 text-[11px] font-medium text-primary-600">Lead</span>}
                        </span>
                        <span className="text-xs text-neutral-400">{titleCase(t.type)}{t.gender ? ` · ${titleCase(t.gender)}` : ""}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </Card>

              <Card variant="elevated" radius="md" padding="lg">
                <h2 className="text-sm font-bold text-neutral-800 mb-4">Payments</h2>
                {booking.payments.length === 0 ? (
                  <p className="text-sm text-neutral-400">No payment attempts yet.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-[11px] uppercase tracking-wide text-neutral-400">
                          <th className="py-2 pr-4 font-semibold">When</th>
                          <th className="py-2 pr-4 font-semibold">Gateway</th>
                          <th className="py-2 pr-4 font-semibold text-right">Amount</th>
                          <th className="py-2 font-semibold">Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {booking.payments.map((p) => (
                          <tr key={p.id} className="border-t border-neutral-100">
                            <td className="py-2.5 pr-4 whitespace-nowrap text-neutral-700">{fmtDateTime(p.paidAt ?? p.createdAt)}</td>
                            <td className="py-2.5 pr-4 text-neutral-700">{titleCase(p.gateway)}{p.method ? ` · ${titleCase(p.method)}` : ""}</td>
                            <td className="py-2.5 pr-4 text-right whitespace-nowrap text-neutral-800">{inr(p.amount_paise / 100)}</td>
                            <td className="py-2.5 text-neutral-700">{titleCase(p.status)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Card>
            </div>

            <div className="flex flex-col gap-5">
              <Card variant="elevated" radius="md" padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <CurrencyInrIcon size={16} weight="fill" className="text-primary-500" />
                  <h2 className="text-sm font-bold text-neutral-800">Payment summary</h2>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-neutral-500">Total</span>
                  <span className="font-semibold text-neutral-900">{inr(booking.totalAmount_paise / 100)}</span>
                </div>
                <div className="flex items-center justify-between text-sm mt-2">
                  <span className="text-neutral-500">{isFull ? "Paid in full" : "Deposit paid"}</span>
                  <span className="font-semibold text-neutral-900">{inr(paidPaise / 100)}</span>
                </div>
                {!isFull && booking.balanceAmount_paise > 0 && (
                  <div className="flex items-center justify-between text-sm mt-2">
                    <span className="text-neutral-500">Balance{booking.balanceDueDate ? ` (by ${fmtDate(booking.balanceDueDate)})` : ""}</span>
                    <span className="font-medium text-neutral-700">{inr(booking.balanceAmount_paise / 100)}</span>
                  </div>
                )}
              </Card>

              <Card variant="elevated" radius="md" padding="lg">
                <div className="flex items-center gap-2 mb-4">
                  <UserIcon size={16} weight="fill" className="text-primary-500" />
                  <h2 className="text-sm font-bold text-neutral-800">Guest contact</h2>
                </div>
                <dl className="flex flex-col gap-3">
                  <Field label="Email" value={booking.contactEmail} />
                  <Field label="Phone" value={booking.contactPhone} />
                  {booking.gstStateCode && <Field label="GST state" value={booking.gstStateCode} />}
                </dl>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
