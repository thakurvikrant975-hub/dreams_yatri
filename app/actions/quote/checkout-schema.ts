import { z } from "zod";

/**
 * Shared checkout-details schema (client form + server persist). Plain module.
 * Traveller list length/types are re-checked server-side against the quote's pax.
 */

const todayISO = () => {
    const n = new Date();
    return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`;
};

function isRealPastOrToday(s: string): boolean {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
    const [y, m, d] = s.split("-").map(Number);
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return false;
    return s <= todayISO();
}

function ageFromDob(dob: string): number | null {
    if (!isRealPastOrToday(dob)) return null;
    const birth = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
    return age;
}

export const travellerSchema = z.object({
    type: z.enum(["ADULT", "CHILD", "INFANT"]),
    firstName: z.string().trim().min(1, "First name is required.").max(60),
    lastName: z.string().trim().min(1, "Last name is required.").max(60),
    dob: z.string().refine(isRealPastOrToday, "Enter a valid date of birth."),
    gender: z.enum(["MALE", "FEMALE", "OTHER", "PREFER_NOT_TO_SAY"]),
}).superRefine((data, ctx) => {
    const age = ageFromDob(data.dob);
    if (age === null) return;
    if (data.type === "ADULT" && age < 12) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dob"], message: "Adult must be 12 years or older." });
    }
    if (data.type === "CHILD" && age >= 12) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dob"], message: "Child must be below 12 years old." });
    }
    if (data.type === "INFANT" && age >= 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["dob"], message: "Infant must be below 2 years old." });
    }
});

export const checkoutSchema = z.object({
    travellers: z.array(travellerSchema).min(1, "At least one traveller is required.").max(40),
    contact: z.object({
        email: z.string().email("Enter a valid email."),
        phone: z.string().trim().regex(/^[+\d][\d\s\-().]{6,}$/, "Enter a valid phone number."),
    }),
    gstStateCode: z.string().trim().max(10).optional().or(z.literal("")),
});

export type TravellerInput = z.infer<typeof travellerSchema>;
export type CheckoutInput = z.infer<typeof checkoutSchema>;
export type CheckoutErrors = Partial<Record<string, string>>;
