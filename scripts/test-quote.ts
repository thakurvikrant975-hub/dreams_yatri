/**
 * Pure-unit tests for the quote pieces (schema validation + signing).
 *
 * Run:  npm run test:quote
 * Uses `--conditions=react-server` so the `server-only` guard in signing.ts
 * resolves to a no-op, and `--env-file=.env` to provide QUOTE_SECRET.
 *
 * No test framework — a tiny assert harness that exits non-zero on any failure.
 */

import { quoteInputSchema, QUOTE_LIMITS, type QuoteInput } from "../app/actions/quote/schema";
import {
    computeInputsHash,
    signQuote,
    verifyQuote,
    money2dp,
    type QuoteSignaturePayload,
} from "../app/actions/quote/signing";

let passed = 0;
const failures: string[] = [];

function check(name: string, cond: boolean) {
    if (cond) {
        passed++;
    } else {
        failures.push(name);
        console.error(`  ✗ ${name}`);
    }
}

function futureDate(daysAhead: number): string {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    return d.toISOString().slice(0, 10);
}

const baseValid: QuoteInput = {
    package_id: 1,
    duration_id: 2,
    route_id: 3,
    stay_category_id: 4,
    package_slug: "manali-honeymoon-package",
    duration_slug: "4d-3n",
    route_slug: "manali-jammu-gulmarg",
    stay_slug: "standard",
    adults: 2,
    travel_date: futureDate(30),
};

// ── Schema ───────────────────────────────────────────────────────────────────
console.log("Schema:");

{
    const r = quoteInputSchema.safeParse(baseValid);
    check("valid minimal input passes", r.success);
    if (r.success) {
        check("children defaults to 0", r.data.children === 0);
        check("infants defaults to 0", r.data.infants === 0);
        check("child_ages defaults to []", Array.isArray(r.data.child_ages) && r.data.child_ages.length === 0);
        check("cab_type_ids defaults to []", Array.isArray(r.data.cab_type_ids) && r.data.cab_type_ids.length === 0);
        check("rooms defaults to []", Array.isArray(r.data.rooms) && r.data.rooms.length === 0);
    }
}

check(
    "rooms occupant total must match adults+children",
    !quoteInputSchema.safeParse({ ...baseValid, adults: 2, rooms: [{ adults: 1, children: 0 }] }).success,
);
check(
    "matching rooms total passes",
    quoteInputSchema.safeParse({ ...baseValid, adults: 3, rooms: [{ adults: 2, children: 0 }, { adults: 1, children: 0 }] }).success,
);
check(
    "rooms adults below 1 rejected",
    !quoteInputSchema.safeParse({ ...baseValid, adults: 2, rooms: [{ adults: 0, children: 2 }] }).success,
);

check(
    "past travel_date rejected",
    !quoteInputSchema.safeParse({ ...baseValid, travel_date: "2000-01-01" }).success,
);

check(
    "today is allowed",
    quoteInputSchema.safeParse({ ...baseValid, travel_date: futureDate(0) }).success,
);

check(
    "impossible calendar date (2026-02-30) rejected",
    !quoteInputSchema.safeParse({ ...baseValid, travel_date: "2026-02-30" }).success,
);

check(
    "malformed date string rejected",
    !quoteInputSchema.safeParse({ ...baseValid, travel_date: "30-09-2026" }).success,
);

check(
    "child_ages length must equal children",
    !quoteInputSchema.safeParse({ ...baseValid, children: 2, child_ages: [8] }).success,
);

check(
    "matching children + ages passes",
    quoteInputSchema.safeParse({ ...baseValid, children: 2, child_ages: [8, 10] }).success,
);

check("adults < 1 rejected", !quoteInputSchema.safeParse({ ...baseValid, adults: 0 }).success);
check(
    "adults over cap rejected",
    !quoteInputSchema.safeParse({ ...baseValid, adults: QUOTE_LIMITS.MAX_ADULTS + 1 }).success,
);
check("empty slug rejected", !quoteInputSchema.safeParse({ ...baseValid, package_slug: "" }).success);
check(
    "child age over 17 rejected",
    !quoteInputSchema.safeParse({ ...baseValid, children: 1, child_ages: [18] }).success,
);

// ── Signing & inputs hash ──────────────────────────────────────────────────────
console.log("Signing:");

const parsedA = quoteInputSchema.parse({ ...baseValid, children: 1, child_ages: [10], cab_type_ids: [5, 3] });
const parsedB = quoteInputSchema.parse({ ...baseValid, children: 1, child_ages: [10], cab_type_ids: [3, 5] });
const parsedC = quoteInputSchema.parse({ ...baseValid, adults: 3, children: 1, child_ages: [10], cab_type_ids: [3, 5] });

check("inputs hash is order-insensitive for cab_type_ids", computeInputsHash(parsedA) === computeInputsHash(parsedB));
check("different pax → different inputs hash", computeInputsHash(parsedA) !== computeInputsHash(parsedC));

const parsedRoomsSplitA = quoteInputSchema.parse({ ...baseValid, adults: 3, rooms: [{ adults: 2, children: 0 }, { adults: 1, children: 0 }] });
const parsedRoomsSplitB = quoteInputSchema.parse({ ...baseValid, adults: 3, rooms: [{ adults: 1, children: 0 }, { adults: 2, children: 0 }] });
const parsedRoomsSame   = quoteInputSchema.parse({ ...baseValid, adults: 3, rooms: [{ adults: 2, children: 0 }, { adults: 1, children: 0 }] });
check("inputs hash changes when only room split/order changes (same totals)", computeInputsHash(parsedRoomsSplitA) !== computeInputsHash(parsedRoomsSplitB));
check("inputs hash is identical for an identical rooms array", computeInputsHash(parsedRoomsSplitA) === computeInputsHash(parsedRoomsSame));
check("rooms vs no-rooms → different inputs hash for the same pax", computeInputsHash(parsedRoomsSplitA) !== computeInputsHash(quoteInputSchema.parse({ ...baseValid, adults: 3 })));

const payload: QuoteSignaturePayload = {
    inputs_hash: computeInputsHash(parsedA),
    currency: "INR",
    base_cost: money2dp(10000),
    margin_amount: money2dp(2000),
    gst_amount: money2dp(600),
    total_amount: money2dp(12600),
    price_per_adult: money2dp(6300),
    expires_at: new Date(Date.now() + 15 * 60_000).toISOString(),
};
const sig = signQuote(payload);

check("signQuote is deterministic", signQuote(payload) === sig);
check("verifyQuote accepts a valid signature", verifyQuote(payload, sig));
check("tampered total rejected", !verifyQuote({ ...payload, total_amount: money2dp(10) }, sig));
check("tampered expiry rejected", !verifyQuote({ ...payload, expires_at: new Date(Date.now() + 999 * 60_000).toISOString() }, sig));
check("tampered inputs_hash rejected", !verifyQuote({ ...payload, inputs_hash: "deadbeef" }, sig));
check("garbage signature rejected", !verifyQuote(payload, "zzzz"));
check("empty signature rejected", !verifyQuote(payload, ""));

check("money2dp keeps trailing zeros", money2dp("1260") === "1260.00" && money2dp(1260.5) === "1260.50");

// ── Report ─────────────────────────────────────────────────────────────────────
console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
