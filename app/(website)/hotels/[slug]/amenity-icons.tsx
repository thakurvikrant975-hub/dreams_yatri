import {
  WifiIcon,
  TruckIcon,
  BuildingStorefrontIcon,
  BoltIcon,
  SparklesIcon,
  FireIcon,
  ClockIcon,
} from "@heroicons/react/24/outline";

// Shared between the hotel detail page's compact amenity preview and the
// full "View All" amenities modal, keyed by the same icon slug booking-data's
// iconFor() assigns server-side.
export const AMENITY_ICONS: Record<string, typeof WifiIcon> = {
  wifi: WifiIcon,
  parking: TruckIcon,
  restaurant: BuildingStorefrontIcon,
  ac: BoltIcon,
  pool: SparklesIcon,
  gym: FireIcon,
  spa: SparklesIcon,
  desk: ClockIcon,
};
