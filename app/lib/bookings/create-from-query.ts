import "server-only";
import { randomBytes } from "crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/app/lib/db";
import { logTimeline } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";

function genBookingNumber(): string {
    const d = new Date();
    const ymd = `${String(d.getFullYear()).slice(2)}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `DY-${ymd}-${randomBytes(3).toString("hex").toUpperCase()}`;
}

export type CreateBookingFromQueryResult =
    | { created: true; bookingId: string; bookingNumber: string }
    | { created: false; reason: string };

/**
 * Best-effort auto-creation of a real Booking row when a sales query is marked
 * Converted. Leads aren't authenticated Users and only carry a free-text
 * destination string, so this fills in what it reliably can (customer account,
 * destination lookup, dates/price from the custom package if one was built)
 * and creates a PENDING_REVIEW shell for ops to verify — or skips creation and
 * leaves a timeline note when a required field (destination match, travel
 * date) can't be resolved, rather than fabricating business-critical data.
 */
export async function tryCreateBookingFromConvertedQuery(
    queryId: string,
    actorId: string | null | undefined,
    actorName: string | null | undefined,
): Promise<CreateBookingFromQueryResult> {
    try {
        const existing = await db.booking.findUnique({
            where: { sourceQueryId: queryId },
            select: { id: true, bookingNumber: true },
        });
        if (existing) return { created: true, bookingId: existing.id, bookingNumber: existing.bookingNumber };

        const query = await db.package_queries.findUnique({
            where: { id: queryId },
            include: { custom_packages: true },
        });
        if (!query) return { created: false, reason: "Query not found" };

        // A query can now have several packages built for it — prefer the one
        // the client actually accepted, then the most recently sent one, then
        // just whatever exists, rather than assuming there's only ever one.
        const cp =
            query.custom_packages.find((p) => p.status === "ACCEPTED") ??
            query.custom_packages.find((p) => p.status === "SENT") ??
            query.custom_packages[0] ??
            null;

        const destinationName = (cp?.destination ?? query.destination ?? "").split(",")[0]?.trim();
        if (!destinationName) {
            await logTimeline(queryId, "⚠️ Booking not auto-created — no destination on file. Create manually via Package Bookings.", actorId ?? undefined, actorName ?? undefined);
            return { created: false, reason: "No destination on file" };
        }

        const destination =
            (await db.destinations.findFirst({ where: { name: { equals: destinationName, mode: "insensitive" } } })) ??
            (await db.destinations.findFirst({ where: { name: { contains: destinationName, mode: "insensitive" } } }));
        if (!destination) {
            await logTimeline(queryId, `⚠️ Booking not auto-created — destination "${destinationName}" not found in catalog. Create manually via Package Bookings.`, actorId ?? undefined, actorName ?? undefined);
            return { created: false, reason: `Destination "${destinationName}" not found in catalog` };
        }

        const startDate = cp?.travelDate ?? query.travelDate;
        if (!startDate) {
            await logTimeline(queryId, "⚠️ Booking not auto-created — no travel date on file. Create manually via Package Bookings.", actorId ?? undefined, actorName ?? undefined);
            return { created: false, reason: "No travel date on file" };
        }

        const duration = cp?.totalDays ?? 1;
        const endDate = new Date(startDate.getTime() + duration * 86_400_000);
        const travellers = cp ? cp.adults + cp.children + cp.infants : (query.groupSize ?? 1);
        const totalAmount = cp?.totalPrice ?? 0;
        const currency = cp?.currency ?? "INR";

        let user = query.phone ? await db.user.findUnique({ where: { phone: query.phone } }) : null;
        if (!user && query.email) {
            user = await db.user.findUnique({ where: { email: query.email } });
        }
        if (!user) {
            user = await db.user.create({
                data: {
                    phone: query.phone || undefined,
                    name: query.name,
                    email: query.email ?? undefined,
                },
            });
        }

        const booking = await db.booking.create({
            data: {
                bookingNumber: genBookingNumber(),
                userId: user.id,
                destinationId: destination.id,
                tripType: "Leisure",
                startDate,
                endDate,
                duration,
                travellers,
                totalAmount,
                currency,
                status: "PENDING_REVIEW",
                sourceQueryId: query.id,
                convertedAt: new Date(),
                salesAgentId: actorId ?? null,
                salesAgentName: actorName ?? null,
                contactEmail: query.email,
                contactPhone: query.phone,
                notes: "Auto-created from converted sales query — verify pricing, dates & traveller count before confirming.",
            },
            select: { id: true, bookingNumber: true },
        });

        await logTimeline(
            queryId,
            `🎉 Booking auto-created (${booking.bookingNumber}) — pending ops review`,
            actorId ?? undefined,
            actorName ?? undefined,
            { bookingId: booking.id, bookingNumber: booking.bookingNumber },
        );

        revalidatePath("/dashboard/package-bookings");

        return { created: true, bookingId: booking.id, bookingNumber: booking.bookingNumber };
    } catch (err) {
        console.error("tryCreateBookingFromConvertedQuery error:", err);
        await logTimeline(queryId, "⚠️ Booking auto-creation failed — create manually via Package Bookings.", actorId ?? undefined, actorName ?? undefined);
        return { created: false, reason: "Unexpected error" };
    }
}
