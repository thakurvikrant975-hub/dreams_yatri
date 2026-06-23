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
  room_amenity_details:  z.record(z.union([z.string(), z.array(z.string())])).optional(),
});

export type FullRoomData = z.infer<typeof fullRoomSchema>;
export type RoomState = {
  error?: string;
  errors?: Partial<Record<keyof FullRoomData, string[]>>;
};
