// app/api/geo/countries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

// app/api/geo/countries/route.ts
export async function GET(req: NextRequest) {
  const q     = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  const limit = parseInt(req.nextUrl.searchParams.get("limit") ?? "5");

  const countries = await db.countryAll.findMany({
    where:   q ? { name: { contains: q, mode: "insensitive" } } : {},
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    Math.min(limit, 10), // hard cap at 10
  });

  return NextResponse.json(countries);
}