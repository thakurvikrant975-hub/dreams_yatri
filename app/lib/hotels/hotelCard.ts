/**
 * The shape every hotel tile renders from — search results and the detail
 * page's "Similar properties nearby" rail alike.
 *
 * Lives here rather than in `booking-data.ts` so `dummy.ts` can reference it
 * without an import cycle (booking-data already imports dummy's types).
 * Sharing one type is the point: the similar-properties rail previously
 * carried its own thinner shape, so the cards a guest compares side by side
 * showed less than the ones they arrived from.
 */
export type HotelCard = {
  id: number;
  slug: string;
  name: string;
  city: string | null;
  state: string | null;
  starRating: number | null;
  /** "Resort", "Homestay" — from the legacy `category` column. */
  propertyType: string | null;
  image: string;
  /** Total photos on the property, for the "N Photos" badge. */
  photoCount: number;
  priceFrom: number | null;
  /** GST on the cheapest plan, so the card can show the all-in cost honestly. */
  taxesFrom: number | null;
  /** Guest-friendly meal plan on the cheapest plan, e.g. "Breakfast Included". */
  mealPlan: string | null;
  /** The room the `priceFrom` actually buys. */
  roomName: string | null;
  maxOccupancy: number | null;
  bedType: string | null;
  /** How many distinct room types are sellable. */
  roomTypeCount: number;
  amenities: string[];
};
