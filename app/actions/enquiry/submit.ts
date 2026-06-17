'use server'

import { db } from '@/app/lib/db'
import { enquirySchema, type EnquiryInput, type EnquiryErrors } from './schema'

type SubmitResult =
    | { ok: true }
    | { ok: false; fieldErrors: EnquiryErrors; formError?: never }
    | { ok: false; fieldErrors?: never; formError: string }

const RATE_LIMIT_WINDOW_MS   = 15 * 60 * 1000      // 15 min — same phone, any package
const DUPLICATE_WINDOW_MS    = 24 * 60 * 60 * 1000  // 24 h  — same phone + same package

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

    const {
        name, email, phone, countryCode,
        travelDate, travellers, message,
        packageName, destination, packageUrl, pageUrl,
    } = result.data

    // ── Rate limiting: same phone within 15 minutes ──────────────────────────
    const recentByPhone = await db.package_queries.findFirst({
        where: { phone, createdAt: { gte: new Date(Date.now() - RATE_LIMIT_WINDOW_MS) } },
        select: { id: true },
    })
    if (recentByPhone) {
        return {
            ok: false,
            formError: 'You already submitted a query. Our team will contact you shortly.',
        }
    }

    // ── Duplicate guard: same phone + same package within 24 hours ───────────
    if (packageName) {
        const duplicate = await db.package_queries.findFirst({
            where: {
                phone,
                packageName,
                createdAt: { gte: new Date(Date.now() - DUPLICATE_WINDOW_MS) },
            },
            select: { id: true },
        })
        if (duplicate) {
            return {
                ok: false,
                formError: 'You have already enquired about this package. Our team will be in touch soon.',
            }
        }
    }

    try {
        // Upsert lead profile so the query shows up under a known lead
        const normalizedPhone = phone.replace(/[\s\-().+]/g, '')
        const profile = await db.leadProfile.upsert({
            where: { phone: normalizedPhone },
            update: {
                name,
                ...(email ? { email } : {}),
                lastSeenAt:   new Date(),
                totalQueries: { increment: 1 },
            },
            create: {
                phone: normalizedPhone,
                name,
                email: email || null,
            },
        })

        await db.package_queries.create({
            data: {
                name,
                phone,
                countryCode:   countryCode  || 'IN',
                email:         email        || null,
                packageName:   packageName  || null,
                destination:   destination  || null,
                packageUrl:    packageUrl   || null,
                pageUrl:       pageUrl      || null,
                travelDate:    travelDate   ? new Date(travelDate) : null,
                groupSize:     travellers   ?? null,
                message:       message      || null,
                source:        'PACKAGE_FORM',
                status:        'SUBMITTED',
                leadProfileId: profile.id,
            },
        })

        return { ok: true }
    } catch {
        return { ok: false, formError: 'Failed to submit enquiry. Please try again.' }
    }
}
