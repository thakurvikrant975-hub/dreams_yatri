import { z } from 'zod'

export const enquirySchema = z.object({
    name:        z.string().min(2, 'Name must be at least 2 characters.').max(100, 'Name is too long.'),
    email:       z.string().email('Enter a valid email address.').or(z.literal('')).optional(),
    phone:       z
        .string()
        .min(7,  'Phone number is too short.')
        .max(15, 'Phone number is too long.')
        .regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number.'),
    countryCode: z.string().default('IN'),
    travelDate:  z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Enter a valid date.').optional(),
    travellers:  z.coerce.number().int().min(1, 'At least 1 traveller.').max(500, 'Max 500 travellers.').optional(),
    message:     z.string().max(1000, 'Message is too long.').optional(),
    packageName: z.string().optional(),
    destination: z.string().optional(),
    packageUrl:  z.string().optional(),
    pageUrl:     z.string().url().optional().or(z.literal('')),
    /** Defaults to PACKAGE_FORM (existing callers) — landing pages pass LANDING_PAGE.
     *  Deliberately a closed enum, not the full QuerySource union, so a public-facing
     *  form can never claim an internal-only source like REFERRAL/PHONE_CALL. */
    source:      z.enum(['PACKAGE_FORM', 'LANDING_PAGE']).optional(),
})

export type EnquiryInput  = z.input<typeof enquirySchema>
export type EnquiryErrors = Partial<Record<keyof EnquiryInput, string>>
