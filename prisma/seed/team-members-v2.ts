import "dotenv/config";
import { Pool } from "pg";
import { hash } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  console.log("Seeding TeamMember...");

  const { rows: roles } = await pool.query(
    `SELECT id, name FROM team_roles WHERE name = ANY($1)`,
    [["Super Admin", "Operations Manager", "Sales Executive", "Marketing Manager", "sales"]]
  );

  const roleMap: Record<string, string> = {};
  for (const r of roles) roleMap[r.name] = r.id;

  const members = [
    {
      employeeId:  "DY100001",
      name:        "Vikrant Thakur",
      email:       "vikrant@dreamsyatri.com",
      password:    await hash("Admin@123", 12),
      roleId:      roleMap["sales"] ?? null,
      designation: "Sales Executive",
      joiningDate: "2022-01-01",
    },
    {
      employeeId:  "DY100002",
      name:        "Ravi Kant",
      email:       "ravi@dreamsyatri.com",
      password:    await hash("Ops@1234", 12),
      roleId:      roleMap["sales"] ?? null,
      designation: "Operations Executive",
      joiningDate: "2022-06-01",
    },
    {
      employeeId:  "DY100003",
      name:        "Karan",
      email:       "karan@dreamsyatri.com",
      password:    await hash("Mkt@1234", 12),
      roleId:      roleMap["sales"] ?? null,
      designation: "Marketing Executive",
      joiningDate: "2023-03-01",
    },
    {
      employeeId:  "DY100004",
      name:        "Trisha",
      email:       "trisha@dreamsyatri.com",
      password:    await hash("Mkt@1234", 12),
      roleId:      roleMap["sales"] ?? null,
      designation: "Marketing Executive",
      joiningDate: "2023-03-01",
    },
    {
      employeeId:  "DY100005",
      name:        "Karuna",
      email:       "karuna@dreamsyatri.com",
      password:    await hash("Mkt@1234", 12),
      roleId:      roleMap["sales"] ?? null,
      designation: "Marketing Executive",
      joiningDate: "2023-03-01",
    },
  ];

  for (const m of members) {
    await pool.query(
      `INSERT INTO team_members (
         id, "employeeId", name, email, password,
         designation, "teamRoleId", "joiningDate",
         "isActive", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid(), $1, $2, $3, $4,
         $5, $6, $7,
         true, NOW(), NOW()
       )
       ON CONFLICT (email) DO UPDATE
         SET "employeeId"  = EXCLUDED."employeeId",
             name          = EXCLUDED.name,
             designation   = EXCLUDED.designation,
             "teamRoleId"  = EXCLUDED."teamRoleId",
             "updatedAt"   = NOW()`,
      [m.employeeId, m.name, m.email, m.password, m.designation, m.roleId, m.joiningDate]
    );
    console.log(`  -> ${m.employeeId} — ${m.name}`);
  }

  console.log("✅ TeamMember seeded");
}

main()
  .catch(console.error)
  .finally(() => pool.end());