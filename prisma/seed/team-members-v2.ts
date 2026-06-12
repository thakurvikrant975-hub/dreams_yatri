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
      employeeId:        "DY100001",
      name:              "Devs",
      email:             "devs@dreamsyatri.com",
      password:          await hash("Devs@123", 12),
      roleId:            roleMap["sales"],
      designation:       "Sales Executive",
      joiningDate:       "2022-01-01",  
      personalEmail:     "vikrant@gmail.com",
      personalMobile:    "8799678450",
      alternativeMobile: "9876678970",
      fatherName:        "Rajesh Thakur",
      fatherMobile:      "9876543210",
      motherName:        "Sunita Thakur",
      motherMobile:      "9123456780",
      aadhaarNumber:     "123412341234",
      panNumber:         "ABCDE1234F",
    },
  ];

  for (const m of members) {
    await pool.query(
      `INSERT INTO team_members (
         id, "employeeId", name, email, password,
         designation, "teamRoleId", "joiningDate",
         "personalEmail", "personalMobile", "alternativeMobile",
         "fatherName", "fatherMobile",
         "motherName", "motherMobile",
         "aadhaarNumber", "panNumber",
         "isActive", "createdAt", "updatedAt"
       )
       VALUES (
         gen_random_uuid(), $1, $2, $3, $4,
         $5, $6, $7,
         $8, $9, $10,
         $11, $12,
         $13, $14,
         $15, $16,
         true, NOW(), NOW()
       )
       ON CONFLICT (email) DO UPDATE
         SET "employeeId"        = EXCLUDED."employeeId",
             name                = EXCLUDED.name,
             designation         = EXCLUDED.designation,
             "teamRoleId"        = EXCLUDED."teamRoleId",
             "personalEmail"     = EXCLUDED."personalEmail",
             "personalMobile"    = EXCLUDED."personalMobile",
             "alternativeMobile" = EXCLUDED."alternativeMobile",
             "fatherName"        = EXCLUDED."fatherName",
             "fatherMobile"      = EXCLUDED."fatherMobile",
             "motherName"        = EXCLUDED."motherName",
             "motherMobile"      = EXCLUDED."motherMobile",
             "aadhaarNumber"     = EXCLUDED."aadhaarNumber",
             "panNumber"         = EXCLUDED."panNumber",
             "updatedAt"         = NOW()`,
      [
        m.employeeId, m.name, m.email, m.password,
        m.designation, m.roleId, m.joiningDate,
        m.personalEmail, m.personalMobile, m.alternativeMobile,
        m.fatherName, m.fatherMobile,
        m.motherName, m.motherMobile,
        m.aadhaarNumber, m.panNumber,
      ]
    );

    console.log(`  -> ${m.employeeId} — ${m.name}`);
  }

  console.log("✅ TeamMember seeded");
}

main()
  .catch(console.error)
  .finally(() => pool.end());