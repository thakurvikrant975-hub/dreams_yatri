"use server";

import { db }             from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z }              from "zod";

export type StayTypeFormState = {
  success: boolean;
  message: string;
  id?:     number;
};

export type StayType = {
  id:          number;
  name:        string;
  slug:        string;
  description: string | null;
  sort_order:  number;
  is_active:   boolean;
  _count:      { packages: number };
};

const Schema = z.object({
  name:        z.string().min(1, "Name is required"),
  slug:        z.string().min(1).regex(/^[a-z0-9-]+$/),
  description: z.string().optional(),
  sort_order:  z.coerce.number().int().default(0),
  is_active:   z.boolean().default(true),
});

export async function getStayTypes(): Promise<StayType[]> {
  return db.stay_types.findMany({
    orderBy: { sort_order: "asc" },
    include: { _count: { select: { packages: true } } },
  }) as Promise<StayType[]>;
}

export async function getStayTypesForSelect() {
  return db.stay_types.findMany({
    where:   { is_active: true },
    orderBy: { sort_order: "asc" },
    select:  { id: true, name: true, slug: true },
  });
}

export async function createStayType(
  _prev: StayTypeFormState,
  formData: FormData,
): Promise<StayTypeFormState> {
  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description") || undefined,
    sort_order:  formData.get("sort_order")  || 0,
    is_active:   formData.get("is_active") === "true",
  };

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Validation failed" };

  try {
    const existing = await db.stay_types.findFirst({
      where: { OR: [{ name: parsed.data.name }, { slug: parsed.data.slug }] },
    });
    if (existing) return { success: false, message: "Name or slug already exists" };

    const st = await db.stay_types.create({ data: parsed.data });
    revalidatePath("/dashboard/stay-types");
    return { success: true, message: "Stay type created", id: st.id };
  } catch {
    return { success: false, message: "Database error" };
  }
}

export async function updateStayType(
  id: number,
  _prev: StayTypeFormState,
  formData: FormData,
): Promise<StayTypeFormState> {
  const raw = {
    name:        formData.get("name"),
    slug:        formData.get("slug"),
    description: formData.get("description") || undefined,
    sort_order:  formData.get("sort_order")  || 0,
    is_active:   formData.get("is_active") === "true",
  };

  const parsed = Schema.safeParse(raw);
  if (!parsed.success) return { success: false, message: "Validation failed" };

  try {
    await db.stay_types.update({ where: { id }, data: parsed.data });
    revalidatePath("/dashboard/stay-types");
    return { success: true, message: "Stay type updated" };
  } catch {
    return { success: false, message: "Database error" };
  }
}

export async function toggleStayTypeActive(id: number, is_active: boolean) {
  await db.stay_types.update({ where: { id }, data: { is_active } });
  revalidatePath("/dashboard/stay-types");
}

export async function deleteStayType(id: number): Promise<StayTypeFormState> {
  try {
    const st = await db.stay_types.findUnique({
      where:   { id },
      include: { _count: { select: { packages: true } } },
    });
    if (!st) return { success: false, message: "Not found" };
    if (st._count.packages > 0) {
      return {
        success: false,
        message: `Used in ${st._count.packages} package(s) — remove from packages first`,
      };
    }
    await db.stay_types.delete({ where: { id } });
    revalidatePath("/dashboard/stay-types");
    return { success: true, message: "Deleted" };
  } catch {
    return { success: false, message: "Database error" };
  }
}