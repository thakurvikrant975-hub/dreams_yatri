import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { db } from '@/app/lib/db';
import { getAuthenticatedUser } from '@/app/lib/functions/getAuthenticatedUser';
import PrintButton from '../PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Trip voucher | Dreams Yatri', robots: { index: false, follow: false } };

type SnapDay = {
    day: number;
    day_title: string;
    hotel: { hotel_name: string; room_name: string | null; plan_name: string | null } | null;
    meals?: { label: string }[];
    activities?: { name: string; is_optional: boolean }[];
};
type Snap = { duration_label?: string; stay_category_label?: string; days?: SnapDay[] };

function fmtDate(d: Date | null): string {
    if (!d) return '';
    return new Intl.DateTimeFormat('en-IN', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(d);
}

export default async function VoucherPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const user = await getAuthenticatedUser();
    if (!user?.id) notFound();

    const booking = await db.booking.findUnique({
        where: { id },
        select: {
            id: true, userId: true, bookingNumber: true, startDate: true, endDate: true, duration: true, travellers: true,
            priceSnapshot: true,
            package: { select: { title: true, inclusions: true, exclusions: true } },
            user: { select: { name: true } },
        },
    });
    if (!booking || booking.userId !== user.id) notFound();

    const snap = (booking.priceSnapshot ?? {}) as Snap;
    const days = snap.days ?? [];
    const inclusions = booking.package?.inclusions ?? [];
    const exclusions = booking.package?.exclusions ?? [];

    return (
        <main className="mx-auto max-w-2xl px-6 py-10 print:py-0 text-neutral-900">
            <style>{`@media print { .no-print { display:none !important } @page { margin: 14mm } }`}</style>

            <div className="flex items-start justify-between border-b border-neutral-200 pb-5">
                <div>
                    <div className="text-lg font-bold text-primary">Dreams Yatri</div>
                    <div className="text-xs text-neutral-500">Trip Voucher</div>
                </div>
                <div className="text-right text-sm font-semibold">{booking.bookingNumber}</div>
            </div>

            <h1 className="mt-5 text-xl font-bold">{booking.package?.title ?? 'Your trip'}</h1>
            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <Info label="Lead traveller" value={booking.user?.name ?? 'Customer'} />
                <Info label="Travellers" value={String(booking.travellers)} />
                <Info label="Dates" value={`${fmtDate(booking.startDate)} – ${fmtDate(booking.endDate)}`} />
                <Info label="Duration / Stay" value={[snap.duration_label ?? `${booking.duration} days`, snap.stay_category_label].filter(Boolean).join(' · ')} />
            </div>

            {days.length > 0 && (
                <section className="mt-7">
                    <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">Itinerary</h2>
                    <ol className="space-y-3">
                        {days.map((d) => (
                            <li key={d.day} className="rounded-lg border border-neutral-200 p-3">
                                <div className="font-medium">Day {d.day}: {d.day_title}</div>
                                {d.hotel && (
                                    <div className="mt-1 text-sm text-neutral-600">
                                        🏨 {d.hotel.hotel_name}{d.hotel.room_name ? ` · ${d.hotel.room_name}` : ''}{d.hotel.plan_name ? ` · ${d.hotel.plan_name}` : ''}
                                    </div>
                                )}
                                {d.activities && d.activities.length > 0 && (
                                    <div className="mt-1 text-sm text-neutral-600">🎟 {d.activities.map((a) => a.name).join(', ')}</div>
                                )}
                                {d.meals && d.meals.length > 0 && (
                                    <div className="mt-1 text-xs text-neutral-500">Meals: {d.meals.map((m) => m.label).join(', ')}</div>
                                )}
                            </li>
                        ))}
                    </ol>
                </section>
            )}

            <div className="mt-7 grid grid-cols-2 gap-6 text-sm">
                {inclusions.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">Inclusions</h2>
                        <ul className="list-disc pl-5 space-y-1 text-neutral-700">{inclusions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                )}
                {exclusions.length > 0 && (
                    <div>
                        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-500 mb-2">Exclusions</h2>
                        <ul className="list-disc pl-5 space-y-1 text-neutral-700">{exclusions.map((x, i) => <li key={i}>{x}</li>)}</ul>
                    </div>
                )}
            </div>

            <p className="mt-8 text-xs text-neutral-400 text-center">
                Present this voucher at check-in. For assistance, contact Dreams Yatri support.
            </p>

            <PrintButton label="Print / Save voucher as PDF" />
        </main>
    );
}

function Info({ label, value }: { label: string; value: string }) {
    return (
        <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500">{label}</div>
            <div className="mt-0.5 font-medium">{value}</div>
        </div>
    );
}
