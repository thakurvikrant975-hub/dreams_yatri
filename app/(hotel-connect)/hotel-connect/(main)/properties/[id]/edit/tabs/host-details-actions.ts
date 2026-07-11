"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";

// ── Types ─────────────────────────────────────────────────────────────────────

export type HostDetailsState = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Partial<Record<string, string[]>>;
};

// ── Schema ────────────────────────────────────────────────────────────────────

const hostDetailsSchema = z.object({
  businessName:         z.string().max(100).optional().or(z.literal("")),
  phone_cc:             z.string().default("+91"),
  phone:                z.string().max(20).optional().or(z.literal("")),
  whatsapp_cc:          z.string().default("+91"),
  whatsapp:             z.string().max(20).optional().or(z.literal("")),
  gender:               z.enum(["male", "female"]).optional().nullable(),
  languages:            z.string().optional().or(z.literal("")),
  founded_year:         z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().min(1900).max(new Date().getFullYear()).optional().nullable()
  ),
  property_count:       z.preprocess(
    (v) => (v == null || v === "" ? 1 : v),
    z.coerce.number().int().min(1).max(9999).default(1)
  ),
  business_description: z.string().max(2000).optional().or(z.literal("")),
  logo_url:             z.string().optional().or(z.literal("")),
}).superRefine((data, ctx) => {
  const checkPhone = (field: "phone" | "whatsapp", cc: string) => {
    const value = data[field];
    if (!value) return;
    const isIndia = cc === "+91";
    const valid = isIndia ? /^\d{10}$/.test(value) : /^\d{5,15}$/.test(value);
    if (!valid) {
      ctx.addIssue({
        code: "custom",
        path: [field],
        message: isIndia ? "Enter a valid 10-digit number" : "Enter a valid number",
      });
    }
  };
  checkPhone("phone", data.phone_cc);
  checkPhone("whatsapp", data.whatsapp_cc);
});

// ── Actions ───────────────────────────────────────────────────────────────────

export async function saveHostDetails(
  _prev: HostDetailsState,
  formData: FormData
): Promise<HostDetailsState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const raw = Object.fromEntries(formData.entries());
  const result = hostDetailsSchema.safeParse(raw);
  if (!result.success) {
    return { fieldErrors: result.error.flatten().fieldErrors };
  }

  const d = result.data;
  const langs = d.languages
    ? d.languages.split(",").map((l) => l.trim()).filter(Boolean)
    : [];

  try {
    await db.hotelOwner.update({
      where: { id: session.user.id },
      data: {
        businessName:         d.businessName         || null,
        phone_cc:             d.phone_cc,
        phone:                d.phone                || null,
        whatsapp_cc:          d.whatsapp_cc,
        whatsapp:             d.whatsapp             || null,
        gender:               d.gender               ?? null,
        languages:            langs,
        founded_year:         d.founded_year         ?? null,
        property_count:       d.property_count,
        business_description: d.business_description || null,
        logo_url:             d.logo_url             || null,
      },
    });
  } catch (err) {
    console.error("[saveHostDetails]", err);
    return { error: "Couldn't save your host details. Please try again." };
  }

  return { ok: true };
}

export async function uploadOwnerLogo(
  formData: FormData
): Promise<{ url?: string; error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const file = formData.get("logo") as File | null;
  if (!file || file.size === 0) return { error: "No file selected." };

  const ALLOWED = ["image/jpeg", "image/png", "image/webp"];
  if (!ALLOWED.includes(file.type)) return { error: "Only JPG, PNG, or WebP allowed." };
  if (file.size < 100 * 1024)       return { error: "File must be at least 100 KB." };
  if (file.size > 15 * 1024 * 1024) return { error: "File must be under 15 MB." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToR2({
      file: buffer,
      folder: "avatars",
      fileName: file.name,
      contentType: file.type,
    });

    await db.hotelOwner.update({
      where: { id: session.user.id },
      data: { logo_url: url },
    });

    return { url };
  } catch (err) {
    console.error("[uploadOwnerLogo]", err);
    return { error: "Couldn't upload your logo. Please try again." };
  }
}
