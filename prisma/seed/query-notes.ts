import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding QueryNote...");

  // Fetch first query and first team member to attach notes
  const query = await db.packageQuery.findFirst();
  const member = await db.teamMember.findFirst();

  if (!query || !member) {
    console.warn("⚠️  No PackageQuery or TeamMember found. Run those seeds first.");
    return;
  }

  await db.queryNote.createMany({
    data: [
      {
        queryId:  query.id,
        authorId: member.id,
        content:  "Called client — going to voicemail. Will retry tomorrow morning.",
      },
      {
        queryId:  query.id,
        authorId: member.id,
        content:  "Client confirmed 4 pax, interested in houseboat + Pahalgam combo.",
      },
    ],
  });

  console.log("✅ QueryNote seeded");
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });