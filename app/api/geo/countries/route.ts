// app/api/geo/countries/route.ts
import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export async function GET(req: NextRequest) {
  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";

  const countries = await db.countryAll.findMany({
    where:   q ? { name: { contains: q, mode: "insensitive" } } : {},
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    // ← no take limit — return all
  });

  return NextResponse.json(countries);
}