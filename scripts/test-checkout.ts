/**
 * Pure-unit tests for the checkout details schema.
 * Run:  npm run test:checkout
 */
import { checkoutSchema } from "../app/actions/quote/checkout-schema";

let passed = 0;
const failures: string[] = [];
const check = (n: string, c: boolean) => { if (c) passed++; else { failures.push(n); console.error(`  ✗ ${n}`); } };

const validTraveller = { type: "ADULT" as const, firstName: "Asha", lastName: "Rao", dob: "1990-01-01", gender: "FEMALE" as const };
const base = { travellers: [validTraveller], contact: { email: "a@b.com", phone: "+91 98123 45678" }, gstStateCode: "" };

console.log("Checkout schema:");

check("valid passes", checkoutSchema.safeParse(base).success);
check("gst optional (omitted)", checkoutSchema.safeParse({ travellers: [validTraveller], contact: base.contact }).success);
check("missing first name fails", !checkoutSchema.safeParse({ ...base, travellers: [{ ...validTraveller, firstName: "" }] }).success);
check("missing last name fails", !checkoutSchema.safeParse({ ...base, travellers: [{ ...validTraveller, lastName: "" }] }).success);
check("future dob fails", !checkoutSchema.safeParse({ ...base, travellers: [{ ...validTraveller, dob: "2090-01-01" }] }).success);
check("malformed dob fails", !checkoutSchema.safeParse({ ...base, travellers: [{ ...validTraveller, dob: "01-01-1990" }] }).success);
check("bad gender fails", !checkoutSchema.safeParse({ ...base, travellers: [{ ...validTraveller, gender: "X" }] }).success);
check("bad email fails", !checkoutSchema.safeParse({ ...base, contact: { email: "nope", phone: base.contact.phone } }).success);
check("short phone fails", !checkoutSchema.safeParse({ ...base, contact: { email: "a@b.com", phone: "12" } }).success);
check("no travellers fails", !checkoutSchema.safeParse({ ...base, travellers: [] }).success);
check("CHILD/INFANT types accepted", checkoutSchema.safeParse({ ...base, travellers: [validTraveller, { ...validTraveller, type: "CHILD" }, { ...validTraveller, type: "INFANT" }] }).success);

console.log(`\n${passed} passed, ${failures.length} failed`);
if (failures.length > 0) process.exit(1);
