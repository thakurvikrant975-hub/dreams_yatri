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
      name:              "Vikrant Thakur",
      email:             "vikrant@dreamsyatri.com",
      password:          await hash("Admin@123", 12),
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
    {
      employeeId:        "DY100002",
      name:              "Ravi Kant",
      email:             "ravi@dreamsyatri.com",
      password:          await hash("Ops@1234", 12),
      roleId:            roleMap["sales"],
      designation:       "Operations Executive",
      joiningDate:       "2022-06-01",
      personalEmail:     "ravi.kant@gmail.com",
      personalMobile:    "9012345678",
      alternativeMobile: "9090909090",
      fatherName:        "Mahesh Kant",
      fatherMobile:      "9988776655",
      motherName:        "Poonam Kant",
      motherMobile:      "8877665544",
      aadhaarNumber:     "234523452345",
      panNumber:         "FGHIJ5678K",
    },
    {
      employeeId:        "DY100003",
      name:              "Karan",
      email:             "karan@dreamsyatri.com",
      password:          await hash("Mkt@1234", 12),
      roleId:            roleMap["sales"],
      designation:       "Marketing Executive",
      joiningDate:       "2023-03-01",
      personalEmail:     "karan@gmail.com",
      personalMobile:    "9345678901",
      alternativeMobile: "9234567890",
      fatherName:        "Suresh Kumar",
      fatherMobile:      "9111111111",
      motherName:        "Anita Kumar",
      motherMobile:      "9222222222",
      aadhaarNumber:     "345634563456",
      panNumber:         "KLMNO9012P",
    },
    {
      employeeId:        "DY100004",
      name:              "Trisha",
      email:             "trisha@dreamsyatri.com",
      password:          await hash("Mkt@1234", 12),
      roleId:            roleMap["sales"],
      designation:       "Marketing Executive",
      joiningDate:       "2023-03-01",
      personalEmail:     "trisha@gmail.com",
      personalMobile:    "9456789012",
      alternativeMobile: "9345678901",
      fatherName:        "Amit Sharma",
      fatherMobile:      "9333333333",
      motherName:        "Neha Sharma",
      motherMobile:      "9444444444",
      aadhaarNumber:     "456745674567",
      panNumber:         "QRSTU3456V",
    },
    {
      employeeId:        "DY100005",
      name:              "Karuna",
      email:             "karuna@dreamsyatri.com",
      password:          await hash("Mkt@1234", 12),
      roleId:            roleMap["sales"],
      designation:       "Marketing Executive",
      joiningDate:       "2023-03-01",
      personalEmail:     "karuna@gmail.com",
      personalMobile:    "9567890123",
      alternativeMobile: "9456789012",
      fatherName:        "Rakesh Verma",
      fatherMobile:      "9555555555",
      motherName:        "Meena Verma",
      motherMobile:      "9666666666",
      aadhaarNumber:     "567856785678",
      panNumber:         "WXYZA7890B",
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