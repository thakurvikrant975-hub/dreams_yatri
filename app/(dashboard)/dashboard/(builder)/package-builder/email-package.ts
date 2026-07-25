import { db } from "@/app/lib/db";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { packageItineraryTemplate, packageItineraryTextTemplate } from "@/app/components/email-template/packageItineraryTemplate";

/**
 * Emails the client a full, branded copy of their itinerary — a richer
 * follow-up to sendPackageToClient (which only locks pricing and hands back
 * a WhatsApp link). Called explicitly from the "Send to Client" popup's
 * Email option, never automatically, since a WhatsApp-only send shouldn't
 * silently also fire an email the exec never chose to send.
 *
 * Plain module (no "use server") invoked from a Route Handler, not a Server
 * Action — see app/api/package-builder/send-email/route.ts for why.
 *
 * Reads pricing/details straight from the DB row sendPackageToClient just
 * locked (never recomputes) — this is purely a notification step, not
 * another pricing pass.
 */
export async function emailPackageToClient(
  packageId: string,
  pdfAttachment?: { filename: string; content: string } | null,
): Promise<{ success: boolean; error?: string }> {
  try {
    const pkg = await db.custom_packages.findUnique({
      where:   { id: packageId },
      include: { query: true, stops: { orderBy: { sortOrder: "asc" } } },
    });

    if (!pkg) return { success: false, error: "Package not found" };
    if (!pkg.query) return { success: false, error: "This package isn't linked to a client query yet." };
    if (!pkg.query.email) return { success: false, error: "This client has no email address on file." };
    if (pkg.totalPrice == null) return { success: false, error: "Send the package first so pricing is locked, then email it." };

    // Falls back to the real production domain, not localhost — see the same
    // fallback in sendPackageToClient (action.ts) for why.
    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "https://dreamsyatri.org";
    const shareUrl = `${baseUrl}/custom-package/${packageId}`;

    // Same "Your Travel Manager" name the public custom-package page shows.
    const exec = pkg.query.assignedTo
      ? await db.teamMember.findUnique({
          where:  { id: pkg.query.assignedTo },
          select: { name: true },
        })
      : null;

    const travelDateStr = pkg.travelDate
      ? new Date(pkg.travelDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
      : "TBD";
    const paxLine =
      `${pkg.adults} Adult${pkg.adults !== 1 ? "s" : ""}` +
      (pkg.children ? `, ${pkg.children} Child${pkg.children !== 1 ? "ren" : ""}` : "") +
      (pkg.infants  ? `, ${pkg.infants} Infant${pkg.infants !== 1 ? "s" : ""}` : "");
    const routeLine = pkg.stops.map((s) => s.name).join(" → ") || pkg.destination;
    const priceStr = `${pkg.currency} ${pkg.totalPrice.toLocaleString("en-IN")}`;
    const perPersonStr = pkg.pricePerPerson != null
      ? `${pkg.currency} ${pkg.pricePerPerson.toLocaleString("en-IN")} / person`
      : null;

    const templateParams = {
      clientName:       pkg.query.name,
      packageTitle:     pkg.title,
      routeLine,
      coverImage:       pkg.coverImage,
      destination:      pkg.destination,
      travelDateStr,
      durationStr:      `${pkg.totalDays} Days / ${pkg.totalNights} Nights`,
      paxLine,
      priceStr,
      perPersonStr,
      shareUrl,
      hasPdfAttachment: !!pdfAttachment,
      execName: exec?.name ?? null,
    };
    const emailHtml = packageItineraryTemplate(templateParams);
    const emailText = packageItineraryTextTemplate(templateParams);

    const sent = await sendEmail({
      to:      pkg.query.email,
      subject: `Your ${pkg.title} itinerary is ready`,
      html:    emailHtml,
      text:    emailText,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });

    if (!sent) return { success: false, error: "Email failed to send. Please try again." };
    return { success: true };
  } catch (err) {
    console.error("[emailPackageToClient]", err);
    return { success: false, error: "Failed to send email" };
  }
}
