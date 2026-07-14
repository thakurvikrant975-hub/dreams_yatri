export type BedroomDetail = {
  name: string;
  beds: Record<string, number>;
  has_extra_bed: boolean;
  extra_bed_type: string;
  base_adults: number;
  max_adults: number;
  has_bathroom: boolean;
  bathroom_type: string;
  has_balcony: boolean;
  balcony_furniture: boolean;
  amenities: string[];
  description: string;
  view: string;
  size_value: number | null;
  size_unit: "sqm" | "sqft";
  floor_level: string;
  step_reached: number;
  photos: string[];
};

export function defaultBedroom(n: number): BedroomDetail {
  return {
    name: `Bedroom ${n}`,
    beds: {},
    has_extra_bed: false,
    extra_bed_type: "",
    base_adults: 2,
    max_adults: 2,
    has_bathroom: false,
    bathroom_type: "",
    has_balcony: false,
    balcony_furniture: false,
    amenities: [],
    description: "",
    view: "",
    size_value: null,
    size_unit: "sqm",
    floor_level: "",
    step_reached: 0,
    photos: [],
  };
}
