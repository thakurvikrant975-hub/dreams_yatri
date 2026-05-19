import { z } from "zod";
import { SlugSchema } from "./package.validator";

// ── Route stop ─────────────────────────────────────────────────────────────────

export const CreateRouteStopSchema = z.object({
  destination_id: z.number().int().positive("Destination is required"),
  stay_days: z.number().int().min(0, "Nights cannot be negative"),
  sort_order: z.number().int().min(0),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export const UpdateRouteStopSchema = CreateRouteStopSchema.omit({
  destination_id: true,
})
  .partial()
  .required({ stay_days: true, sort_order: true });

export type CreateRouteStopDTO = z.infer<typeof CreateRouteStopSchema>;
export type UpdateRouteStopDTO = z.infer<typeof UpdateRouteStopSchema>;

// ── Route stops array (used when saving all stops together) ───────────────────

export const RouteStopsArraySchema = z
  .array(CreateRouteStopSchema)
  .min(2, "Route must have at least 2 stops")
  .refine(
    (stops) => {
      const orders = stops.map((s) => s.sort_order);
      return orders.length === new Set(orders).size;
    },
    { message: "Each stop must have a unique sort_order" }
  )
  .refine(
    (stops) => {
      const sorted = [...stops]
        .sort((a, b) => a.sort_order - b.sort_order)
        .map((s) => s.sort_order);
      return sorted.every((order, i) => order === i);
    },
    { message: "Stop sort_order must be sequential starting from 0" }
  )
  .refine(
    (stops) => {
      const total_stay = stops.reduce((sum, s) => sum + s.stay_days, 0);
      return total_stay >= 1;
    },
    { message: "Total nights across all stops must be at least 1" }
  );

// ── Package route ──────────────────────────────────────────────────────────────

export const CreateRouteSchema = z.object({
  duration_id: z.number().int().positive("Duration is required"),
  name: z
    .string()
    .min(2, "Route name must be at least 2 characters")
    .max(255),
  slug: SlugSchema,
  meta_title: z.string().max(60).optional(),
  meta_desc: z.string().max(160).optional(),
  sort_order: z.number().int().min(0).default(0),
  is_active: z.boolean().default(true),
  total_distance_km: z.number().positive().optional(),
  total_duration_min: z.number().int().positive().optional(),
  stops: RouteStopsArraySchema,
});

export const UpdateRouteSchema = CreateRouteSchema.omit({
  duration_id: true,
  stops: true,
})
  .partial()
  .required({ name: true, slug: true })
  .extend({
    stops: RouteStopsArraySchema.optional(),
  });

export type CreateRouteDTO = z.infer<typeof CreateRouteSchema>;
export type UpdateRouteDTO = z.infer<typeof UpdateRouteSchema>;

// ── Reorder stops (drag-and-drop) ─────────────────────────────────────────────

export const ReorderStopsSchema = z.object({
  route_id: z.number().int().positive(),
  stops: z
    .array(
      z.object({
        id: z.number().int().positive(),
        sort_order: z.number().int().min(0),
      })
    )
    .min(2, "Must provide at least 2 stops to reorder")
    .refine(
      (items) => {
        const orders = items.map((s) => s.sort_order);
        return orders.length === new Set(orders).size;
      },
      { message: "Duplicate sort_order values in reorder payload" }
    ),
});

export type ReorderStopsDTO = z.infer<typeof ReorderStopsSchema>;
