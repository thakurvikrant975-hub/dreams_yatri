'use server'

import { z } from 'zod'
import { db } from '@/app/lib/db'

const schema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters.').max(100),
    phone: z.string().min(7, 'Phone number is too short.').max(15).regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number.'),
    email: z.string().email('Enter a valid email address.').optional().or(z.literal('')),
})

export async function saveLead(input: { name: string; phone: string; email: string }) {
    const parsed = schema.safeParse(input)
    if (!parsed.success) {
        const first = parsed.error.issues[0]
        return { ok: false, message: first?.message ?? 'Invalid input.' } as const
    }

    const { name, phone, email } = parsed.data

    await db.leadProfile.upsert({
        where: { phone },
        create: { name, phone, email: email || null, totalQueries: 1 },
        update: { name, email: email || undefined, totalQueries: { increment: 1 }, lastSeenAt: new Date() },
    })

    return { ok: true } as const
}
