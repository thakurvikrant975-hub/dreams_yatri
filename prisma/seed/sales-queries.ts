// prisma/seed/sales-queries.ts
// Run with: npx tsx prisma/seed/sales-queries.ts

import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const MY_USER_ID = "5c6fd46e-b46b-46d1-a93f-82a22f416a84";
const MY_NAME    = "Vikrant";

const FOLLOW_UP_NOTES = [
    "Called the customer, they are still interested. Will confirm dates next week.",
    "WhatsApp message sent with itinerary PDF. Customer asked for price breakdown.",
    "Customer requested to include airport transfer in the package.",
    "Spoke for 15 mins. Budget is tight, suggested trimming 1 night from the package.",
    "Customer is comparing with another operator. Sent our USPs over email.",
    "Follow-up call done. They need to discuss with family before confirming.",
    "Sent customized itinerary as per their requirements. Awaiting response.",
    "Customer confirmed they want to proceed. Waiting for initial deposit.",
    "Called twice, no response. Will try again tomorrow morning.",
    "Customer asked about group discount for 10+ pax. Checking with accounts.",
];

const queries = [
    {
        name: "Rahul Sharma", email: "rahul.sharma@gmail.com", phone: "+919876543210",
        destination: "Manali", packageName: "Manali Snow Adventure – 5N/6D",
        groupSize: 4, travelDate: "2026-06-15",
        message: "Looking for a budget-friendly snow package for family of 4. Need hotel with geyser.",
        source: "WEBSITE_FORM", status: "ACTIVE",
        closeReasonId: null, closeReasonOther: null, closedAt: null,
    },
    {
        name: "Priya Mehta", email: "priya.mehta@outlook.com", phone: "+918765432109",
        destination: "Kerala", packageName: "Kerala Backwaters Bliss – 6N/7D",
        groupSize: 2, travelDate: "2026-07-10",
        message: "Honeymoon trip. Interested in houseboat stay and Munnar. Budget around 50k.",
        source: "LANDING_PAGE", status: "ACTIVE",
        closeReasonId: null, closeReasonOther: null, closedAt: null,
    },
    {
        name: "Amit Verma", email: null, phone: "+917654321098",
        destination: "Rajasthan", packageName: "Royal Rajasthan – 7N/8D",
        groupSize: 6, travelDate: "2026-08-20",
        message: "Corporate group trip. Need AC coach and 4-star hotels throughout.",
        source: "PHONE_CALL", status: "ACTIVE",
        closeReasonId: null, closeReasonOther: null, closedAt: null,
    },
    {
        name: "Sunita Joshi", email: "sunita.joshi@yahoo.com", phone: "+916543210987",
        destination: "Goa", packageName: "Goa Beach Escape – 4N/5D",
        groupSize: 8, travelDate: "2026-12-22",
        message: "Friends trip for New Year. Need beach-facing rooms and party vibes.",
        source: "WHATSAPP", status: "ACTIVE",
        closeReasonId: null, closeReasonOther: null, closedAt: null,
    },
    {
        name: "Deepak Nair", email: "deepak.nair@gmail.com", phone: "+915432109876",
        destination: "Ladakh", packageName: "Leh Ladakh Expedition – 8N/9D",
        groupSize: 3, travelDate: "2026-09-05",
        message: "Bike trip with friends. Need bike rentals and camping arrangements.",
        source: "REFERRAL", status: "ACTIVE",
        closeReasonId: null, closeReasonOther: null, closedAt: null,
    },
    {
        name: "Kavita Singh", email: "kavita.singh@gmail.com", phone: "+914321098765",
        destination: "Shimla", packageName: "Shimla Weekend Getaway – 2N/3D",
        groupSize: 2, travelDate: "2026-05-30",
        message: "Quick weekend trip. Looking for a cozy cottage with mountain view.",
        source: "WEBSITE_FORM", status: "CLOSED",
        closeReasonId: "COST_TOO_HIGH", closeReasonOther: null, closedAt: "2026-05-01",
    },
    {
        name: "Rohan Gupta", email: "rohan.gupta@hotmail.com", phone: "+913210987654",
        destination: "Andaman", packageName: "Andaman Island Hopper – 5N/6D",
        groupSize: 4, travelDate: "2026-10-15",
        message: "Anniversary trip. Want scuba diving and private beach arrangements.",
        source: "LANDING_PAGE", status: "CLOSED",
        closeReasonId: "BOOKED_ELSEWHERE", closeReasonOther: null, closedAt: "2026-04-28",
    },
];

function randomNote(): string {
    return FOLLOW_UP_NOTES[Math.floor(Math.random() * FOLLOW_UP_NOTES.length)];
}

async function main() {
    console.log("🌱 Seeding sales queries for Vikrant...\n");

    // Clean up existing data for this user
    const { rows: existing } = await pool.query(
        `SELECT id FROM "SalesQuery" WHERE "assignedTo" = $1`,
        [MY_USER_ID]
    );
    if (existing.length > 0) {
        console.log(`🗑  Removing ${existing.length} existing record(s)...`);
        await pool.query(`DELETE FROM "SalesQuery" WHERE "assignedTo" = $1`, [MY_USER_ID]);
    }

    for (const q of queries) {
        const assignedAt = new Date(Date.now() - Math.floor(Math.random() * 7 * 24 * 60 * 60 * 1000));

        // Insert the SalesQuery row
        const { rows } = await pool.query(
            `INSERT INTO "SalesQuery" (
                id, name, email, phone, "countryCode",
                destination, "packageName", "groupSize", "travelDate",
                message, source, status,
                "assignedTo", "assignedAt",
                "closeReasonId", "closeReasonOther", "closedAt", "closedBy",
                "createdAt", "updatedAt"
            ) VALUES (
                gen_random_uuid(), $1, $2, $3, 'IN',
                $4, $5, $6, $7::date,
                $8, $9, $10,
                $11, $12,
                $13, $14, $15::date, $16,
                NOW(), NOW()
            ) RETURNING id`,
            [
                q.name, q.email, q.phone,
                q.destination, q.packageName, q.groupSize, q.travelDate,
                q.message, q.source, q.status,
                MY_USER_ID, assignedAt,
                q.closeReasonId, q.closeReasonOther, q.closedAt,
                q.status === "CLOSED" ? MY_USER_ID : null,
            ]
        );

        const id = rows[0].id;
        console.log(`✅ ${q.name} → ${q.destination} [${q.status}]`);

        // Timeline: assigned event
        await pool.query(
            `INSERT INTO "SalesQueryTimeline" (id, "salesQueryId", event, "actorId", "actorName", meta, "createdAt")
             VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
            [id, `Query assigned to ${MY_NAME}`, MY_USER_ID, MY_NAME, null, assignedAt]
        );

        if (q.status === "ACTIVE") {
            const followUpCount = Math.floor(Math.random() * 3) + 1;

            for (let i = 0; i < followUpCount; i++) {
                const daysAgo = (followUpCount - i) * 2;
                const createdAt = new Date(Date.now() - daysAgo * 24 * 60 * 60 * 1000);
                const followUpAt = i === followUpCount - 1
                    ? new Date(Date.now() + 2 * 24 * 60 * 60 * 1000)
                    : null;

                await pool.query(
                    `INSERT INTO "SalesQueryFollowUp" (id, "salesQueryId", note, "followUpAt", "createdBy", "createdByName", "createdAt")
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
                    [id, randomNote(), followUpAt, MY_USER_ID, MY_NAME, createdAt]
                );

                await pool.query(
                    `INSERT INTO "SalesQueryTimeline" (id, "salesQueryId", event, "actorId", "actorName", meta, "createdAt")
                     VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
                    [id, `📞 Follow-up logged`, MY_USER_ID, MY_NAME, null, createdAt]
                );
            }

            console.log(`   📞 ${followUpCount} follow-up(s) added`);
        }

        if (q.status === "CLOSED" && q.closedAt) {
            await pool.query(
                `INSERT INTO "SalesQueryTimeline" (id, "salesQueryId", event, "actorId", "actorName", meta, "createdAt")
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, $6)`,
                [
                    id,
                    `❌ Query Closed — ${q.closeReasonId?.replace(/_/g, " ")}`,
                    MY_USER_ID, MY_NAME, null,
                    new Date(q.closedAt),
                ]
            );
        }
    }

    console.log(`\n🎉 Done! Seeded ${queries.length} queries (${queries.filter(q => q.status === "ACTIVE").length} active, ${queries.filter(q => q.status === "CLOSED").length} closed)`);
}

main()
    .catch((e) => { console.error("❌ Seed failed:", e.message); process.exit(1); })
    .finally(() => pool.end());