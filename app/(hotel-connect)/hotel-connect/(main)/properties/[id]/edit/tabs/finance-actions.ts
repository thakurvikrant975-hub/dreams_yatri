"use server";

import { redirect } from "next/navigation";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";
import { uploadToR2 } from "@/app/lib/r2/r2upload";
import { r2, R2_BUCKET } from "@/app/lib/r2/r2";
import { HotelBusinessType, Prisma } from "@/app/generated/prisma";

export type FinanceState = { ok?: boolean; error?: string };

/** Sniffs the actual file signature instead of trusting client-supplied file.type. */
function sniffDocumentType(buf: Buffer): string | null {
  if (buf.length >= 4 && buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) {
    return "application/pdf"; // %PDF
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
    return "image/jpeg";
  }
  if (buf.length >= 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    return "image/png"; // \x89PNG
  }
  return null;
}

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

  const relationship_doc_type = (formData.get("relationship_doc_type") as string | null) || null;
  const ownership_type        = (formData.get("ownership_type")        as string | null) || null;
  const id_proof_type         = (formData.get("id_proof_type")         as string | null) || null;

  // Format validation — mirrors homestay-finance-actions.ts's rules so both
  // wizard paths agree on what a valid bank account/IFSC/GSTIN/PAN looks like.
  if (bank_account_number && !/^\d{6,20}$/.test(bank_account_number)) {
    return { error: "Bank account number must be 6-20 digits, numbers only." };
  }
  if (bank_ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank_ifsc_code)) {
    return { error: "Invalid IFSC code format. Example: SBIN0001234" };
  }
  if (gstin_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin_number)) {
    return { error: "Invalid GSTIN format. Example: 27AAPFU0939F1ZV" };
  }
  if (pan_number && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan_number)) {
    return { error: "Invalid PAN format. Example: ABCDE1234F" };
  }

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
        relationship_doc_type,
        ownership_type,
        id_proof_type,
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

    // Don't trust the client-supplied file.type — sniff the actual bytes so
    // an arbitrary file can't be uploaded and served from R2 under a
    // "trusted" document key just by spoofing its declared content type.
    const kind = sniffDocumentType(buffer);
    if (!kind) {
      return { error: "Only JPG, PNG, or PDF files are allowed for documents." };
    }

    const { url } = await uploadToR2({
      file: buffer,
      folder: "hotel-docs",
      fileName: file.name,
      contentType: kind,
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
