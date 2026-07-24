import { db } from "@/app/lib/db";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { getItinerarySettings } from "@/app/(dashboard)/dashboard/(main)/itinerary-settings/actions";

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

    const baseUrl  = process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    const shareUrl = `${baseUrl}/custom-package/${packageId}`;

    const itinerarySettings = await getItinerarySettings();
    const companyPhone = itinerarySettings?.companyPhone ?? "+91 7807727100";
    const companyEmail = itinerarySettings?.companyEmail ?? "hello@dreamyatri.com";

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

    const emailHtml = [
      `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;background:#ffffff;">`,
        // Header
        `<div style="background:#111827;padding:20px 28px;">`,
          `<span style="color:#ffffff;font-size:18px;font-weight:800;letter-spacing:0.3px;">Dreams<span style="color:#e11d48;">Yatri</span></span>`,
        `</div>`,
        // Cover image
        pkg.coverImage
          ? `<img src="${pkg.coverImage}" alt="${pkg.title}" style="width:100%;height:220px;object-fit:cover;display:block;" />`
          : "",
        `<div style="padding:28px;">`,
          `<h1 style="margin:0 0 4px;color:#111827;font-size:22px;">${pkg.title}</h1>`,
          `<p style="margin:0 0 20px;color:#6b7280;font-size:13px;">${routeLine}</p>`,

          `<p style="color:#374151;font-size:15px;line-height:1.5;">Hi ${pkg.query.name} 👋</p>`,
          `<p style="color:#374151;font-size:15px;line-height:1.5;">Your customised itinerary is ready — here are the details:</p>`,

          `<table style="width:100%;border-collapse:collapse;margin:20px 0;font-size:14px;">`,
            `<tr><td style="padding:8px 0;color:#6b7280;">📍 Destination</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;">${pkg.destination}</td></tr>`,
            `<tr style="border-top:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">📅 Travel Date</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;">${travelDateStr}</td></tr>`,
            `<tr style="border-top:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">🌙 Duration</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;">${pkg.totalDays} Days / ${pkg.totalNights} Nights</td></tr>`,
            `<tr style="border-top:1px solid #f3f4f6;"><td style="padding:8px 0;color:#6b7280;">👥 Travellers</td><td style="padding:8px 0;color:#111827;font-weight:600;text-align:right;">${paxLine}</td></tr>`,
          `</table>`,

          `<div style="background:#fef2f2;border:1px solid #fecdd3;border-radius:10px;padding:16px 20px;margin-bottom:24px;">`,
            `<div style="color:#6b7280;font-size:12px;text-transform:uppercase;letter-spacing:0.4px;">Total Package Price</div>`,
            `<div style="color:#e11d48;font-size:26px;font-weight:800;margin-top:2px;">${priceStr}</div>`,
            perPersonStr ? `<div style="color:#6b7280;font-size:12px;margin-top:2px;">${perPersonStr}</div>` : "",
          `</div>`,

          `<a href="${shareUrl}" style="display:block;text-align:center;padding:14px 24px;background:#e11d48;color:#fff;text-decoration:none;border-radius:8px;font-weight:700;font-size:15px;">View Full Itinerary & Book →</a>`,

          pdfAttachment
            ? `<p style="color:#6b7280;font-size:12px;margin-top:20px;">A detailed PDF copy of this itinerary is attached to this email.</p>`
            : "",

          `<p style="color:#6b7280;font-size:13px;margin-top:28px;">Let us know if you'd like any changes to the plan — we're happy to help!</p>`,
        `</div>`,
        `<div style="background:#f9fafb;padding:18px 28px;border-top:1px solid #f3f4f6;color:#6b7280;font-size:12px;">`,
          `${companyPhone} · ${companyEmail}`,
        `</div>`,
      `</div>`,
    ].join("");

    const sent = await sendEmail({
      to:      pkg.query.email,
      subject: `Your ${pkg.title} itinerary is ready!`,
      html:    emailHtml,
      attachments: pdfAttachment ? [pdfAttachment] : undefined,
    });

    if (!sent) return { success: false, error: "Email failed to send. Please try again." };
    return { success: true };
  } catch (err) {
    console.error("[emailPackageToClient]", err);
    return { success: false, error: "Failed to send email" };
  }
}
