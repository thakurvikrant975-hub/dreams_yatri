import "dotenv/config";
import { Pool } from "pg";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const roles = [
  {
    name: "Super Admin",
    description: "Full access to all modules and settings",
    permissions: ["team:read","team:write","team:delete","queries:read","queries:write","queries:delete","packages:read","packages:write","packages:delete","hotels:read","hotels:write","hotels:delete","reports:read","settings:read","settings:write","roles:read","roles:write"],
  },
  {
    name: "Operations Manager",
    description: "Manages queries, packages, and team assignments",
    permissions: ["team:read","queries:read","queries:write","packages:read","packages:write","hotels:read","hotels:write","reports:read"],
  },
  {
    name: "Sales Executive",
    description: "Handles inbound queries and follow-ups",
    permissions: ["queries:read","queries:write","packages:read"],
  },
  {
    name: "Marketing Manager",
    description: "Manages campaigns, leads, and performance reports",
    permissions: ["queries:read","packages:read","reports:read"],
  },
  {
    name: "sales",
    description: "Manages package content, hotels, and media",
    permissions: ["packages:read","packages:write","hotels:read","hotels:write"],
  },
];

async function main() {
  console.log("Seeding TeamRole...");

  for (const role of roles) {
    await pool.query(
      `INSERT INTO team_roles (id, name, description, permissions, "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3::jsonb, NOW(), NOW())
       ON CONFLICT (name) DO UPDATE
         SET description = EXCLUDED.description,
             permissions = EXCLUDED.permissions,
             "updatedAt" = NOW()`,
      [role.name, role.description ?? null, JSON.stringify(role.permissions)]
    );

    console.log("  ->", role.name);
  }

  console.log("✅ TeamRole seeded");
}

main()
  .catch(console.error)
  .finally(() => pool.end());