import { z } from 'zod';

/**
 * Shared Zod schema for the quote endpoint input.
 *
 * Plain module (NOT 'use server') so it can be imported by both the client
 * (PricingCard "Book" button) and the server (`createQuote` service / action).
 *
 * Hard rule: the client sends ONLY selectors + pax + date — never money.
 * The server re-derives every rupee via `computePackagePrice`.
 */

// ── Caps (named so they're reusable / testable) ──────────────────────────────
export const QUOTE_LIMITS = {
    MAX_ADULTS:   20,
    MAX_CHILDREN: 20,
    MAX_INFANTS:  10,
    MAX_CABS:     20,
    MIN_CHILD_AGE: 0,
    MAX_CHILD_AGE: 17,
} as const;

const positiveId = z.number().int().positive();
const slug = z
    .string()
    .trim()
    .min(1, 'Slug is required.')
    .max(160, 'Slug is too long.');

/** Local "today" as YYYY-MM-DD (server timezone — matches the pricing engine). */
function todayISO(): string {
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}

/** True only for a real calendar date — rejects roll-overs like 2026-02-30. */
function isRealCalendarDate(s: string): boolean {
    const [y, m, d] = s.split('-').map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    return (
        dt.getUTCFullYear() === y &&
        dt.getUTCMonth() === m - 1 &&
        dt.getUTCDate() === d
    );
}

export const quoteInputSchema = z
    .object({
        // Selectors — identify exactly which package configuration is priced.
        package_id:       positiveId,
        duration_id:      positiveId,
        route_id:         positiveId,
        stay_category_id: positiveId,

        // Slugs — frozen onto the quote for the review URL & display.
        package_slug:  slug,
        duration_slug: slug,
        route_slug:    slug,
        stay_slug:     slug,

        // Passengers.
        adults:   z.number().int().min(1, 'At least one adult is required.').max(QUOTE_LIMITS.MAX_ADULTS, 'Too many adults.'),
        children: z.number().int().min(0).max(QUOTE_LIMITS.MAX_CHILDREN, 'Too many children.').default(0),
        infants:  z.number().int().min(0).max(QUOTE_LIMITS.MAX_INFANTS, 'Too many infants.').default(0),
        child_ages: z
            .array(z.number().int().min(QUOTE_LIMITS.MIN_CHILD_AGE).max(QUOTE_LIMITS.MAX_CHILD_AGE))
            .max(QUOTE_LIMITS.MAX_CHILDREN)
            .default([]),

        // Cab selection (one cab type id per cab group). Empty = engine defaults.
        cab_type_ids: z.array(positiveId).max(QUOTE_LIMITS.MAX_CABS).default([]),

        // Real per-room breakdown from the MMT-style rooms picker. Empty =
        // engine derives room count from adults+children the old way. When
        // present, computePackagePrice independently re-validates it can't
        // underprice that same derivation before trusting it — this schema
        // only bounds shape/range, not the pricing-safety guarantee itself.
        rooms: z
            .array(z.object({
                adults:   z.number().int().min(1).max(QUOTE_LIMITS.MAX_ADULTS),
                children: z.number().int().min(0).max(QUOTE_LIMITS.MAX_CHILDREN),
            }))
            .max(20)
            .default([]),

        // Travel date — REQUIRED for a quote, and must not be in the past.
        travel_date: z
            .string()
            .regex(/^\d{4}-\d{2}-\d{2}$/, 'Travel date must be YYYY-MM-DD.')
            .refine(isRealCalendarDate, 'Travel date is not a valid calendar date.')
            .refine((s) => s >= todayISO(), 'Travel date cannot be in the past.'),
    })
    .superRefine((val, ctx) => {
        // Children must each have an age.
        if (val.child_ages.length !== val.children) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['child_ages'],
                message: `Provide an age for each child (${val.children} expected, got ${val.child_ages.length}).`,
            });
        }
        // A non-empty rooms breakdown must exactly account for every adult
        // and child — no more, no less. (Whether it's ALSO enough rooms for
        // the party is re-checked server-side against real hotel capacity in
        // computePackagePrice, since that depends on data this schema can't see.)
        if (val.rooms.length > 0) {
            const roomsTotal = val.rooms.reduce((s, r) => s + r.adults + r.children, 0);
            if (roomsTotal !== val.adults + val.children) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    path: ['rooms'],
                    message: `Room occupants (${roomsTotal}) must match total travellers (${val.adults + val.children}).`,
                });
            }
        }
    });

export type QuoteInput  = z.input<typeof quoteInputSchema>;
export type QuoteParsed = z.output<typeof quoteInputSchema>;
export type QuoteErrors = Partial<Record<keyof QuoteInput, string>>;
