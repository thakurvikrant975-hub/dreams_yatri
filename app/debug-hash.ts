// app/debug-hash.ts
import "dotenv/config";
import { Pool } from "pg";
import { compare } from "bcryptjs";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  const { rows } = await pool.query(
    `SELECT password FROM team_members WHERE email = 'vikrant@dreamsyatri.com'`
  );

  const stored = rows[0]?.password;
  console.log("Stored hash:", stored);

  if (!stored) {
    console.error("❌ No password found — seed didn't run or email is wrong");
    process.exit(1);
  }

  const result = await compare("Admin@123", stored);
  console.log("Match:", result);
  await pool.end();
}

main().catch(console.error);