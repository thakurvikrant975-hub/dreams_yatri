import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
    Building2, MapPin, Phone, Mail, Clock, ArrowLeft,
    BedDouble, Users, IndianRupee, CalendarDays, CheckCircle2, XCircle,
} from "lucide-react";
import { getHotelById } from "../../hotels/actions";
import { CATEGORIES } from "../../hotels/constants";
import {
    Breadcrumb, BreadcrumbItem,
    BreadcrumbLink, BreadcrumbList,
    BreadcrumbPage, BreadcrumbSeparator,
} from "../../components/ui/breadcrumb";

export const metadata: Metadata = {
    title: "Hotel Details - Dashboard",
    robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

const R2_BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "";

function img(key: string | null | undefined) {
    if (!key) return null;
    return key.startsWith("http") ? key : `${R2_BASE}/${key}`;
}

function catLabel(value: string | null) {
    if (!value) return "Uncategorized";
    return CATEGORIES.find((c) => c.value === value)?.label ?? value;
}

/** "14:00" (24h, as stored on hotels.check_in_time/check_out_time) → "2:00 PM". */
function formatTime12h(hhmm: string | null): string {
    if (!hhmm) return "—";
    const [h, m] = hhmm.split(":").map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return hhmm;
    const period = h >= 12 ? "PM" : "AM";
    const h12 = h % 12 === 0 ? 12 : h % 12;
    return `${h12}:${String(m).padStart(2, "0")} ${period}`;
}

function money(v: unknown): string {
    if (v == null) return "—";
    return `₹${Number(v).toLocaleString("en-IN")}`;
}

function InfoItem({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: React.ReactNode }) {
    if (!value && value !== 0) return null;
    return (
        <div className="flex items-start gap-2.5">
            <Icon className="h-4 w-4 text-dashboard-base-content/40 shrink-0 mt-0.5" />
            <div className="min-w-0">
                <p className="text-[10px] uppercase tracking-wide text-dashboard-base-content/50">{label}</p>
                <p className="text-sm font-medium text-dashboard-base-content truncate">{value}</p>
            </div>
        </div>
    );
}

export default async function HotelInventoryDetailPage({
    params,
}: {
    params: Promise<{ id: string }>;
}) {
    const { id } = await params;
    const hotelId = Number(id);
    const hotel = Number.isInteger(hotelId) ? await getHotelById(hotelId) : null;
    if (!hotel) notFound();

    const galleryImages = hotel.image_categories.flatMap((c) => c.images);

    return (
        <div className="space-y-6">
            <Breadcrumb>
                <BreadcrumbList>
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbLink href="/dashboard/hotel-inventory">Hotel Inventory</BreadcrumbLink>
                    </BreadcrumbItem>
                    <BreadcrumbSeparator />
                    <BreadcrumbItem>
                        <BreadcrumbPage>{hotel.name}</BreadcrumbPage>
                    </BreadcrumbItem>
                </BreadcrumbList>
            </Breadcrumb>

            <Link
                href="/dashboard/hotel-inventory"
                className="inline-flex items-center gap-1.5 text-sm text-dashboard-base-content/60 hover:text-dashboard-base-content transition-colors"
            >
                <ArrowLeft className="h-3.5 w-3.5" /> Back to Hotel Inventory
            </Link>

            {/* ── Header ─────────────────────────────────────────────────────── */}
            <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
                <div className="h-44 bg-dashboard-base-200 relative">
                    {img(hotel.thumbnail) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={img(hotel.thumbnail)!} alt={hotel.name} className="h-full w-full object-cover" />
                    ) : (
                        <div className="h-full w-full flex items-center justify-center">
                            <Building2 className="h-10 w-10 text-dashboard-base-content/30" />
                        </div>
                    )}
                    <span
                        className={`absolute top-3 right-3 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                            hotel.is_active
                                ? "bg-green-100 text-green-700"
                                : "bg-red-100 text-red-600"
                        }`}
                    >
                        {hotel.is_active ? "Active" : "Inactive"}
                    </span>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <h1 className="text-xl font-bold text-dashboard-base-content">{hotel.name}</h1>
                        <p className="text-sm text-dashboard-base-content/60">
                            {catLabel(hotel.category)} · {hotel.stay_type ?? "Unrated"}
                        </p>
                    </div>
                    {hotel.description && (
                        <p className="text-sm text-dashboard-base-content/75 leading-relaxed">{hotel.description}</p>
                    )}
                    <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2 border-t border-dashboard-base-300">
                        <InfoItem
                            icon={MapPin}
                            label="Location"
                            value={[hotel.address, hotel.city, hotel.state, hotel.country].filter(Boolean).join(", ") || "—"}
                        />
                        <InfoItem icon={Clock} label="Check-In" value={formatTime12h(hotel.check_in_time)} />
                        <InfoItem icon={Clock} label="Check-Out" value={formatTime12h(hotel.check_out_time)} />
                        <InfoItem icon={Phone} label="Phone" value={hotel.business_phone} />
                        <InfoItem icon={Mail} label="Email" value={hotel.business_email} />
                        <InfoItem icon={BedDouble} label="Rooms" value={hotel.hotelRooms.length} />
                    </div>
                </div>
            </div>

            {/* ── Gallery ────────────────────────────────────────────────────── */}
            {galleryImages.length > 0 && (
                <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 p-5">
                    <h2 className="text-sm font-bold text-dashboard-base-content mb-3">Photos</h2>
                    <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
                        {galleryImages.slice(0, 18).map((im) => (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                                key={im.id}
                                src={img(im.url) ?? undefined}
                                alt=""
                                className="h-24 w-full object-cover rounded-lg border border-dashboard-base-300"
                            />
                        ))}
                    </div>
                </div>
            )}

            {/* ── Rooms & Pricing ────────────────────────────────────────────── */}
            <div className="space-y-4">
                <h2 className="text-sm font-bold text-dashboard-base-content flex items-center gap-2">
                    <BedDouble className="h-4 w-4 text-dashboard-primary" /> Rooms &amp; Pricing
                </h2>

                {hotel.hotelRooms.length === 0 && (
                    <div className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 p-8 text-center">
                        <p className="text-sm text-dashboard-base-content/50">No rooms added for this hotel yet.</p>
                    </div>
                )}

                {hotel.hotelRooms.map((room) => (
                    <div key={room.id} className="rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 overflow-hidden">
                        <div className="flex items-center justify-between gap-3 px-5 py-3.5 bg-dashboard-base-200/50 border-b border-dashboard-base-300">
                            <div>
                                <p className="text-sm font-bold text-dashboard-base-content">{room.name}</p>
                                <p className="text-xs text-dashboard-base-content/60 mt-0.5">
                                    {[
                                        room.bed_type,
                                        room.max_occupancy != null ? `${room.max_occupancy} guests max` : null,
                                        room.area_sqft ? `${room.area_sqft} sq.ft` : null,
                                    ].filter(Boolean).join(" · ") || "—"}
                                </p>
                            </div>
                            <span
                                className={`shrink-0 text-[10px] font-medium px-2 py-0.5 rounded-full ${
                                    room.is_active
                                        ? "bg-green-100 text-green-700"
                                        : "bg-red-100 text-red-600"
                                }`}
                            >
                                {room.is_active ? "Active" : "Inactive"}
                            </span>
                        </div>

                        {room.amenities && room.amenities.length > 0 && (
                            <div className="px-5 pt-3 flex flex-wrap gap-1.5">
                                {room.amenities.map((a) => (
                                    <span key={a} className="text-[11px] px-2 py-0.5 rounded-full bg-dashboard-base-200 text-dashboard-base-content/70">
                                        {a}
                                    </span>
                                ))}
                            </div>
                        )}

                        <div className="p-5 space-y-3">
                            {room.pricing.length === 0 ? (
                                <p className="text-xs text-dashboard-base-content/45">No pricing configured for this room yet.</p>
                            ) : (
                                room.pricing.map((p) => (
                                    <div key={p.id} className="rounded-xl border border-dashboard-base-300 overflow-hidden">
                                        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-dashboard-primary/5 border-b border-dashboard-base-300">
                                            <p className="text-xs font-semibold text-dashboard-base-content flex items-center gap-1.5">
                                                <IndianRupee className="h-3 w-3 text-dashboard-primary" />
                                                {p.plan_name || "Standard Plan"}
                                                {p.meal_type && <span className="text-dashboard-base-content/50 font-normal">· {p.meal_type.name}</span>}
                                                {p.diet_type && <span className="text-dashboard-base-content/50 font-normal">· {p.diet_type.name}</span>}
                                            </p>
                                            {!p.is_active && (
                                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-red-100 text-red-600 shrink-0">Inactive</span>
                                            )}
                                        </div>
                                        <div className="p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
                                            <InfoItem icon={IndianRupee} label="Weekday / Night" value={money(p.price_per_night)} />
                                            <InfoItem icon={IndianRupee} label="Weekend / Night" value={p.weekend_price_per_night != null ? money(p.weekend_price_per_night) : "Same as weekday"} />
                                            <InfoItem icon={Users} label="Extra Bed" value={p.extra_bed_rate != null ? money(p.extra_bed_rate) : "—"} />
                                            <InfoItem icon={IndianRupee} label="Original Price" value={p.original_price != null ? money(p.original_price) : "—"} />
                                        </div>

                                        {p.occupancy_prices.length > 0 && (
                                            <div className="px-4 pb-4">
                                                <p className="text-[10px] uppercase tracking-wide text-dashboard-base-content/50 mb-1.5">By Occupancy</p>
                                                <div className="flex flex-wrap gap-1.5">
                                                    {p.occupancy_prices.map((op) => (
                                                        <span key={op.id} className="text-[11px] px-2 py-1 rounded-md bg-dashboard-base-200 text-dashboard-base-content/75">
                                                            {op.occupancy} pax — {money(op.price_per_night)}
                                                        </span>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {p.seasons.length > 0 && (
                                            <div className="px-4 pb-4">
                                                <p className="text-[10px] uppercase tracking-wide text-dashboard-base-content/50 mb-1.5 flex items-center gap-1">
                                                    <CalendarDays className="h-3 w-3" /> Seasonal Rates
                                                </p>
                                                <div className="space-y-1.5">
                                                    {p.seasons.map((s) => (
                                                        <div key={s.id} className="flex items-center justify-between gap-2 text-xs bg-dashboard-base-200/60 rounded-lg px-3 py-1.5">
                                                            <span className="flex items-center gap-1.5 text-dashboard-base-content/75">
                                                                {s.is_active ? (
                                                                    <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                                                                ) : (
                                                                    <XCircle className="h-3 w-3 text-red-500 shrink-0" />
                                                                )}
                                                                {s.season_name} ({new Date(s.valid_from).toLocaleDateString("en-IN")} – {new Date(s.valid_to).toLocaleDateString("en-IN")})
                                                            </span>
                                                            <span className="font-semibold text-dashboard-base-content shrink-0">{money(s.price_per_night)}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}
