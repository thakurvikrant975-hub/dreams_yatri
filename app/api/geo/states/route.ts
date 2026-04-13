// app/api/geo/states/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const q         = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const countryId = req.nextUrl.searchParams.get("countryId");

  if (!countryId) return NextResponse.json([]);

  const states = await db.stateAll.findMany({
    where: {
      countryId: parseInt(countryId),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    // ← no take limit — return all states for that country
  });

  return NextResponse.json(states);
}