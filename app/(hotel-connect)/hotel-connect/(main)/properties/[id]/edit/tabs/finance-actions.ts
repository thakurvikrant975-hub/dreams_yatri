"use server";

import { redirect } from "next/navigation";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { r2, R2_BUCKET } from "@/app/lib/r2/r2";
import { HotelBusinessType, Prisma } from "@/app/generated/prisma";

export type FinanceState = { ok?: boolean; error?: string };

export async function saveFinance(
  hotelId: number,
  _prev: FinanceState,
  formData: FormData,
): Promise<FinanceState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  const bank_account_number = (formData.get("bank_account_number") as string | null)?.trim() || null;
  const bank_ifsc_code      = (formData.get("bank_ifsc_code")      as string | null)?.trim().toUpperCase() || null;
  const bank_name           = (formData.get("bank_name")           as string | null)?.trim() || null;
  const bank_consent_given  = formData.get("bank_consent_given") === "yes";

  const gstin_number = (formData.get("gstin_number") as string | null)?.trim().toUpperCase() || null;
  const pan_number   = (formData.get("pan_number")   as string | null)?.trim().toUpperCase() || null;
  const btRaw        = formData.get("business_type") as string | null;
  const business_type =
    btRaw && Object.values(HotelBusinessType).includes(btRaw as HotelBusinessType)
      ? (btRaw as HotelBusinessType)
      : null;
  const msme_number = (formData.get("msme_number") as string | null)?.trim() || null;

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: {
        bank_account_number,
        bank_ifsc_code,
        bank_name,
        bank_consent_given,
        gstin_number,
        pan_number,
        business_type,
        msme_number,
        wizard_step: Math.max(hotel.wizard_step, 7),
      },
    });
  } catch (err) {
    console.error("[saveFinance]", err);
    return { error: "Failed to save finance details. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=7`);
}

// ── Document upload ───────────────────────────────────────────────────────────

export async function uploadFinanceDocument(
  hotelId: number,
  docType: string,
  formData: FormData,
): Promise<{ error?: string; url?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, property_documents: true },
  });
  if (!hotel) return { error: "Property not found." };

  const file = formData.get("document") as File | null;
  if (!file || file.size === 0) return { error: "No file selected." };
  if (file.size > 15 * 1024 * 1024) return { error: "File must be 15 MB or smaller." };

  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    const { url } = await uploadToR2({
      file: buffer,
      folder: "hotel-docs",
      fileName: file.name,
      contentType: file.type || "application/octet-stream",
    });

    const existing = (hotel.property_documents as Record<string, string> | null) ?? {};
    await db.hotels.update({
      where: { id: hotelId },
      data: { property_documents: { ...existing, [docType]: url } },
    });

    return { url };
  } catch (err) {
    console.error("[uploadFinanceDocument]", err);
    return { error: err instanceof Error ? err.message : "Upload failed." };
  }
}

export async function removeFinanceDocument(
  hotelId: number,
  docType: string,
): Promise<{ error?: string }> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, property_documents: true },
  });
  if (!hotel) return { error: "Property not found." };

  const existing = (hotel.property_documents as Record<string, string> | null) ?? {};
  const url = existing[docType];

  if (url) {
    const base = (process.env.NEXT_PUBLIC_R2_PUBLIC_URL ?? "").replace(/\/$/, "");
    const key = url.startsWith(base + "/") ? url.slice(base.length + 1) : null;
    if (key) {
      try {
        await r2.send(new DeleteObjectCommand({ Bucket: R2_BUCKET, Key: key }));
      } catch {
        // best-effort
      }
    }
  }

  const updated = { ...existing };
  delete updated[docType];

  await db.hotels.update({
    where: { id: hotelId },
    data: {
      property_documents: Object.keys(updated).length
        ? updated
        : Prisma.DbNull,
    },
  });

  return {};
}
