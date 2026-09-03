'use server'

import { createLead } from './intake.service'
import { enquirySchema, type EnquiryInput, type EnquiryErrors } from './schema'

type SubmitResult =
    | { ok: true }
    | { ok: false; fieldErrors: EnquiryErrors; formError?: never }
    | { ok: false; fieldErrors?: never; formError: string }

/**
 * The website's own enquiry forms. Validation and the shape of what comes
 * back are unchanged; the writing itself now lives in intake.service so the
 * external REST endpoint lands leads by exactly the same route.
 */
export async function submitPackageEnquiry(raw: EnquiryInput): Promise<SubmitResult> {
    const result = enquirySchema.safeParse(raw)

    if (!result.success) {
        const fieldErrors: EnquiryErrors = {}
        for (const issue of result.error.issues) {
            const key = issue.path[0] as keyof EnquiryInput
            if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
        }
        return { ok: false, fieldErrors }
    }

    const outcome = await createLead(result.data)

    // A rate-limited or duplicate submission is a message to the visitor here,
    // not a silent success — the external endpoint treats the same outcomes
    // differently, which is why the mapping lives at each edge rather than in
    // the service.
    if (!outcome.ok) return { ok: false, formError: outcome.message }

    return { ok: true }
}
