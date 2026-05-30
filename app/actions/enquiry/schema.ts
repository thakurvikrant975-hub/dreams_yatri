import { z } from 'zod'

export const enquirySchema = z.object({
    name:        z.string().min(2, 'Name must be at least 2 characters.').max(100, 'Name is too long.'),
    email:       z.string().email('Enter a valid email address.').or(z.literal('')).optional(),
    phone:       z
        .string()
        .min(7,  'Phone number is too short.')
        .max(15, 'Phone number is too long.')
        .regex(/^[+\d][\d\s\-().]{5,}$/, 'Enter a valid phone number.'),
    packageName: z.string().optional(),
    packageUrl:  z.string().optional(),
    pageUrl:     z.string().url().optional().or(z.literal('')),
})

export type EnquiryInput  = z.input<typeof enquirySchema>
export type EnquiryErrors = Partial<Record<keyof EnquiryInput, string>>
