import "dotenv/config";
import { createIPv4Pool } from "./pg-ipv4";

async function main() {
  const pool = await createIPv4Pool(process.env.DATABASE_URL!);
  const { rows } = await pool.query(
    "SELECT type, COUNT(*) as cnt FROM locations GROUP BY type ORDER BY type"
  );
  const total = rows.reduce((a: number, r: { cnt: string }) => a + Number(r.cnt), 0);
  rows.forEach((r: { type: string; cnt: string }) =>
    console.log(r.type.padEnd(12), Number(r.cnt).toLocaleString())
  );
  console.log("─────────────────────");
  console.log("TOTAL".padEnd(12), total.toLocaleString());
  await pool.end();
}

main().catch(console.error);
