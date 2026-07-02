import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import { LocationType } from "@/app/generated/prisma";
import { z } from "zod";
import { createLog } from "@/app/(dashboard)/dashboard/(main)/lib/logger";

const schema = z.object({
  name:        z.string().min(1, "Name is required"),
  type:        z.string().min(1, "Type is required"),
  country:     z.string().optional(),
  state:       z.string().optional(),
  city:        z.string().optional(),
  latitude:    z.string().optional(),
  longitude:   z.string().optional(),
  description: z.string().optional(),
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase and hyphens only"),
  is_featured: z.boolean().default(false),
});

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 120);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = schema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validation failed", details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { type, country, state, latitude, longitude, description, slug, is_featured } =
      parsed.data;
    const name = parsed.data.name.charAt(0).toUpperCase() + parsed.data.name.slice(1);

    // ── Slug uniqueness ──────────────────────────────────────────────────────
    const existing = await db.location.findUnique({ where: { slug } });
    if (existing) {
      return NextResponse.json(
        { error: "This slug is already taken. Try a different one." },
        { status: 409 }
      );
    }

    // ── Resolve parent IDs ───────────────────────────────────────────────────
    let countryId: bigint | null = null;
    let stateId:   bigint | null = null;
    let parentId:  bigint | null = null;

    if (country) {
      const dbCountry = await db.location.findFirst({
        where: { type: "COUNTRY", name: { equals: country, mode: "insensitive" } },
        select: { id: true },
      });
      if (dbCountry) { countryId = dbCountry.id; parentId = dbCountry.id; }
    }

    if (state && countryId) {
      const dbState = await db.location.findFirst({
        where: {
          type:       "STATE",
          country_id: countryId,
          name:       { equals: state, mode: "insensitive" },
        },
        select: { id: true },
      });
      if (dbState) { stateId = dbState.id; parentId = dbState.id; }
    }

    // ── Create ───────────────────────────────────────────────────────────────
    const lat = latitude  ? parseFloat(latitude)  : null;
    const lng = longitude ? parseFloat(longitude) : null;

    const created = await db.location.create({
      data: {
        name,
        type:        type as LocationType,
        slug,
        description: description || null,
        latitude:    lat != null ? String(lat)  : null,
        longitude:   lng != null ? String(lng) : null,
        parent_id:   parentId,
        country_id:  countryId,
        state_id:    stateId,
        is_active:   true,
        is_searchable: true,
        is_featured,
        is_popular: false,
        metadata: { source: "manual" },
      },
      select: { id: true, name: true, slug: true, type: true },
    });

    // Build breadcrumb
    const parts = [created.name];
    if (state)   parts.push(state);
    if (country) parts.push(country);

    await createLog({
      action: "CREATE",
      entity: "Location",
      entityId: created.id.toString(),
      entitySlug: created.slug,
      newData: { name: created.name, slug: created.slug, type: created.type },
    });

    return NextResponse.json({
      id:        created.id.toString(),
      name:      created.name,
      slug:      created.slug,
      type:      created.type,
      breadcrumb: parts.join(", "),
      latitude:  lat,
      longitude: lng,
    }, { status: 201 });
  } catch (e) {
    console.error("[locations/create]", e);
    return NextResponse.json({ error: "Failed to create location" }, { status: 500 });
  }
}
