import "server-only";
import { createHash, createHmac, timingSafeEqual } from "crypto";
import type { QuoteParsed } from "./schema";

/**
 * Quote integrity utilities (server-only).
 *
 *  - `computeInputsHash` — deterministic fingerprint of the *validated inputs*
 *    (selectors + pax + date). Used to find equivalent quotes and to detect
 *    drift (recompute later & compare).
 *  - `signQuote` / `verifyQuote` — HMAC-SHA256 seal over the money-bearing
 *    snapshot, so a tampered DB row (price, TTL, currency) is detectable.
 *
 * The signature deliberately covers `inputs_hash` (which already folds in every
 * selector/pax/date) PLUS the derived money + expiry. If any of those change,
 * verification fails.
 */

function getSecret(): string {
    const s = process.env.QUOTE_SECRET;
    if (!s || s.length < 16) {
        throw new Error(
            "QUOTE_SECRET is not configured (need a secret of at least 16 chars).",
        );
    }
    return s;
}

// ── Inputs hash ──────────────────────────────────────────────────────────────

/**
 * SHA-256 over a canonical, explicitly-ordered string of the validated inputs.
 * `child_ages` and `cab_type_ids` are sorted so logically-identical selections
 * (e.g. ages [10, 8] vs [8, 10]) hash the same.
 */
export function computeInputsHash(input: QuoteParsed): string {
    const canonical = [
        input.package_id,
        input.duration_id,
        input.route_id,
        input.stay_category_id,
        input.adults,
        input.children,
        input.infants,
        [...input.child_ages].sort((a, b) => a - b).join(","),
        [...input.cab_type_ids].sort((a, b) => a - b).join(","),
        input.travel_date,
        // Room ORDER is preserved (not sorted) — unlike child_ages/cab_type_ids,
        // which room has which headcount is a distinct real configuration, not
        // an equivalent reordering of interchangeable values.
        input.rooms.map((r) => `${r.adults}:${r.children}`).join(","),
    ].join("|");
    return createHash("sha256").update(canonical).digest("hex");
}

// ── Signature ────────────────────────────────────────────────────────────────

/**
 * The exact set of fields sealed by the signature. Money fields are passed as
 * fixed-precision strings (the same 2-dp representation stored in the DB) so
 * float formatting can never change the signed bytes.
 */
export interface QuoteSignaturePayload {
    inputs_hash: string;
    currency: string;
    base_cost: string;
    margin_amount: string;
    gst_amount: string;
    total_amount: string;
    price_per_adult: string;
    expires_at: string; // ISO 8601
}

function canonicalPayload(p: QuoteSignaturePayload): string {
    return [
        p.inputs_hash,
        p.currency,
        p.base_cost,
        p.margin_amount,
        p.gst_amount,
        p.total_amount,
        p.price_per_adult,
        p.expires_at,
    ].join("|");
}

/** HMAC-SHA256 hex signature over the canonical payload. */
export function signQuote(p: QuoteSignaturePayload): string {
    return createHmac("sha256", getSecret())
        .update(canonicalPayload(p))
        .digest("hex");
}

/** Timing-safe verification of a previously-issued signature. */
export function verifyQuote(p: QuoteSignaturePayload, signature: string): boolean {
    const expected = Buffer.from(signQuote(p), "hex");
    let provided: Buffer;
    try {
        provided = Buffer.from(signature ?? "", "hex");
    } catch {
        return false;
    }
    if (expected.length === 0 || expected.length !== provided.length) return false;
    return timingSafeEqual(expected, provided);
}

/** Helper: format a numeric/Decimal-ish value to the 2-dp string used in signing. */
export function money2dp(value: number | string): string {
    return Number(value).toFixed(2);
}
