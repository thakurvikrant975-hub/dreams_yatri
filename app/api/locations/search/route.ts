import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get("q")?.trim() ?? "";
    const typesParam = searchParams.get("types");
    const types = typesParam
      ? (typesParam.split(",").filter(Boolean) as LocationType[])
      : undefined;
    // Higher cap for preload requests (e.g. countries list)
    const limit = Math.min(Number(searchParams.get("limit") ?? "8"), 500);

    // Allow type-only queries (no text) so callers can preload all items of a type
    if (q.length < 2 && !types?.length) return NextResponse.json([]);

    const rows = await db.location.findMany({
      where: {
        is_active: true,
        OR: [
          { name:          { contains: q, mode: "insensitive" } },
          { official_name: { contains: q, mode: "insensitive" } },
        ],
        ...(types?.length ? { type: { in: types } } : {}),
      },
      select: {
        id: true, name: true, type: true, slug: true,
        latitude: true, longitude: true,
        state:   { select: { name: true } },
        country: { select: { name: true } },
      },
      orderBy: [
        { is_featured: "desc" },
        { is_popular:  "desc" },
        { name:        "asc"  },
      ],
      take: limit,
    });

    return NextResponse.json(
      rows.map((r) => {
        const parts = [r.name];
        if (r.state?.name   && r.state.name   !== r.name) parts.push(r.state.name);
        if (r.country?.name && r.country.name !== r.name) parts.push(r.country.name);
        return {
          source:    "local",
          id:        r.id.toString(),
          name:      r.name,
          type:      r.type,
          slug:      r.slug,
          breadcrumb: parts.join(", "),
          latitude:  r.latitude  != null ? Number(r.latitude)  : null,
          longitude: r.longitude != null ? Number(r.longitude) : null,
        };
      }),
    );
  } catch (e) {
    console.error("[locations/search]", e);
    return NextResponse.json([], { status: 500 });
  }
}
