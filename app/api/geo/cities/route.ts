import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const q       = searchParams.get("q")?.trim() ?? "";
  const stateId = searchParams.get("stateId");

  if (!stateId) return NextResponse.json([]);

  const rows = await db.location.findMany({
    where: {
      type:      "CITY",
      is_active: true,
      state_id:  BigInt(stateId),
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    200,
  });

  return NextResponse.json(rows.map(r => ({ id: Number(r.id), name: r.name })));
}
