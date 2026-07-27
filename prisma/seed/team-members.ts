import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Seeding TeamMember...");

  // Fetch role IDs via raw SQL to avoid adapter deserialization bug
 const { rows: roles } = await pool.query(
  `SELECT id, name FROM team_roles WHERE name = ANY($1)`,
  [["Super Admin", "Operations Manager", "Sales Executive", "Marketing Manager", "sales", "Full Stack Developer"]]
);

  const roleMap: Record<string, string> = {};
  for (const r of roles) roleMap[r.name] = r.id;

  if (!roleMap["Super Admin"]) {
    console.error("❌ TeamRoles not found. Run team-roles.ts seed first.");
    process.exit(1);
  }

  const members = [
    {
      name:       "Vikrant Thakur",
      email:      "vikrant@dreamsyatri.com",
      password:   await hash("Admin@123", 12),
      roleId:     roleMap["sales"],
      joiningDate: "2022-01-01",
    },
    {
      name:       "Ravi Kant",
      email:      "ravi@dreamsyatri.com",
      password:   await hash("Ops@1234", 12),
      roleId:     roleMap["sales"] ?? null,
      joiningDate: "2022-06-01",
    },
    {
      name:       "Karan",
      email:      "karan@dreamsyatri.com",
      password:   await hash("Mkt@1234", 12),
      roleId:     roleMap["sales"] ?? null,
      joiningDate: "2023-03-01",
    },
    {
      name:       "Trisha",
      email:      "trisha@dreamsyatri.com",
      password:   await hash("Mkt@1234", 12),
      roleId:     roleMap["sales"] ?? null,
      joiningDate: "2023-03-01",
    },

    {
      name:       "Karuna",
      email:      "karuna@dreamsyatri.com",
      password:   await hash("Mkt@1234", 12),
      roleId:     roleMap["sales"] ?? null,
      joiningDate: "2023-03-01",
    },
    {
      name:       "Devs",
      email:      "dev@dreamsyatri.com",
      password:   await hash("Devs@#123", 12),
      roleId:     roleMap["Full Stack Developer"] ?? null,
      joiningDate: "2022-01-01",
    },
  ];

  for (const m of members) {
    await pool.query(
      `INSERT INTO team_members (id, name, email, password, "teamRoleId", "joiningDate", "isActive", "createdAt", "updatedAt")
       VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, true, NOW(), NOW())
       ON CONFLICT (email) DO UPDATE
         SET name        = EXCLUDED.name,
             "teamRoleId" = EXCLUDED."teamRoleId",
             "updatedAt"  = NOW()`,
      [m.name, m.email, m.password, m.roleId ?? null, m.joiningDate]
    );
    console.log("  ->", m.name);
  }

  console.log("✅ TeamMember seeded");
}

main()
  .catch(console.error)
  .finally(() => pool.end());
