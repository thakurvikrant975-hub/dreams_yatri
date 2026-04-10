// app/api/user/preferences/route.ts

<<<<<<< HEAD
=======
<<<<<<< HEAD
>>>>>>> ee035399dd7093e0ae53f9ea63dfd7c4c6cc4864
import { NextRequest }           from "next/server";
import { z }                     from "zod/v4";
import { db }                    from "@/app/lib/db";
import { ApiResponse }           from "@/app/lib/api-response";
import { handleApiError }        from "@/app/lib/api-error";
import { getAuthenticatedUser }  from "@/app/lib/functions/getAuthenticatedUser";
<<<<<<< HEAD
import { TripType, GroupType, BudgetTier, TripDuration, TravelMonth } from "@/app/generated/prisma";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const patchPreferencesSchema = z.object({
  tripTypes: z.array(
    z.enum(Object.values(TripType) as [string, ...string[]])
  ).optional(),
  groupType: z.enum(Object.values(GroupType)   as [string, ...string[]]).optional(),
  budget:    z.enum(Object.values(BudgetTier)  as [string, ...string[]]).optional(),
  duration:  z.enum(Object.values(TripDuration)as [string, ...string[]]).optional(),
  months:    z.array(
    z.enum(Object.values(TravelMonth) as [string, ...string[]])
  ).optional(),
});

// ─── GET ──────────────────────────────────────────────────────────────────────
=======
import { TripType, GroupType, BudgetTier, TripDuration, TravelMonth } from "@/app/generated/prisma";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const patchPreferencesSchema = z.object({
  tripTypes: z.array(
    z.enum(Object.values(TripType) as [string, ...string[]])
  ).optional(),
  groupType: z.enum(Object.values(GroupType)   as [string, ...string[]]).optional(),
  budget:    z.enum(Object.values(BudgetTier)  as [string, ...string[]]).optional(),
  duration:  z.enum(Object.values(TripDuration)as [string, ...string[]]).optional(),
  months:    z.array(
    z.enum(Object.values(TravelMonth) as [string, ...string[]])
  ).optional(),
});

// ─── GET ──────────────────────────────────────────────────────────────────────
=======
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db"; 
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { TripType, GroupType, BudgetTier, TripDuration, TravelMonth } from "@/app/generated/prisma";

// ─── GET ───────────────────────────────────────────────────────────────────
>>>>>>> profile-api
>>>>>>> ee035399dd7093e0ae53f9ea63dfd7c4c6cc4864

export async function GET() {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const preferences = await db.travelPreference.findUnique({
      where: { userId: sessionUser.id },
    });

    return ApiResponse.ok(preferences);

  } catch (error) {
    return handleApiError(error);
  }
}

<<<<<<< HEAD
// ─── PATCH ────────────────────────────────────────────────────────────────────
=======
<<<<<<< HEAD
// ─── PATCH ────────────────────────────────────────────────────────────────────
=======
// ─── PATCH ─────────────────────────────────────────────────────────────────
>>>>>>> profile-api
>>>>>>> ee035399dd7093e0ae53f9ea63dfd7c4c6cc4864

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const body   = await req.json();
    const parsed = patchPreferencesSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Validation error";
      return ApiResponse.badRequest(message);
    }

    const { tripTypes, groupType, budget, duration, months } = parsed.data;

    // ── Build update payload ─────────────────────────────────────────────────
    const data: Record<string, unknown> = {};
    if (tripTypes !== undefined) data.tripTypes = tripTypes;
    if (groupType !== undefined) data.groupType = groupType;
    if (budget    !== undefined) data.budget    = budget;
    if (duration  !== undefined) data.duration  = duration;
    if (months    !== undefined) data.months    = months;

    if (Object.keys(data).length === 0) {
      return ApiResponse.badRequest("No fields provided to update.");
    }

    const preferences = await db.travelPreference.upsert({
      where:  { userId: sessionUser.id },
      update: data,
      create: { userId: sessionUser.id, ...data },
    });

    return ApiResponse.ok(preferences);

  } catch (error) {
    return handleApiError(error);
  }
}