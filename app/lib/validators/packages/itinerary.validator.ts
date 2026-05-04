import { z } from "zod";
import { CabTypeSchema } from "./package.validator";

// ── Stay ───────────────────────────────────────────────────────────────────────

export const AddStaySchema = z.object({
  itinerary_id: z.number().int().positive(),
  stay_category_id: z.number().int().positive("Stay category is required"),
  room_pricing_id: z.number().int().positive("Room pricing is required"),
  sort_order: z.number().int().min(0).default(0),
});

export const UpdateStaySchema = AddStaySchema.omit({ itinerary_id: true })
  .partial()
  .required({ stay_category_id: true, room_pricing_id: true });

export type AddStayDTO = z.infer<typeof AddStaySchema>;
export type UpdateStayDTO = z.infer<typeof UpdateStaySchema>;

// ── Activity ───────────────────────────────────────────────────────────────────

export const AddActivitySchema = z.object({
  itinerary_id: z.number().int().positive(),
  activity_id: z.number().int().positive("Activity is required"),
  sort_order: z.number().int().min(0).default(0),
  is_optional: z.boolean().default(false),
});

export type AddActivityDTO = z.infer<typeof AddActivitySchema>;

// ── Transfer ───────────────────────────────────────────────────────────────────

export const AddTransferSchema = z.object({
  itinerary_id: z.number().int().positive(),
  // stored as String? in schema but validated against enum
  cab_type: CabTypeSchema.optional(),
  pickup_point: z.string().max(255).optional(),
  drop_point: z.string().max(255).optional(),
  duration_text: z.string().max(100).optional(),
  sort_order: z.number().int().min(0).default(0),
});

export type AddTransferDTO = z.infer<typeof AddTransferSchema>;

// ── Note ───────────────────────────────────────────────────────────────────────

export const NoteTypeSchema = z.enum(["info", "warning", "tip", "important"]);
export const NotePositionSchema = z.enum(["top", "bottom"]);

export type NoteType = z.infer<typeof NoteTypeSchema>;
export type NotePosition = z.infer<typeof NotePositionSchema>;

export const AddNoteSchema = z
  .object({
    itinerary_id: z.number().int().positive(),
    message: z
      .string()
      .min(1, "Note message is required")
      .max(1000, "Note too long"),
    type: NoteTypeSchema.default("info"),
    position: NotePositionSchema.default("bottom"),
    optional_link_text: z.string().max(100).optional(),
    optional_link_url: z.union([z.url(), z.literal("")]).optional(),
    sort_order: z.number().int().min(0).default(0),
  })
  .refine(
    (data) => {
      const hasText = !!data.optional_link_text;
      const hasUrl = !!data.optional_link_url;
      return hasText === hasUrl;
    },
    {
      message: "Link text and URL must both be provided or both omitted",
      path: ["optional_link_text"],
    }
  );

export type AddNoteDTO = z.infer<typeof AddNoteSchema>;

// ── Upsert itinerary day (create or update the day record itself) ──────────────

export const UpsertItineraryDaySchema = z.object({
  package_id: z.number().int().positive(),
  duration_id: z.number().int().positive("Duration is required"),
  route_id: z.number().int().positive("Route is required"),
  day: z.number().int().min(1, "Day number must be at least 1"),
  title: z
    .string()
    .min(2, "Day title must be at least 2 characters")
    .max(255),
  description: z.string().max(5000).optional(),
});

export type UpsertItineraryDayDTO = z.infer<typeof UpsertItineraryDaySchema>;

// ── Full day payload (complete day save from editor) ──────────────────────────

const StayInputSchema = AddStaySchema.omit({ itinerary_id: true });
const ActivityInputSchema = AddActivitySchema.omit({ itinerary_id: true });
const TransferInputSchema = AddTransferSchema.omit({ itinerary_id: true });
const NoteInputSchema = AddNoteSchema.omit({ itinerary_id: true });

export const FullDayItinerarySchema = UpsertItineraryDaySchema.extend({
  stays: z.array(StayInputSchema).default([]),
  activities: z.array(ActivityInputSchema).default([]),
  transfers: z.array(TransferInputSchema).default([]),
  notes: z.array(NoteInputSchema).default([]),
})
  .refine(
    (data) => {
      const ids = data.stays.map((s) => s.stay_category_id);
      return ids.length === new Set(ids).size;
    },
    {
      message: "Duplicate stay category within the same day is not allowed",
      path: ["stays"],
    }
  )
  .refine(
    (data) => {
      const orders = data.activities.map((a) => a.sort_order);
      return orders.length === new Set(orders).size;
    },
    {
      message: "Activity sort_order values must be unique within the day",
      path: ["activities"],
    }
  );

export type FullDayItineraryDTO = z.infer<typeof FullDayItinerarySchema>;
