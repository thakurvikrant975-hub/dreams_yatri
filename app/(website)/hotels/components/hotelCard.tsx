
import { MapPinIcon } from '@phosphor-icons/react';
import Card from '@/app/components/ui/Card';
import { Heading, Text } from '@/app/components/ui/Typography';
import { cn } from '@/lib/utils';
import SavingsBadge from '@/app/components/packages/SavingBadge';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/20/solid';
import { HotelCardData } from '@/app/types/hotels/hotels';



function StarRow({ count }: { count: number }) {
    return (
        <div className="flex gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
                <svg key={i} className={cn("w-3 h-3", i < count ? "fill-warning-500" : "fill-neutral-300")} viewBox="0 0 24 24">
                    <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
                </svg>
            ))}
        </div>
    );
}

const base = process.env.NEXT_PUBLIC_R2_PUBLIC_URL!;

export default function HotelCard({ hotel }: { hotel: HotelCardData }) {
  // ── Map API fields to card fields ──────────────────────────────────────
  const room         = hotel.room_pricing[0];
  const price        = room?.price_per_night ?? 0;
  const originalPrice = room?.original_price ?? price;
  const discount     = originalPrice > price
    ? Math.round((1 - price / originalPrice) * 100)
    : 0;

  const thumbnail  = hotel.thumbnail
    ? `${base}/${hotel.thumbnail}`
    : null;

  const location   = `${hotel.destination.name} · ${hotel.destination.region.name}`;
  const category   = hotel.category ?? "";
  const stars      = hotel.star_rating ?? 0;
  const roomTypes  = hotel._count.room_pricing;
  const checkIn    = hotel.check_in_time  ?? "—";
  const checkOut   = hotel.check_out_time ?? "—";
  const href       = `/hotels/${hotel.slug}`;

  // rating + reviewCount not in card API response — hide or pass from parent
  const rating      = (hotel as any).rating      ?? null;
  const reviewCount = (hotel as any).reviewCount ?? null;

  // amenities not included in card select — omit or pass from parent
  const amenities: string[] = (hotel as any).amenities ?? [];
  // ── End mapping ────────────────────────────────────────────────────────

  return (
    <Card className="flex bg-card overflow-hidden min-h-45">
      {/* Image */}
      <div className="relative w-64 shrink-0 overflow-hidden bg-muted">
        {thumbnail ? (
          <img src={thumbnail} alt={hotel.name} className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            No image
          </div>
        )}
        {category && (
          <span className="absolute top-2.5 left-2.5 text-[11px] font-medium bg-neutral-900/60 text-white px-2 py-1 rounded-md">
            {category}
          </span>
        )}
      </div>

      {/* Details — unchanged from your original */}
      <div className="flex flex-col gap-2 p-4 flex-1 min-w-0">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Heading level={3} weight='semibold'>{hotel.name}</Heading>
            <Text size='xs' intent='secondary' className="flex items-center gap-1 mt-0.5">
              <MapPinIcon weight='fill' className="size-3.75 text-muted" />
              {location}
            </Text>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {rating !== null && (
              <div className="flex items-center gap-1.5 bg-surface-muted ring-1 ring-(--border-default) rounded-md px-2 py-1">
                <span className="text-warning-500 text-xs">★</span>
                <Text size='sm' weight='semibold'>{rating}</Text>
                {reviewCount !== null && (
                  <Text size='xs' weight='normal' intent='secondary'>· {reviewCount} reviews</Text>
                )}
              </div>
            )}
            <StarRow count={stars} />
          </div>
        </div>

        {amenities.length > 0 && (
          <div className="flex gap-1.5 flex-wrap">
            {amenities.map(a => (
              <span key={a} className="text-[11px] bg-surface-muted text-secondary px-2 py-0.5 rounded-pill ring-1 ring-(--border-default)">
                {a}
              </span>
            ))}
          </div>
        )}

        <div className="flex gap-4 text-xs text-secondary">
          <span>{roomTypes} room type{roomTypes !== 1 ? "s" : ""}</span>
          <span>
            Check-in : <span className='text-primary font-medium'>{checkIn}</span>
            {" "}· Check-out: <span className='text-primary font-medium'>{checkOut}</span>
          </span>
        </div>

        <div className="flex-1" />

        <div className="flex items-center justify-between border-t border-(--border-default) pt-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <Text intent='primary' size='lg' weight='bold' className='font-heading'>
                ₹{price.toLocaleString()}
              </Text>
              {originalPrice > price && (
                <Text as='span' intent='muted' size='sm' className='relative after:absolute after:top-1/2 after:left-0 after:w-full after:h-px after:bg-error-500 px-1'>
                  ₹{originalPrice.toLocaleString()}
                </Text>
              )}
              {discount > 0 && <SavingsBadge amount={`${discount}%`} className='py-1.5 px-3' />}
            </div>
            <Text size='xss' weight='normal' intent='secondary'>per night · excl. taxes</Text>
          </div>
          <a href={href} className="text-xs font-medium px-3 py-1.5 rounded-md ring-1 ring-(--border-default) hover:bg-neutral-50 transition-colors text-secondary flex items-center gap-1">
            View Hotel <ArrowTopRightOnSquareIcon className="inline-block size-4 ml-1 text-muted" />
          </a>
        </div>
      </div>
    </Card>
  );
}