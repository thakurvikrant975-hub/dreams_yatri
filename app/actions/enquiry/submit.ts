'use server'

import { db } from '@/app/lib/db'
import { enquirySchema, type EnquiryInput, type EnquiryErrors } from './schema'

export async function submitPackageEnquiry(raw: EnquiryInput): Promise<
    | { ok: true }
    | { ok: false; fieldErrors: EnquiryErrors; formError?: never }
    | { ok: false; fieldErrors?: never; formError: string }
> {
    const result = enquirySchema.safeParse(raw)

    if (!result.success) {
        const fieldErrors: EnquiryErrors = {}
        for (const issue of result.error.issues) {
            const key = issue.path[0] as keyof EnquiryInput
            if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
        }
        return { ok: false, fieldErrors }
    }

    const { name, email, phone, packageName, packageUrl, pageUrl } = result.data

    try {
        await db.package_queries.create({
            data: {
                name,
                phone,
                email:       email       || null,
                packageName: packageName || null,
                packageUrl:  packageUrl  || null,
                pageUrl:     pageUrl     || null,
                source:      'WEBSITE_FORM',
                status:      'SUBMITTED',
            },
        })
        return { ok: true }
    } catch {
        return { ok: false, formError: 'Failed to submit enquiry. Please try again.' }
    }
}
