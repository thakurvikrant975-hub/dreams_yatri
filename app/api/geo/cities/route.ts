// app/api/geo/cities/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const q       = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const stateId = req.nextUrl.searchParams.get("stateId");

  if (!stateId) return NextResponse.json([]);

  const cities = await db.cityAll.findMany({
    where: {
      stateId: parseInt(stateId),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    15,  // ← only cities are limited
  });

  return NextResponse.json(cities);
}