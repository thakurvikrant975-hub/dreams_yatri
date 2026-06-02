"use server";

import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import { createQuote, type CreateQuoteResult } from "./create-quote.service";
import { getQuote, isQuoteFresh, type GetQuoteResult, type QuoteFreshness } from "./get-quote.service";
import type { QuoteInput } from "./schema";

/**
 * Thin 'use server' boundary for the quote services.
 *
 * Per the Next.js rule, a 'use server' file may export only async functions —
 * so all shared TYPES live in the (non-'use server') service modules and are
 * imported with `import type` wherever needed.
 */

/** Create a signed, short-lived price lock from user selectors. */
export async function createPackageQuote(input: QuoteInput): Promise<CreateQuoteResult> {
    const user = await getAuthenticatedUser();
    return createQuote(input, { userId: user?.id ?? null });
}

/** Fetch a quote for the review page (integrity-checked, lazy-expired). */
export async function getPackageQuote(id: string): Promise<GetQuoteResult> {
    return getQuote(id);
}

/** Recompute today's price for a quote's locked inputs and report drift. */
export async function checkQuoteFreshness(id: string): Promise<QuoteFreshness | null> {
    return isQuoteFresh(id);
}
