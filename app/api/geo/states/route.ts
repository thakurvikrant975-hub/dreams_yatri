// app/api/geo/states/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// app/api/geo/states/route.ts
export async function GET(req: NextRequest) {
  const q         = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const countryId = req.nextUrl.searchParams.get("countryId");
  const limit     = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");

  if (!countryId) return NextResponse.json([]);

  const states = await db.stateAll.findMany({
    where: {
      countryId: parseInt(countryId),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    Math.min(limit, 10),
  });

  return NextResponse.json(states);
}