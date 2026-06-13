import "dotenv/config";
import { createIPv4Pool } from "./pg-ipv4";
import { PrismaClient } from "@/app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const departments = [
  { name: "Sales",       description: "Convert leads into confirmed bookings and manage client packages." },
  { name: "Marketing",   description: "Generate and qualify inbound leads via campaigns and digital channels." },
  { name: "Operations",  description: "Coordinate hotel, cab, and ground logistics for confirmed bookings." },
  { name: "Finance",     description: "Handle invoicing, payment reconciliation, and vendor settlements." },
  { name: "Support",     description: "Handle post-booking client queries, complaints, and escalations." },
  { name: "Technology",  description: "Build and maintain the internal platform, integrations, and tooling." },
  { name: "Management",  description: "Executive leadership and cross-department oversight." },
];

async function main() {
  const pool = await createIPv4Pool(process.env.DATABASE_URL!);
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.log("🌱 Seeding departments...\n");

  for (const dept of departments) {
    const result = await prisma.department.upsert({
      where: { name: dept.name },
      update: { description: dept.description },
      create: dept,
    });
    console.log(`✅  ${result.name} — ${result.id}`);
  }

  console.log("\n✨ Done. All departments seeded.");

  await prisma.$disconnect();
  await pool.end();
}

main().catch((e) => { console.error("❌ Seed failed:", e); process.exit(1); });
