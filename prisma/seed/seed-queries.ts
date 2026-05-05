import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../../app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";
import { createId }     from "@paralleldrive/cuid2";

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const db      = new PrismaClient({ adapter } as never);

async function seedQueries() {
    const reasons         = await db.rejectionReason.findMany();
    const notInterested   = reasons.find(r => r.label === "Not Interested");
    const boughtElsewhere = reasons.find(r => r.label === "Purchased from Competitor");
    const noResponse      = reasons.find(r => r.label === "No Response (3 Attempts)");

    await db.package_queries.deleteMany();

    const dummyQueries = [
        {
            id: createId(),
            name: "Rahul Sharma", email: "rahul.sharma@gmail.com", phone: "+91 98765 43210",
            message: "Looking for a 7-day Kashmir package for my honeymoon in June.",
            packageName: "Kashmir Honeymoon Special", destination: "Kashmir",
            travelDate: new Date("2025-06-15"), groupSize: 2,
            source: "WEBSITE_FORM" as const, status: "SUBMITTED" as const, verified: false,
            utmSource: "google", utmMedium: "cpc", utmCampaign: "kashmir-honeymoon-2025",
            gclid: "EAIaIQobChMI_abc123",
        },
        {
            id: createId(),
            name: "Priya Verma", email: "priya.v@yahoo.com", phone: "+91 91234 56789",
            message: "Family trip to Goa with 2 kids. Budget 80k. Want beachside resort.",
            packageName: "Goa Family Beach Package", destination: "Goa",
            travelDate: new Date("2025-05-20"), groupSize: 4,
            source: "LANDING_PAGE" as const, status: "IN_PROGRESS" as const, verified: false,
            callAttempts: 2, lastAttemptAt: new Date(Date.now() - 1000 * 60 * 60 * 5),
            nextFollowUpAt: new Date(Date.now() + 1000 * 60 * 60 * 24),
            utmSource: "google", utmMedium: "cpc", utmCampaign: "goa-family-2025",
        },
        {
            id: createId(),
            name: "Amit Patel", email: "amit.patel@hotmail.com", phone: "+91 87654 32109",
            message: "Shimla Manali trip 10 days. Group of friends, 6 people.",
            packageName: "Shimla Manali Adventure", destination: "Himachal Pradesh",
            travelDate: new Date("2025-07-01"), groupSize: 6,
            source: "WHATSAPP" as const, status: "VERIFIED" as const,
            verified: true, verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
            callAttempts: 1, lastAttemptAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
        },
        {
            id: createId(),
            name: "Sunita Mehta", phone: "+91 99887 76655",
            message: "Dubai anniversary trip. 5 nights. Business class preferred.",
            packageName: "Dubai Luxury Anniversary", destination: "Dubai",
            travelDate: new Date("2025-08-10"), groupSize: 2,
            source: "PHONE_CALL" as const, status: "REJECTED" as const, verified: false,
            rejectionReasonId: boughtElsewhere?.id,
            rejectionNote: "Customer already booked with MakeMyTrip at lower price.",
            callAttempts: 3,
        },
        {
            id: createId(),
            name: "Vikram Singh", email: "vikram.singh@gmail.com", phone: "+91 70123 45678",
            message: "Thailand 8 days. Phuket + Bangkok combo. Budget 1.5L per person.",
            packageName: "Thailand Phuket Bangkok Combo", destination: "Thailand",
            travelDate: new Date("2025-09-05"), groupSize: 2,
            source: "WEBSITE_FORM" as const, status: "SUBMITTED" as const, verified: false,
            utmSource: "facebook", utmMedium: "social", utmCampaign: "thailand-intl-2025",
        },
        {
            id: createId(),
            name: "Deepika Nair", email: "deepika.n@gmail.com", phone: "+91 82345 67890",
            message: "Kerala backwaters and Munnar 6 days. Honeymoon trip.",
            packageName: "Kerala Honeymoon Bliss", destination: "Kerala",
            travelDate: new Date("2025-06-01"), groupSize: 2,
            source: "REFERRAL" as const, status: "REJECTED" as const, verified: false,
            rejectionReasonId: notInterested?.id,
            rejectionNote: "Changed plans, going abroad instead.",
            callAttempts: 1,
        },
        {
            id: createId(),
            name: "Arjun Kapoor", phone: "+91 93456 78901",
            message: "Rajasthan heritage tour. 10 days. Senior citizens group of 12.",
            packageName: "Rajasthan Royal Heritage", destination: "Rajasthan",
            travelDate: new Date("2025-10-15"), groupSize: 12,
            source: "WEBSITE_FORM" as const, status: "IN_PROGRESS" as const, verified: false,
            callAttempts: 1, lastAttemptAt: new Date(Date.now() - 1000 * 60 * 30),
            utmSource: "google", utmMedium: "cpc", utmCampaign: "rajasthan-heritage-2025",
        },
        {
            id: createId(),
            name: "Meera Joshi", email: "meera.joshi@outlook.com", phone: "+91 84567 89012",
            message: "Spiti Valley road trip. Need vehicle + stay for 8 days.",
            packageName: "Spiti Valley Road Trip", destination: "Himachal Pradesh",
            travelDate: new Date("2025-07-20"), groupSize: 4,
            source: "LANDING_PAGE" as const, status: "REJECTED" as const, verified: false,
            rejectionReasonId: noResponse?.id,
            callAttempts: 3, lastAttemptAt: new Date(Date.now() - 1000 * 60 * 60 * 48),
        },
        {
            id: createId(),
            name: "Rohit Gupta", email: "rohit.gupta@gmail.com", phone: "+91 95678 90123",
            message: "Northeast India — Meghalaya, Assam, Sikkim. 12 days offbeat.",
            packageName: "Northeast Offbeat Explorer", destination: "Northeast India",
            travelDate: new Date("2025-11-01"), groupSize: 3,
            source: "WEBSITE_FORM" as const, status: "VERIFIED" as const,
            verified: true, verifiedAt: new Date(Date.now() - 1000 * 60 * 60 * 24),
            callAttempts: 1, utmSource: "google", utmMedium: "organic",
        },
        {
            id: createId(),
            name: "Kavita Reddy", phone: "+91 76789 01234",
            message: "Char Dham Yatra. Group of 20. Need comfortable buses and hotels.",
            packageName: "Char Dham Yatra Group", destination: "Uttarakhand",
            travelDate: new Date("2025-05-10"), groupSize: 20,
            source: "PHONE_CALL" as const, status: "SUBMITTED" as const, verified: false,
        },
        {
            id: createId(),
            name: "Kavita Shetty", phone: "+91 98765 01234",
            message: "Goa. Group of 20. Need comfortable buses and hotels. Need welcome drink.",
            packageName: "Goa Tour", destination: "Goa",
            travelDate: new Date("2025-05-10"), groupSize: 20,
            source: "PHONE_CALL" as const, status: "SUBMITTED" as const, verified: false,
        },
    ];

    for (const q of dummyQueries) {
        await db.package_queries.create({ data: q });
    }

    console.log(`✅ Seeded ${dummyQueries.length} dummy queries`);
}

seedQueries()
    .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
    .finally(async () => { await db.$disconnect(); });