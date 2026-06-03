import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q         = searchParams.get("q")?.trim() ?? "";
  const countryId = searchParams.get("countryId");

  if (!countryId) return NextResponse.json([]);

  const rows = await db.location.findMany({
    where: {
      type:       "STATE",
      is_active:  true,
      country_id: BigInt(countryId),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    200,
  });

  return NextResponse.json(rows.map(r => ({ id: Number(r.id), name: r.name })));
}
