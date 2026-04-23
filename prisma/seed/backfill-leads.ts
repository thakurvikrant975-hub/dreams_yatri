import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const db      = new PrismaClient({ adapter } as never);

async function backfill() {
    const queries = await db.packageQuery.findMany({
        orderBy: { createdAt: "asc" },
    });

    console.log(`Processing ${queries.length} queries...`);

    for (const q of queries) {
        const normalizedPhone = q.phone.replace(/[\s\-().+]/g, "");

        const profile = await db.leadProfile.upsert({
            where:  { phone: normalizedPhone },
            update: {
                lastSeenAt:   q.createdAt,
                totalQueries: { increment: 1 },
            },
            create: {
                phone: normalizedPhone,
                name:  q.name,
                email: q.email,
            },
        });

        await db.packageQuery.update({
            where: { id: q.id },
            data:  { leadProfileId: profile.id },
        });

        console.log(`✓ ${q.name} — ${q.phone} → profile ${profile.id}`);
    }

    console.log("\n✅ Backfill complete!");
}

backfill()
    .catch(console.error)
    .finally(() => db.$disconnect());
