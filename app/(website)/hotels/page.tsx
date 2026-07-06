import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import { Card } from "@/app/components/ui/Card";
import { StarIcon, MapPinIcon } from "@phosphor-icons/react/dist/ssr";
import type { LocationValue } from "@/app/components/ui/LocationSearchSelect";
import type { LocationType } from "@/app/(dashboard)/dashboard/(main)/components/location/location.types";
import HotelsSearchBar from "./HotelsSearchBar";
import { searchHotels } from "./[slug]/booking-data";

export const metadata: Metadata = {
  title: "Hotels | Dreams Yatri",
  description: "Search and book hotels, homestays and resorts across India.",
};

const money = (n: number) => `₹${n.toLocaleString("en-IN")}`;

function pick(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : Array.isArray(v) ? v[0] ?? "" : "";
}

function toDate(iso: string): Date | null {
  if (!iso) return null;
  const d = new Date(`${iso}T00:00:00`);
  return isNaN(d.getTime()) ? null : d;
}

function cityValue(city: string): LocationValue | null {
  if (!city) return null;
  return { id: city, name: city, type: "CITY" as LocationType, breadcrumb: city, slug: "" };
}

export default async function HotelsIndexPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const city = pick(sp.city);
  const inISO = pick(sp.in);
  const outISO = pick(sp.out);
  const adults = Math.max(1, parseInt(pick(sp.adults) || "2", 10) || 2);
  const childAges = pick(sp.children)
    ? pick(sp.children).split(",").map((n) => parseInt(n, 10)).filter((n) => !isNaN(n))
    : [];

  const hotels = await searchHotels({ city: city || undefined });
  const stayQs = new URLSearchParams({ ...(inISO ? { in: inISO } : {}), ...(outISO ? { out: outISO } : {}) }).toString();

  return (
    <>
      <Header />

      <HotelsSearchBar
        initialCity={cityValue(city)}
        initialCheckIn={toDate(inISO)}
        initialCheckOut={toDate(outISO)}
        initialGuests={{ adults, childrenAges: childAges }}
      />

      <div className="screen-space py-8">
        <p className="text-sm text-neutral-500 mb-6">
          {hotels.length} {hotels.length === 1 ? "property" : "properties"}
          {city ? ` in ${city}` : ""}
        </p>

        {hotels.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-neutral-300 p-12 text-center">
            <p className="text-sm font-semibold text-neutral-700">No properties found{city ? ` in ${city}` : ""}.</p>
            <p className="text-xs text-neutral-500 mt-1">Try a different city or clear the filters.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
            {hotels.map((h) => (
              <Link key={h.id} href={`/hotels/${h.slug}${stayQs ? `?${stayQs}` : ""}`} className="group">
                <Card variant="elevated" radius="md" className="overflow-hidden p-px h-full">
                  <div className="relative h-44 overflow-hidden rounded-t-[inherit]">
                    <Image src={h.image} alt={h.name} fill className="object-cover group-hover:scale-105 transition-transform duration-300" sizes="(max-width:640px) 100vw, 33vw" />
                    {h.starRating ? (
                      <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-0.5 text-[11px] font-bold text-white bg-black/55 rounded-full px-2 py-0.5 backdrop-blur-[1px]">
                        {h.starRating} <StarIcon size={11} weight="fill" className="text-amber-400" />
                      </span>
                    ) : null}
                  </div>
                  <div className="p-4">
                    <p className="text-sm font-bold text-neutral-800 truncate">{h.name}</p>
                    <p className="flex items-center gap-1 text-xs text-neutral-400 mt-0.5">
                      <MapPinIcon size={13} weight="fill" className="text-neutral-300" />
                      {[h.city, h.state].filter(Boolean).join(", ") || "—"}
                    </p>
                    {h.amenities.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2.5">
                        {h.amenities.map((a) => (
                          <span key={a} className="text-[10px] text-neutral-500 bg-neutral-50 border border-neutral-200 rounded-full px-2 py-0.5">{a}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-end justify-between mt-3">
                      <div>
                        {h.priceFrom != null ? (
                          <>
                            <p className="text-[11px] text-neutral-400">From</p>
                            <p className="text-base font-bold text-neutral-900">{money(h.priceFrom)}<span className="text-[11px] font-normal text-neutral-400"> /night</span></p>
                          </>
                        ) : (
                          <p className="text-xs text-neutral-400">Price on request</p>
                        )}
                      </div>
                      <span className="text-xs font-bold text-primary-600 group-hover:underline">View →</span>
                    </div>
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        )}
      </div>

      <Footer />
    </>
  );
}
