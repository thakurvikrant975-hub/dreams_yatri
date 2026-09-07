import "server-only";
import { z } from "zod";
import { db } from "@/app/lib/db";

/**
 * Who is actually paying, and how we reach them.
 *
 * A custom package's booking used to take its contact details from the LEAD —
 * `query.email` and `query.phone`, the row the sales exec created. That is the
 * right answer only while the person paying is the person quoted, and on a
 * share link it frequently is not: the link is forwarded, and a booking's
 * invoice was going out with the buyer's account name beside the lead's email
 * and the lead's phone. Two different people on one document.
 *
 * So the payer states their own details, and those are what the booking (and
 * therefore the invoice) carries.
 *
 * ── On "at least one verified" ────────────────────────────────────────────
 * The rule is already satisfied by the time this runs, and not by anything
 * here. Signing in IS the verification: the phone path consumes a row from
 * `otp` before it will return a user (app/lib/auth.ts), and the email paths
 * come from a provider that verified the address. So an authenticated payer
 * has exactly one channel that has been proved, and this form is only ever
 * filling in the OTHER one — supplementary contact detail, unverified by
 * construction and honest about it.
 *
 * That is why there is no OTP step in this form. Adding one would re-verify
 * what the session already proves, and would not make the second channel any
 * more trustworthy than the person typing it.
 */

export const payerContactSchema = z.object({
    name: z.string().trim().min(2, "Enter your full name.").max(80),
    email: z.string().trim().email("Enter a valid email address."),
    // Deliberately loose. This is a contact number for a travel desk to ring,
    // not an identity: over-tight patterns reject valid international numbers
    // and the only cost of a wrong one is a call that does not connect.
    phone: z.string().trim().regex(/^[+\d][\d\s\-().]{6,19}$/, "Enter a valid phone number."),
});

export type PayerContact = z.infer<typeof payerContactSchema>;

/** What the form should open with — whatever we already hold, from the payer's
 *  own account first and the lead only as a fallback. */
export type PayerContactPrefill = {
    name: string;
    email: string;
    phone: string;
    /** The channel the session proved. Shown to the payer so it is clear which
     *  of the two we already trust, and why it is not editable. */
    verified: "email" | "phone" | null;
};

/** True when we hold everything a booking and an invoice need. */
export function payerContactComplete(c: { name?: string | null; email?: string | null; phone?: string | null }): boolean {
    return payerContactSchema.safeParse({
        name: c.name ?? "", email: c.email ?? "", phone: c.phone ?? "",
    }).success;
}

/**
 * What we know about the payer, and which channel is already proved.
 *
 * `emailVerified` is set by the email/OAuth paths. A phone is only ever
 * written onto a user by the OTP login upsert, so its presence is the proof —
 * there is no separate phoneVerified column and there does not need to be.
 */
export async function payerContactPrefill(userId: string, lead?: {
    name?: string | null; email?: string | null; phone?: string | null;
}): Promise<PayerContactPrefill> {
    const user = await db.user.findUnique({
        where: { id: userId },
        select: { name: true, email: true, phone: true, emailVerified: true },
    });
    return {
        // The lead's name is a reasonable suggestion — it is who the trip was
        // quoted for — but never their email or phone, which is the mix-up
        // this whole module exists to stop.
        name: user?.name ?? lead?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone ?? "",
        verified: user?.emailVerified ? "email" : user?.phone ? "phone" : null,
    };
}

/**
 * Writes the payer's details back onto their account, so they are asked once
 * rather than at every booking.
 *
 * Both columns are @unique. A number or address already sitting on another
 * account is a real situation — a client who signed in by phone today and by
 * Google last year has two rows — and it must not surface as a 500 on a
 * payment screen. It is reported instead, and the booking still goes ahead
 * with what they typed: the contact on the invoice is a fact about this
 * booking, not about which login row owns the string.
 *
 * Never overwrites a verified email with an unverified one.
 */
export async function savePayerContact(userId: string, c: PayerContact): Promise<{ conflict: "email" | "phone" | null }> {
    const me = await db.user.findUnique({
        where: { id: userId },
        select: { email: true, phone: true, emailVerified: true },
    });

    const [emailOwner, phoneOwner] = await Promise.all([
        c.email && c.email !== me?.email
            ? db.user.findUnique({ where: { email: c.email }, select: { id: true } })
            : null,
        c.phone && c.phone !== me?.phone
            ? db.user.findUnique({ where: { phone: c.phone }, select: { id: true } })
            : null,
    ]);

    const emailTaken = !!emailOwner && emailOwner.id !== userId;
    const phoneTaken = !!phoneOwner && phoneOwner.id !== userId;

    await db.user.update({
        where: { id: userId },
        data: {
            name: c.name,
            ...(emailTaken || (me?.emailVerified && me.email !== c.email) ? {} : { email: c.email }),
            ...(phoneTaken ? {} : { phone: c.phone }),
        },
    });

    return { conflict: emailTaken ? "email" : phoneTaken ? "phone" : null };
}
