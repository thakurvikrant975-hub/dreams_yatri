import { z } from "zod";

export const bedEntrySchema = z.object({
  type:  z.string().min(1, "Bed type required"),
  count: z.coerce.number().int().min(0),
});

export const bedroomGroupSchema = z.object({
  beds: z.array(bedEntrySchema).min(1, "Add at least one bed"),
});

export const fullRoomSchema = z.object({
  // Section 1
  room_type:        z.string().min(1, "Room type is required"),
  view_type:        z.string().optional(),
  area:             z.number().positive("Area must be positive").optional(),
  area_unit:        z.enum(["sqft", "sqm"]),
  name:             z.string().min(2, "Room name is required").max(100, "Name too long"),
  num_bedrooms:     z.number().int().min(1, "At least 1 bedroom"),
  num_living_rooms: z.number().int().min(0).optional(),
  num_rooms:        z.number().int().min(1, "At least 1 room"),
  description:      z.string().max(2000).optional(),

  // Section 2
  bedroom_beds:        z.array(bedroomGroupSchema).min(1, "Add at least one bedroom"),
  living_room_beds:    z.array(bedroomGroupSchema).optional(),
  base_adults:         z.number().int().min(0),
  max_adults:          z.number().int().min(1, "At least 1 adult"),
  base_children:       z.number().int().min(0),
  max_children:        z.number().int().min(0),
  max_occupancy:       z.number().int().min(1),
  extra_bed:           z.boolean(),
  extra_bed_capacity:  z.number().int().min(0),
  child_cot_available: z.boolean(),

  // Section 3
  bathrooms: z.array(z.object({
    type:        z.enum(["bathroom", "powder_room"]),
    attached_to: z.string().min(1, "Select a room"),
  })).min(1, "Add at least one bathroom"),

  // Section 4
  meal_plan:           z.string().min(1, "Select a meal plan"),
  base_rate:           z.coerce.number().positive("Enter a valid base rate"),
  extra_adult_charge:  z.coerce.number().min(0).optional(),
  paid_child_charge:   z.coerce.number().min(0).optional(),
  rate_start_date:     z.string().min(1, "Select start date"),
  rate_end_date:       z.string().min(1, "Select end date"),

  // Section 5
  room_amenities:        z.array(z.string()),
  room_amenity_details:  z.record(z.string(), z.union([z.string(), z.array(z.string())])).optional(),
}).superRefine((data, ctx) => {
  // These are only enforced client-side today (RoomsTab's own step
  // validators) — re-checked here so a direct call to createRoom/updateRoom
  // can't persist internally-inconsistent occupancy/date data.
  if (data.max_adults < data.base_adults) {
    ctx.addIssue({ code: "custom", path: ["max_adults"], message: "Max adults can't be less than base adults." });
  }
  if (data.max_children < data.base_children) {
    ctx.addIssue({ code: "custom", path: ["max_children"], message: "Max children can't be less than base children." });
  }
  if (data.max_occupancy < data.max_adults) {
    ctx.addIssue({ code: "custom", path: ["max_occupancy"], message: "Max occupancy can't be less than max adults." });
  }
  if (data.rate_end_date && data.rate_start_date && data.rate_end_date <= data.rate_start_date) {
    ctx.addIssue({ code: "custom", path: ["rate_end_date"], message: "End date must be after the start date." });
  }
});

export type FullRoomData = z.infer<typeof fullRoomSchema>;
export type RoomState = {
  error?: string;
  errors?: Partial<Record<keyof FullRoomData, string[]>>;
};
