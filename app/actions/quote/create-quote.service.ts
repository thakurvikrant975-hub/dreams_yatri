import "server-only";
import { db } from "@/app/lib/db";
import { computePackagePrice } from "@/app/services/package-pricing.service";
import { quoteInputSchema, type QuoteInput, type QuoteErrors } from "./schema";
import {
    computeInputsHash,
    signQuote,
    money2dp,
    type QuoteSignaturePayload,
} from "./signing";

/**
 * createQuote — the single server-authoritative entry point that turns a set of
 * user *selectors* into a signed, persisted, short-lived price lock.
 *
 * Flow: validate → computePackagePrice → reject if un-priceable → snapshot the
 * full breakdown → compute money (2-dp) + inputs hash + expiry → sign → persist
 * → return only a SAFE view (no margin/cost build-up) to the browser.
 */

// ── Public result types ──────────────────────────────────────────────────────

/** What the browser is allowed to see — no base_cost / margin breakdown. */
export interface SafeQuote {
    id: string;
    package_slug: string;
    duration_slug: string;
    route_slug: string;
    stay_slug: string;
    adults: number;
    children: number;
    infants: number;
    travel_date: string; // YYYY-MM-DD
    currency: string;
    total_amount: number;
    price_per_adult: number;
    gst_amount: number;
    gst_percentage: number;
    status: "ACTIVE" | "EXPIRED" | "CONSUMED";
    expires_at: string; // ISO 8601
    created_at: string; // ISO 8601
}

export type CreateQuoteResult =
    | { success: true; quote: SafeQuote }
    | { success: false; error: string; fieldErrors?: QuoteErrors };

// ── TTL ──────────────────────────────────────────────────────────────────────

function ttlMinutes(): number {
    const raw = Number(process.env.QUOTE_TTL_MINUTES);
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
}

// ── Service ──────────────────────────────────────────────────────────────────

export async function createQuote(
    rawInput: QuoteInput,
    opts?: { userId?: string | null },
): Promise<CreateQuoteResult> {
    // 1) Validate — only selectors + pax + date are accepted; never money.
    const parsed = quoteInputSchema.safeParse(rawInput);
    if (!parsed.success) {
        const fieldErrors: QuoteErrors = {};
        for (const issue of parsed.error.issues) {
            const key = issue.path[0] as keyof QuoteErrors | undefined;
            if (key && !fieldErrors[key]) fieldErrors[key] = issue.message;
        }
        return { success: false, error: "Please correct the highlighted fields.", fieldErrors };
    }
    const input = parsed.data;

    // 2) Server-authoritative price. Engine throws on hard failure.
    let breakdown;
    try {
        breakdown = await computePackagePrice({
            package_id:       input.package_id,
            duration_id:      input.duration_id,
            route_id:         input.route_id,
            stay_category_id: input.stay_category_id,
            adults:           input.adults,
            children:         input.children,
            infants:          input.infants,
            child_ages:       input.child_ages,
            cab_type_ids:     input.cab_type_ids.length ? input.cab_type_ids : null,
            travel_date:      input.travel_date,
        });
    } catch (err) {
        console.error("[createQuote] pricing failed", err);
        return { success: false, error: "We couldn't price this package right now. Please try again." };
    }

    // 3) Reject un-priceable configurations — never lock a bogus price.
    if (breakdown.missing_pricing_config) {
        return {
            success: false,
            error: "This package configuration isn't available for booking yet. Please contact us for a custom quote.",
        };
    }

    // 4) Canonical money (2-dp strings) — the exact bytes we sign AND store.
    const base_cost       = money2dp(breakdown.base_cost);
    const margin_amount   = money2dp(breakdown.margin_amount);
    const gst_amount      = money2dp(breakdown.gst_amount);
    const total_amount    = money2dp(breakdown.final_price);
    const price_per_adult = money2dp(breakdown.price_per_adult);
    const currency        = "INR";

    const now       = new Date();
    const expiresAt = new Date(now.getTime() + ttlMinutes() * 60_000);

    const inputs_hash = computeInputsHash(input);
    const sigPayload: QuoteSignaturePayload = {
        inputs_hash,
        currency,
        base_cost,
        margin_amount,
        gst_amount,
        total_amount,
        price_per_adult,
        expires_at: expiresAt.toISOString(),
    };
    const signature = signQuote(sigPayload);

    // 5) Persist the full snapshot (breakdown frozen as JSON for our records).
    const row = await db.package_quote.create({
        data: {
            package_id:       input.package_id,
            duration_id:      input.duration_id,
            route_id:         input.route_id,
            stay_category_id: input.stay_category_id,
            package_slug:     input.package_slug,
            duration_slug:    input.duration_slug,
            route_slug:       input.route_slug,
            stay_slug:        input.stay_slug,
            adults:           input.adults,
            children:         input.children,
            infants:          input.infants,
            child_ages:       input.child_ages,
            cab_type_ids:     input.cab_type_ids,
            travel_date:      new Date(`${input.travel_date}T00:00:00.000Z`),
            currency,
            breakdown:        breakdown as unknown as object,
            base_cost,
            margin_amount,
            gst_amount,
            total_amount,
            price_per_adult,
            inputs_hash,
            signature,
            status:           "ACTIVE",
            expires_at:       expiresAt,
            user_id:          opts?.userId ?? null,
        },
        select: { id: true, created_at: true },
    });

    // 6) Return only the safe view.
    return {
        success: true,
        quote: {
            id:              row.id,
            package_slug:    input.package_slug,
            duration_slug:   input.duration_slug,
            route_slug:      input.route_slug,
            stay_slug:       input.stay_slug,
            adults:          input.adults,
            children:        input.children,
            infants:         input.infants,
            travel_date:     input.travel_date,
            currency,
            total_amount:    Number(total_amount),
            price_per_adult: Number(price_per_adult),
            gst_amount:      Number(gst_amount),
            gst_percentage:  breakdown.gst_percentage,
            status:          "ACTIVE",
            expires_at:      expiresAt.toISOString(),
            created_at:      row.created_at.toISOString(),
        },
    };
}
