export const PLAN_NOTES_MAX_LEN = 1000;

export const STAY_TYPES = [
  "1 Star",
  "2 Star",
  "3 Star",
  "4 Star",
  "5 Star",
] as const;

export const CATEGORIES = [
  { id: 1,  value: "hotel",                 label: "Hotel" },
  { id: 2,  value: "resort",                label: "Resort" },
  { id: 3,  value: "homestay",              label: "Homestay" },
  { id: 4,  value: "apartment",             label: "Apartment" },
  { id: 5,  value: "serviced_apartment",    label: "Serviced Apartment" },
  { id: 6,  value: "villa",                 label: "Villa" },
  { id: 7,  value: "guest_house",           label: "Guest House" },
  { id: 8,  value: "hostel",                label: "Hostel" },
  { id: 9,  value: "bed_and_breakfast",     label: "Bed & Breakfast (B&B)" },
  { id: 10, value: "holiday_home",          label: "Holiday Home" },
  { id: 11, value: "cottage",               label: "Cottage" },
  { id: 12, value: "chalet",                label: "Chalet" },
  { id: 13, value: "bungalow",              label: "Bungalow" },
  { id: 14, value: "farm_stay",             label: "Farm Stay" },
  { id: 15, value: "camp",                  label: "Camp" },
  { id: 16, value: "glamping",              label: "Glamping" },
  { id: 17, value: "treehouse",             label: "Treehouse" },
  // `id` is only local select state (the stored value is `value`), so new
  // entries take the next free id and sit wherever they read best in the list.
  { id: 30, value: "lodge",                 label: "Lodge" },
  { id: 18, value: "jungle_lodge",          label: "Jungle Lodge" },
  { id: 19, value: "eco_lodge",             label: "Eco Lodge" },
  { id: 20, value: "houseboat",             label: "Houseboat" },
  { id: 21, value: "boutique_hotel",        label: "Boutique Hotel" },
  { id: 22, value: "heritage_hotel",        label: "Heritage Hotel" },
  { id: 23, value: "luxury_hotel",          label: "Luxury Hotel" },
  { id: 24, value: "business_hotel",        label: "Business Hotel" },
  { id: 25, value: "capsule_hotel",         label: "Capsule Hotel" },
  { id: 26, value: "dharamshala",           label: "Dharamshala" },
  { id: 27, value: "ashram_stay",           label: "Ashram Stay" },
  { id: 28, value: "extended_stay_hotel",   label: "Extended Stay Hotel" },
  { id: 29, value: "co_living_space",       label: "Co-living Space" },
] as const;
