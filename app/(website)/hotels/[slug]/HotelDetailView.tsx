"use client";
// app/(website)/hotels/[slug]/HotelDetailView.tsx

import { useState } from "react";
import type { HotelDetail, HotelImage } from "@/app/types/hotels/hotelDetails";
import { getAllImages } from "@/app/types/hotels/hotelDetails";
import Breadcrumbs from "@/app/components/ui/Breadcrumps";
import { Heading, Text } from "@/app/components/ui/Typography";
import { MapPinIcon } from "@phosphor-icons/react";
import { cn } from "@/app/lib/utils";
import Image from "next/image";
import Card from "@/app/components/ui/Card";
import HotelPricingCard from "../components/hotelPricingCard";

const BASE = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

function imgUrl(key: string) {
  return `${BASE}/${key}`;
}



// ── Image Gallery ─────────────────────────────────────────────────────────

function ImageGallery({ images }: { images: HotelImage[] }) {
  const [active, setActive] = useState(0);

  if (images.length === 0) {
    return (
      <div className="aspect-16/7 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400 text-sm">
        No photos yet
      </div>
    );
  }

  const current = images[active];

  return (
    <div className="space-y-3">
      {/* Main image */}
      <div className="grid grid-cols-3 grid-rows-2 max-h-100 gap-5">
        {
          images.map((img, i) => (
            <Image
              key={i}
              src={imgUrl(img.url)}
              alt={img.alt ?? "Hotel photo"}
              width="405"
              height="270"
              className={cn("w-full h-full object-cover 2 rounded-xl", i === 0 ? "col-span-2 row-span-2" : "")}
            />
          ))
        }

      </div>

    </div>
  );
}

// ── Room Card ─────────────────────────────────────────────────────────────

function RoomCard({ room }: { room: HotelDetail["room_pricing"][0] }) {
  const discount = room.original_price
    ? Math.round((1 - room.price_per_night / room.original_price) * 100)
    : null;

  const amenities = Array.isArray(room.amenities) ? room.amenities as string[] : [];

  return (
    <div className="border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-medium text-foreground">{room.room_type}</p>
          {room.description && (
            <p className="text-sm text-muted-foreground mt-0.5">{room.description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className="flex items-baseline gap-1.5 justify-end">
            <span className="text-lg font-semibold text-foreground font-heading">
              ₹{room.price_per_night.toLocaleString()}
            </span>
            {room.original_price && (
              <span className="text-sm text-muted-foreground line-through">
                ₹{room.original_price.toLocaleString()}
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">per night</p>
          {discount && discount > 0 && (
            <span className="inline-block mt-1 text-[11px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded">
              {discount}% off
            </span>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
          </svg>
          Max {room.occupancy} guests
        </span>
        {room.season !== "all" && (
          <span className="capitalize bg-muted px-2 py-0.5 rounded border border-border">
            {room.season} season
          </span>
        )}
      </div>

      {amenities.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          {amenities.map(a => (
            <span key={a} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full border border-border">
              {a}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main View ─────────────────────────────────────────────────────────────

export function HotelDetailView({ hotel }: { hotel: HotelDetail }) {
  const allImages = getAllImages(hotel);
  const amenities = Array.isArray(hotel.amenities) ? hotel.amenities as string[] : [];
  const lowestRoom = hotel.room_pricing[0];
  const location = [
    hotel.destination.name,
    hotel.destination.region.name,
  ].filter(Boolean).join(" · ");

  return (
    <div >
      <Breadcrumbs
        cat={{ label: 'Hotels', link: '/hotels' }}
        cat2={{ label: hotel.destination.name, link: `/destinations/${hotel.destination.slug}` }} title={hotel.name}
        className="mb-5"
      />

      <Heading level={1} weight='semibold'>{hotel.name}</Heading>

      <div className="flex flex-row items-center gap-3 mt-4">
        {hotel.category && (
          <span className="text-xs font-medium bg-neutral-50 text-muted-foreground px-2 py-0.5 rounded-full border ring-1 ring-inset ring-(--border-default) capitalize">
            {hotel.category}
          </span>
        )}

        <Text size='sm' intent='secondary' className="flex items-center gap-1">
          <MapPinIcon weight='fill' className="size-4 text-muted" />
          {hotel.address ?? location}
        </Text>

      </div>

      <div className="grid grid-cols-3 gap-8 mt-6">
        {/* ── Left column ── */}
        <div className="col-span-2 space-y-10">



          {/* Gallery */}
          <ImageGallery images={allImages} />

          {/* Header */}


          {/* Description */}
          {hotel.description && (
            <section className="space-y-2">
              <Heading level={2} size='xl' weight='semibold'>About this hotel</Heading>
              <Text size='sm' intent='secondary'>{hotel.description}</Text>
            </section>
          )}

          {/* Amenities */}
          {amenities.length > 0 && (
            <section className="space-y-3">
              <Heading level={2} size='xl' weight='semibold'>Amenities</Heading>
              <div className="flex flex-wrap gap-2">
                {amenities.map(a => (
                  <Text key={a} size='sm' intent='secondary' className="bg-neutral-50 px-3 py-1 rounded-full ring-1 ring-inset ring-(--border-default) capitalize">
                    {a}
                  </Text>
                ))}
              </div>
            </section>
          )}

          {/* Rooms */}
          {hotel.room_pricing.length > 0 && (
            <section className="space-y-4">
              <Heading level={2} size='xl' weight="semibold">
                Available Rooms
                <span className="ml-2 text-sm font-normal text-muted-foreground">
                  ({hotel.room_pricing.length} type{hotel.room_pricing.length !== 1 ? "s" : ""})
                </span>
              </Heading>
              <div className="space-y-3">
                {hotel.room_pricing.map(room => (
                  <RoomCard key={room.id} room={room} />
                ))}
              </div>
            </section>
          )}

          {/* Photo categories */}
          {hotel.image_categories.some(c => c.images.length > 0) && (
            <section className="space-y-6">
              <h2 className="text-base font-medium text-foreground">Photo Gallery</h2>
              {hotel.image_categories
                .filter(c => c.images.length > 0)
                .map(cat => (
                  <div key={cat.id} className="space-y-2">
                    <p className="text-sm font-medium text-muted-foreground">{cat.name}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {cat.images.map(img => (
                        <div key={img.id} className="aspect-square rounded-lg overflow-hidden bg-muted">
                          <img
                            src={imgUrl(img.thumbnail ?? img.url)}
                            alt={img.alt ?? cat.name}
                            className="w-full h-full object-cover hover:scale-105 transition-transform duration-200"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
            </section>
          )}
        </div>

        {/* ── Right column — sticky info ── */}
        <aside className="space-y-6">
          <div className="sticky top-6 space-y-4">

              {/* Pricing Card */}
              {lowestRoom && (
                <HotelPricingCard
                  originalPrice={lowestRoom.original_price ?? lowestRoom.price_per_night}
                  discountedPrice={lowestRoom.price_per_night}
                  savings={lowestRoom.original_price ? lowestRoom.original_price - lowestRoom.price_per_night : 0}
                  packageName={lowestRoom.room_type}
                />
              )}    


            {/* Check-in / out */}
            <Card className="px-4 py-3">
              <Text size="sm" weight="semibold" className="font-heading">Stay Information</Text>
              <div className="space-y-2 text-sm mt-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-in</span>
                  <span className="font-medium text-foreground">{hotel.check_in_time ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Check-out</span>
                  <span className="font-medium text-foreground">{hotel.check_out_time ?? "—"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Destination</span>
                  <span className="font-medium text-foreground">{hotel.destination.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Region</span>
                  <span className="font-medium text-foreground">{hotel.destination.region.name}</span>
                </div>
              </div>
            </Card>

            {/* CTA */}
            <a
              href={`/contact?hotel=${hotel.slug}`}
              className="block w-full text-center text-sm font-medium bg-primary text-primary-foreground py-3 rounded-xl hover:bg-primary/90 transition-colors"
            >
              Enquire Now
            </a>

            <a
              href={`tel:+911234567890`}
              className="block w-full text-center text-sm font-medium border border-border py-3 rounded-xl hover:bg-muted transition-colors"
            >
              Call Us
            </a>

            {/* Map placeholder */}
            {hotel.latitude && hotel.longitude && (
              <div className="rounded-xl overflow-hidden border border-border">
                <iframe
                  src={`https://maps.google.com/maps?q=${hotel.latitude},${hotel.longitude}&z=14&output=embed`}
                  width="100%"
                  height="200"
                  loading="lazy"
                  className="block"
                />
              </div>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}