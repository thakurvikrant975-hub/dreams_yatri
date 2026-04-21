import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const departments = [
  { name: "Management",        description: "Founders and executive leadership" },
  { name: "Operations",        description: "Tour operations, logistics, and coordination" },
  { name: "Sales",             description: "Inbound query handling and conversions" },
  { name: "Marketing",         description: "Campaigns, ads, and lead generation" },
  { name: "Content",           description: "Package content, media, and copywriting" },
  { name: "Finance",           description: "Billing, payments, and accounts" },
  { name: "Customer Support",  description: "Post-booking support and grievance handling" },
];

async function main() {
  console.log("Seeding Department...");

  for (const dept of departments) {
    await pool.query(
      `INSERT INTO departments (id, name, description, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             "updatedAt" = NOW()`,
      [dept.name, dept.description ?? null]
    );
    console.log("  ->", dept.name);
  }

  console.log("✅ Department seeded");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
