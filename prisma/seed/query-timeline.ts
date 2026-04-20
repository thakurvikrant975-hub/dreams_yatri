import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding QueryTimeline...");

  const query = await db.packageQuery.findFirst();
  const member = await db.teamMember.findFirst();

  if (!query) {
    console.warn("⚠️  No PackageQuery found. Run package-queries seed first.");
    return;
  }

  await db.queryTimeline.createMany({
    data: [
      {
        queryId:   query.id,
        actorId:   member?.id ?? null,
        actorName: member?.name ?? "System",
        event:     "QUERY_CREATED",
        meta:      { source: "LANDING_PAGE" },
      },
      {
        queryId:   query.id,
        actorId:   member?.id ?? null,
        actorName: member?.name ?? "System",
        event:     "STATUS_CHANGED",
        meta:      { from: "SUBMITTED", to: "IN_PROGRESS" },
      },
      {
        queryId:   query.id,
        actorId:   member?.id ?? null,
        actorName: member?.name ?? "System",
        event:     "NOTE_ADDED",
        meta:      { note: "First call attempt made" },
      },
    ],
  });

  console.log("✅ QueryTimeline seeded");
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });