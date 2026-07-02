"use server";

import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import { db } from "@/app/lib/db";

export type HomestayFinanceState = { error?: string };

export async function saveHomestayFinance(
  hotelId: number,
  _prev: HomestayFinanceState,
  formData: FormData,
): Promise<HomestayFinanceState> {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  const hotel = await db.hotels.findFirst({
    where: { id: hotelId, owner_id: session.user.id },
    select: { id: true, wizard_step: true },
  });
  if (!hotel) return { error: "Property not found." };

  // ── Ownership Details ───────────────────────────────────────────────────────
  const ownership_type        = (formData.get("ownership_type")        as string | null) || null;
  const has_registration_doc  = formData.get("has_registration_doc") === "yes"
    ? true : formData.get("has_registration_doc") === "no" ? false : null;
  const relationship_doc_type = (formData.get("relationship_doc_type") as string | null) || null;

  // ── ID Proof ────────────────────────────────────────────────────────────────
  const id_proof_type = (formData.get("id_proof_type") as string | null) || null;

  // ── Banking Details ─────────────────────────────────────────────────────────
  const bank_account_number  = (formData.get("bank_account_number")  as string | null)?.trim() || null;
  const bank_account_confirm = (formData.get("bank_account_confirm") as string | null)?.trim() || null;

  // Reject if the two account fields differ in any way (including one empty, one not)
  if (bank_account_number !== bank_account_confirm) {
    return { error: "Account numbers do not match. Please re-enter and try again." };
  }

  const bank_ifsc_code = (formData.get("bank_ifsc_code") as string | null)?.trim().toUpperCase() || null;
  const bank_name      = (formData.get("bank_name")      as string | null)?.trim() || null;

  const gstin_number = (formData.get("gstin_number") as string | null)?.trim().toUpperCase() || null;
  const pan_number   = (formData.get("pan_number")   as string | null)?.trim().toUpperCase() || null;
  const tan_number   = (formData.get("tan_number")   as string | null)?.trim().toUpperCase() || null;

  // Format validation
  if (bank_ifsc_code && !/^[A-Z]{4}0[A-Z0-9]{6}$/.test(bank_ifsc_code)) {
    return { error: "Invalid IFSC code format. Example: SBIN0001234" };
  }
  if (gstin_number && !/^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(gstin_number)) {
    return { error: "Invalid GSTIN format. Example: 27AAPFU0939F1ZV" };
  }
  if (tan_number && !/^[A-Z]{4}[0-9]{5}[A-Z]$/.test(tan_number)) {
    return { error: "Invalid TAN format. Example: PDES03028F" };
  }

  try {
    await db.hotels.update({
      where: { id: hotelId },
      data: {
        ownership_type,
        has_registration_doc,
        relationship_doc_type,
        id_proof_type,
        bank_account_number,
        bank_ifsc_code,
        bank_name,
        gstin_number,
        pan_number,
        tan_number,
        wizard_step: Math.max(hotel.wizard_step, 8),
      },
    });
  } catch (err) {
    console.error("[saveHomestayFinance]", err);
    return { error: "Failed to save finance details. Please try again." };
  }

  redirect(`/hotel-connect/properties/${hotelId}/edit?tab=8`);
}
