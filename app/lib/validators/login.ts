// app/api/user/profile/route.ts

import { NextRequest }        from "next/server";
import { z }                  from "zod/v4";
import { db }                 from "@/app/lib/db";
import { ApiResponse }        from "@/app/lib/api-response";
import { handleApiError }     from "@/app/lib/api-error";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { Gender, MaritalStatus } from "@/app/generated/prisma";

// ─── Zod Schemas ──────────────────────────────────────────────────────────────

const patchProfileSchema = z.object({
  name:                   z.string().min(1).max(100).optional(),
  email:                  z.email().optional(),
  gender:                 z.enum(Object.values(Gender) as [string, ...string[]]).optional(),
  dateOfBirth:            z.string().date().optional(),
  nationality:            z.string().min(1).max(100).optional(),
  state:                  z.string().min(1).max(100).optional(),
  city:                   z.string().min(1).max(100).optional(),
  maritalStatus:          z.enum(Object.values(MaritalStatus) as [string, ...string[]]).optional(),
  anniversary:            z.string().date().optional(),
  passportNumber:         z.string().min(5).max(20).optional(),
  passportExpiryDate:     z.string().date().optional(),
  passportIssuingCountry: z.string().min(1).max(100).optional(),
  panNumber:              z.string().regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, "Invalid PAN format").optional(),
  country_code:           z.string().min(1).max(6).optional(),
});

const deleteProfileSchema = z.object({
  confirmation_title: z.string().min(1, "confirmation_title is required"),
});

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    const user = await db.user.findUnique({
      where:  { id: sessionUser.id },
      select: {
        id:                     true,
        phone:                  true,
        country_code:           true,
        name:                   true,
        email:                  true,
        gender:                 true,
        dateOfBirth:            true,
        nationality:            true,
        maritalStatus:          true,
        anniversary:            true,
        state:                  true,
        city:                   true,
        passportNumber:         true,
        passportExpiryDate:     true,
        passportIssuingCountry: true,
        panNumber:              true,
        isProfileComplete:      true,
        createdAt:              true,
        updatedAt:              true,
      },
    });

    if (!user) return ApiResponse.notFound("User");

    return ApiResponse.ok(user);

  } catch (error) {
    return handleApiError(error);
  }
}

// ─── PATCH ────────────────────────────────────────────────────────────────────

export async function PATCH(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    // ── Parse & validate body ────────────────────────────────────────────────
    const body   = await req.json();
    const parsed = patchProfileSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? "Validation error";
      return ApiResponse.badRequest(message);
    }

    const {
      name, email, gender, dateOfBirth, nationality, state, city,
      maritalStatus, anniversary, passportNumber, passportExpiryDate,
      passportIssuingCountry, panNumber, country_code,
    } = parsed.data;

    // ── Business rule — anniversary only for married ──────────────────────────
    if (anniversary && maritalStatus && maritalStatus !== MaritalStatus.MARRIED) {
      return ApiResponse.badRequest("Anniversary can only be set for married users.");
    }

    // ── Build update payload ─────────────────────────────────────────────────
    const data: Record<string, unknown> = {};

    if (name                    !== undefined) data.name                   = name;
    if (email                   !== undefined) data.email                  = email;
    if (gender                  !== undefined) data.gender                 = gender;
    if (nationality             !== undefined) data.nationality            = nationality;
    if (state                   !== undefined) data.state                  = state;
    if (city                    !== undefined) data.city                   = city;
    if (maritalStatus           !== undefined) data.maritalStatus          = maritalStatus;
    if (passportNumber          !== undefined) data.passportNumber         = passportNumber;
    if (passportIssuingCountry  !== undefined) data.passportIssuingCountry = passportIssuingCountry;
    if (country_code            !== undefined) data.country_code           = country_code;
    if (panNumber               !== undefined) data.panNumber              = panNumber.toUpperCase();
    if (dateOfBirth             !== undefined) data.dateOfBirth            = new Date(dateOfBirth);
    if (anniversary             !== undefined) data.anniversary            = new Date(anniversary);
    if (passportExpiryDate      !== undefined) data.passportExpiryDate     = new Date(passportExpiryDate);

    if (Object.keys(data).length === 0) {
      return ApiResponse.badRequest("No fields provided to update.");
    }

    // ── Update user ──────────────────────────────────────────────────────────
    const updatedUser = await db.user.update({
      where: { id: sessionUser.id },
      data,
    });

    // ── Auto-compute profile completeness ─────────────────────────────────────
    const requiredFields = ["name", "email", "gender", "dateOfBirth", "nationality", "state", "city"] as const;
    const isProfileComplete = requiredFields.every(
      f => updatedUser[f] !== null && updatedUser[f] !== undefined
    );

    const finalUser = await db.user.update({
      where:  { id: sessionUser.id },
      data:   { isProfileComplete },
      select: {
        id: true, phone: true, country_code: true, name: true, email: true,
        gender: true, dateOfBirth: true, nationality: true, maritalStatus: true,
        anniversary: true, state: true, city: true, passportNumber: true,
        passportExpiryDate: true, passportIssuingCountry: true, panNumber: true,
        isProfileComplete: true, updatedAt: true,
      },
    });

    return ApiResponse.ok(finalUser);

  } catch (error) {
    return handleApiError(error);
  }
}

// ─── DELETE ───────────────────────────────────────────────────────────────────

export async function DELETE(req: NextRequest) {
  try {
    const sessionUser = await getAuthenticatedUser();
    if (!sessionUser) return ApiResponse.error("Unauthorized", "UNAUTHORIZED", 401);

    // ── Validate body ────────────────────────────────────────────────────────
    const body   = await req.json();
    const parsed = deleteProfileSchema.safeParse(body);

    if (!parsed.success) {
      return ApiResponse.badRequest(parsed.error.issues[0]?.message ?? "Validation error");
    }

    const { confirmation_title } = parsed.data;

    // ── Fetch user name ───────────────────────────────────────────────────────
    const user = await db.user.findUnique({
      where:  { id: sessionUser.id },
      select: { name: true },
    });

    if (!user)       return ApiResponse.notFound("User");
    if (!user.name)  return ApiResponse.badRequest("User has no name set. Cannot verify confirmation.");

    if (confirmation_title !== user.name.toUpperCase()) {
      return ApiResponse.error(
        "confirmation_title does not match. Type your name in capital letters.",
        "FORBIDDEN",
        403
      );
    }

    // ── Soft delete ───────────────────────────────────────────────────────────
    await db.user.update({
      where: { id: sessionUser.id },
      data:  { status: "DELETED" },
    });

    return ApiResponse.ok({ message: "Account deleted successfully." });

  } catch (error) {
    return handleApiError(error);
  }
}