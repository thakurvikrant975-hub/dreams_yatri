import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });

async function main() {
  const rows = await db.package_queries.findMany({
    select: { id: true, name: true, status: true, phone: true },
    orderBy: { createdAt: "desc" },
    take: 15,
  });
  console.table(rows);
}

main().finally(async () => {
  await db.$disconnect();
  await pool.end();
});
