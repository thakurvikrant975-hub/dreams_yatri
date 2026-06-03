import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";

  const rows = await db.location.findMany({
    where: {
      type:      "COUNTRY",
      is_active: true,
      ...(q ? { name: { contains: q, mode: "insensitive" } } : {}),
    },
    select:  { id: true, name: true },
    orderBy: { name: "asc" },
    take:    100,
  });

  return NextResponse.json(rows.map(r => ({ id: Number(r.id), name: r.name })));
}
