import { MapPinIcon } from '@heroicons/react/24/outline'
import Card from '@/app/components/ui/Card';

export type HotelTypes = {
  id:            number;
  name:          string;
  location:      string;
  category:      string;
  stars:         number;
  rating:        number;
  reviewCount:   number;
  price:         number;
  originalPrice: number;
  checkIn:       string;
  checkOut:      string;
  roomTypes:     number;
  amenities:     string[];
  thumbnail:     string;
  href:          string;
};

function StarRow({ count }: { count: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} className="w-3 h-3" viewBox="0 0 24 24"
          fill={i < count ? "#F0C040" : "var(--border)"}>
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>
        </svg>
      ))}
    </div>
  );
}

export default function HotelCard({ hotel }: { hotel: HotelTypes }) {
  const discount = Math.round((1 - hotel.price / hotel.originalPrice) * 100);

  return (
    <Card className="flex bg-card  overflow-hidden min-h-45">
      {/* Image */}
      <div className="relative w-64 shrink-0 overflow-hidden bg-muted">
        <img
          src={hotel.thumbnail}
          alt={hotel.name}
          className="w-full h-full object-cover"
        />
        <span className="absolute top-2.5 left-2.5 text-[11px] font-medium bg-black/65 text-white px-2 py-1 rounded">
          {hotel.category}
        </span>
      </div>

      {/* Details */}
      <div className="flex flex-col gap-2 p-4 flex-1 min-w-0">
        {/* Name + rating */}
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">{hotel.name}</h3>
            <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
              <MapPinIcon className="w-3 h-3" />
              {hotel.location}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            <div className="flex items-center gap-1.5 bg-muted border border-border rounded px-2 py-1">
              <span className="text-amber-400 text-xs">★</span>
              <span className="text-sm font-medium">{hotel.rating}</span>
              <span className="text-xs text-muted-foreground">· {hotel.reviewCount} reviews</span>
            </div>
            <StarRow count={hotel.stars} />
          </div>
        </div>

        {/* Amenities */}
        <div className="flex gap-1.5 flex-wrap">
          {hotel.amenities.map(a => (
            <span key={a} className="text-[11px] bg-muted text-muted-foreground px-2 py-0.5 rounded border border-border">
              {a}
            </span>
          ))}
        </div>

        {/* Meta */}
        <div className="flex gap-4 text-xs text-muted-foreground">
          <span>{hotel.roomTypes} room type{hotel.roomTypes !== 1 ? "s" : ""}</span>
          <span>Check-in {hotel.checkIn} · Check-out {hotel.checkOut}</span>
        </div>

        <div className="flex-1" />

        {/* Pricing row */}
        <div className="flex items-center justify-between border-t border-border pt-3">
          <div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-medium">₹{hotel.price.toLocaleString()}</span>
              <span className="text-sm text-muted-foreground line-through">
                ₹{hotel.originalPrice.toLocaleString()}
              </span>
              <span className="text-[11px] font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded">
                {discount}% off
              </span>
            </div>
            <p className="text-[11px] text-muted-foreground mt-0.5">per night · excl. taxes</p>
          </div>
          <a href={hotel.href}
            className="text-sm font-medium px-5 py-2 rounded-lg border border-border hover:bg-muted transition-colors">
            View Hotel
          </a>
        </div>
      </div>
    </Card>
  );
}