import "server-only";
import { db } from "@/app/lib/db";
import { computePackagePrice } from "@/app/services/package-pricing.service";
import { computeInputsHash, verifyQuote, money2dp, type QuoteSignaturePayload } from "./signing";
import type { QuoteParsed } from "./schema";
import type { PricingInput } from "@/app/services/package-pricing.service";
import type { SafeQuote } from "./create-quote.service";

/**
 * getQuote — fetch a persisted quote, prove its integrity, and apply lazy
 * expiry. isQuoteFresh — recompute today's price for the locked inputs and
 * compare to the sealed total, so a quote whose underlying rates moved can be
 * caught before payment.
 */

type QuoteRow = NonNullable<Awaited<ReturnType<typeof db.package_quote.findUnique>>>;

export type GetQuoteResult =
    | { success: true; quote: SafeQuote }
    | { success: false; reason: "not_found" | "invalid" };

// ── Mapping helpers ──────────────────────────────────────────────────────────

function travelDateISO(d: Date): string {
    return d.toISOString().slice(0, 10);
}

/** `rooms` is stored as Json — reconstruct the typed shape defensively rather
 *  than trusting the column's runtime contents blindly. */
export function parseRoomsJson(value: unknown): { adults: number; children: number }[] {
    if (!Array.isArray(value)) return [];
    return value.filter(
        (r): r is { adults: number; children: number } =>
            !!r && typeof r === "object"
            && Number.isInteger((r as Record<string, unknown>).adults)
            && Number.isInteger((r as Record<string, unknown>).children),
    );
}

/** The subset of fields computeInputsHash reads, rebuilt from a stored row. */
function rowHashInput(row: QuoteRow): QuoteParsed {
    return {
        package_id:       row.package_id,
        duration_id:      row.duration_id,
        route_id:         row.route_id,
        stay_category_id: row.stay_category_id,
        package_slug:     row.package_slug,
        duration_slug:    row.duration_slug,
        route_slug:       row.route_slug,
        stay_slug:        row.stay_slug,
        adults:           row.adults,
        children:         row.children,
        infants:          row.infants,
        child_ages:       row.child_ages,
        cab_type_ids:     row.cab_type_ids,
        rooms:            parseRoomsJson(row.rooms),
        travel_date:      travelDateISO(row.travel_date),
    };
}

function rowSigPayload(row: QuoteRow): QuoteSignaturePayload {
    return {
        inputs_hash:     row.inputs_hash,
        currency:        row.currency,
        base_cost:       money2dp(row.base_cost.toString()),
        margin_amount:   money2dp(row.margin_amount.toString()),
        gst_amount:      money2dp(row.gst_amount.toString()),
        total_amount:    money2dp(row.total_amount.toString()),
        price_per_adult: money2dp(row.price_per_adult.toString()),
        expires_at:      row.expires_at.toISOString(),
    };
}

function rowToSafeQuote(
    row: QuoteRow,
    labels: { gst_percentage: number; duration_label: string; stay_category_label: string },
): SafeQuote {
    return {
        id:                  row.id,
        package_slug:        row.package_slug,
        duration_slug:       row.duration_slug,
        route_slug:          row.route_slug,
        stay_slug:           row.stay_slug,
        duration_label:      labels.duration_label,
        stay_category_label: labels.stay_category_label,
        adults:          row.adults,
        children:        row.children,
        infants:         row.infants,
        travel_date:     travelDateISO(row.travel_date),
        currency:        row.currency,
        total_amount:    Number(row.total_amount),
        price_per_adult: Number(row.price_per_adult),
        gst_amount:      Number(row.gst_amount),
        gst_percentage:  labels.gst_percentage,
        status:          row.status,
        expires_at:      row.expires_at.toISOString(),
        created_at:      row.created_at.toISOString(),
    };
}

// ── getQuote ─────────────────────────────────────────────────────────────────

export async function getQuote(id: string): Promise<GetQuoteResult> {
    if (!id) return { success: false, reason: "not_found" };

    const row = await db.package_quote.findUnique({ where: { id } });
    if (!row) return { success: false, reason: "not_found" };

    // Integrity: the stored selectors must still hash to the sealed inputs_hash,
    // AND the HMAC over the money snapshot must verify. Either failing = tampered.
    const recomputedHash = computeInputsHash(rowHashInput(row));
    if (recomputedHash !== row.inputs_hash) return { success: false, reason: "invalid" };
    if (!verifyQuote(rowSigPayload(row), row.signature)) return { success: false, reason: "invalid" };

    // Lazy expiry: flip ACTIVE → EXPIRED once past expires_at (no cron needed).
    let status = row.status;
    if (status === "ACTIVE" && row.expires_at.getTime() <= Date.now()) {
        status = "EXPIRED";
        await db.package_quote.update({ where: { id: row.id }, data: { status } });
    }

    // Display labels & gst% live only inside the frozen breakdown JSON.
    const bd = row.breakdown as
        | { gst_percentage?: number; duration_label?: string; stay_category_label?: string }
        | null;
    const labels = {
        gst_percentage:      bd?.gst_percentage ?? 0,
        duration_label:      bd?.duration_label ?? row.duration_slug,
        stay_category_label: bd?.stay_category_label ?? row.stay_slug,
    };

    return { success: true, quote: rowToSafeQuote({ ...row, status }, labels) };
}

// ── isQuoteFresh ─────────────────────────────────────────────────────────────

export interface QuoteFreshness {
    fresh: boolean;            // current price still equals the locked total
    lockedTotal: number;       // amount sealed into the quote
    currentTotal: number | null; // recomputed today (null if no longer priceable)
    drift: number;             // currentTotal - lockedTotal (0 when not priceable)
}

/**
 * Recompute the price for a quote's locked inputs and compare to the sealed
 * total. Used at payment time (and optionally on review load) to refuse a stale
 * lock whose underlying rates changed. Does NOT mutate the quote.
 */
export async function isQuoteFresh(id: string): Promise<QuoteFreshness | null> {
    const row = await db.package_quote.findUnique({ where: { id } });
    if (!row) return null;

    const lockedTotal = Number(money2dp(row.total_amount.toString()));
    const rooms = parseRoomsJson(row.rooms);

    let currentTotal: number | null = null;
    try {
        const bd = await computePackagePrice({
            package_id:       row.package_id,
            duration_id:      row.duration_id,
            route_id:         row.route_id,
            stay_category_id: row.stay_category_id,
            adults:           row.adults,
            children:         row.children,
            infants:          row.infants,
            child_ages:       row.child_ages,
            cab_type_ids:     row.cab_type_ids.length ? row.cab_type_ids : null,
            rooms:            rooms.length ? rooms : null,
            travel_date:      travelDateISO(row.travel_date),
        });
        // A config that became un-priceable counts as drift (not fresh).
        if (!bd.missing_pricing_config) currentTotal = Number(money2dp(bd.final_price));
    } catch (err) {
        console.error("[isQuoteFresh] recompute failed", err);
    }

    if (currentTotal === null) {
        return { fresh: false, lockedTotal, currentTotal: null, drift: 0 };
    }
    const drift = Number((currentTotal - lockedTotal).toFixed(2));
    return { fresh: drift === 0, lockedTotal, currentTotal, drift };
}
