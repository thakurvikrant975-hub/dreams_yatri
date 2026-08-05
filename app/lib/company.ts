/**
 * The company's own particulars, as they appear on documents we issue.
 *
 * One source rather than a copy per document: the support address and phone had
 * already drifted between the invoice and the voucher, and a registration number
 * that is right on one document and stale on the other is worse than one that is
 * merely absent.
 */
export const COMPANY = {
    name: "Dreams Yatri",
    address: "05, STPI Top Floor, SDA Complex, Kasumpti, Shimla, Himachal Pradesh 171009",
    email: "info@dreamsyatri.com",
    phone: "+91 78077 58100",
    /** Statutory identifiers — a tax invoice without the GSTIN is not one the
     *  buyer can claim input credit against. */
    gstin: "02AAJCD8680P1Z1",
    cin: "U52291HP2023OPC009928",
    /** The people a guest reaches on the road, printed on every voucher. */
    contacts: [
        { name: "Mr. Ravi", role: "Operation Manager", phone: "+91 78077 58100" },
        { name: "Ms. Varsha Dharoch", role: "Operation Executive", phone: "+91 80918 55100" },
    ],
} as const;
