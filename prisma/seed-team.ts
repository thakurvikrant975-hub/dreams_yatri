import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const db = new PrismaClient({ adapter } as never);

async function main() {
  console.log("🌱 Seeding departments and team roles...\n");

  const depts = ["Marketing", "Operations", "Sales", "Tech", "Finance"];
  for (const name of depts) {
    await db.department.upsert({
      where: { name },
      update: {},
      create: { name },
    });
    console.log(`  ✓ Department: ${name}`);
  }

  const teamRoles = [
    { name: "Marketing Manager", permissions: ["leads.*", "campaigns.*"] },
    { name: "Operations Manager", permissions: ["leads.*", "packages.*", "hotels.*"] },
    { name: "Sales Executive", permissions: ["leads.view", "leads.edit"] },
    { name: "Tech Lead", permissions: ["*"] },
    { name: "Content Writer", permissions: ["packages.view", "blogs.*"] },
  ];

  for (const r of teamRoles) {
    await db.teamRole.upsert({
      where: { name: r.name },
      update: { permissions: r.permissions },
      create: r,
    });
    console.log(`  ✓ Role: ${r.name}`);
  }

  console.log("\n✅ Done");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });