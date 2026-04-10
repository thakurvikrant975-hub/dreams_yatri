// app/api/user/preferences/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db"; 
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { TripType, GroupType, BudgetTier, TripDuration, TravelMonth } from "@/app/generated/prisma";

// ─── GET ───────────────────────────────────────────────────────────────────
export async function GET() {
  const sessionUser = await getAuthenticatedUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const preferences = await db.travelPreference.findUnique({
    where: { userId: sessionUser.id },
  });

  return NextResponse.json({ preferences });
}

// ─── PATCH ─────────────────────────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  const sessionUser = await getAuthenticatedUser();
  if (!sessionUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const { tripTypes, groupType, budget, duration, months } = body;

  // ── Enum validation ────────────────────────────────────────────────────
  if (tripTypes !== undefined && !tripTypes.every((t: string) => Object.values(TripType).includes(t as TripType))) {
    return NextResponse.json({ error: "Invalid tripTypes value." }, { status: 400 });
  }

  if (groupType !== undefined && !Object.values(GroupType).includes(groupType)) {
    return NextResponse.json({ error: "Invalid groupType value." }, { status: 400 });
  }

  if (budget !== undefined && !Object.values(BudgetTier).includes(budget)) {
    return NextResponse.json({ error: "Invalid budget value." }, { status: 400 });
  }

  if (duration !== undefined && !Object.values(TripDuration).includes(duration)) {
    return NextResponse.json({ error: "Invalid duration value." }, { status: 400 });
  }

  if (months !== undefined && !months.every((m: string) => Object.values(TravelMonth).includes(m as TravelMonth))) {
    return NextResponse.json({ error: "Invalid months value." }, { status: 400 });
  }

  // ── Build update payload ───────────────────────────────────────────────
  const data: Record<string, unknown> = {};
  if (tripTypes !== undefined) data.tripTypes = tripTypes;
  if (groupType !== undefined) data.groupType = groupType;
  if (budget    !== undefined) data.budget    = budget;
  if (duration  !== undefined) data.duration  = duration;
  if (months    !== undefined) data.months    = months;

  if (Object.keys(data).length === 0) {
    return NextResponse.json({ error: "No fields provided to update." }, { status: 400 });
  }

  // ── Upsert ─────────────────────────────────────────────────────────────
  const preferences = await db.travelPreference.upsert({
    where:  { userId: sessionUser.id },
    update: data,
    create: { userId: sessionUser.id, ...data },
  });

  return NextResponse.json({ preferences });
}