export const WIZARD_TABS = [
  { index: 1, label: "Basic Info" },
  { index: 2, label: "Location" },
  { index: 3, label: "Amenities" },
  { index: 4, label: "Rooms" },
  { index: 5, label: "Photos" },
  { index: 6, label: "Policies" },
  { index: 7, label: "Finance & Legal" },
] as const;

// Homestay & Villa: 8 tabs matching Hotel structure; tab 4 = Rooms & Spaces instead of Rooms
export const HOMESTAY_WIZARD_TABS = [
  { index: 1, label: "Basic Info" },
  { index: 2, label: "Location" },
  { index: 3, label: "Amenities" },
  { index: 4, label: "Rooms & Spaces" },
  { index: 5, label: "Photos" },
  { index: 6, label: "Pricing" },
  { index: 7, label: "Policies" },
  { index: 8, label: "Finance & Legal" },
] as const;
