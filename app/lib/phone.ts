/**
 * One identity for a phone number, however it was typed.
 *
 * The same person reaches us as "+919876543210" from a landing page, "+91
 * 98765 43210" from an exec's keyboard and "9876543210" from a web form. The
 * stored `phone` column keeps whatever arrived — it is what gets dialled and
 * shown — so every duplicate check has to compare something else, or the same
 * customer is two leads and auto-assignment hands them to two executives who
 * both ring them.
 *
 * The comparable part is the subscriber number: the last ten digits. That is
 * the rule this business actually needs (Indian numbers, with or without the
 * 91, with or without spaces). Two numbers from different countries sharing
 * their last ten digits would collide, which has not happened here and is a
 * trade worth making against the collisions we do have.
 */

/** Just the digits — drops +, spaces, brackets, dashes. */
export function phoneDigits(value: string): string {
    return value.replace(/\D/g, "");
}

/**
 * The comparison key for a number. Ten digits where there are at least ten,
 * otherwise whatever digits there are (a short or mistyped number still has
 * to match itself rather than everything).
 */
export function phoneKey(value: string): string {
    const digits = phoneDigits(value);
    return digits.length > 10 ? digits.slice(-10) : digits;
}

/**
 * The SQL for the same key, for the lookups that must run in the database.
 * `phone` columns hold every spelling ever submitted, so a Prisma `equals`
 * cannot find them — the comparison has to happen on the column.
 */
export const PHONE_KEY_SQL = `right(regexp_replace(phone, '[^0-9]', '', 'g'), 10)`;

/** What LeadProfile.phone stores: digits only, no punctuation. Unchanged from
 * the original normalizePhone so existing rows keep matching. */
export function normalizePhone(phone: string): string {
    return phone.replace(/[\s\-().+]/g, "");
}
