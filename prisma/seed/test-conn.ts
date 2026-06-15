import "dotenv/config";
import dns from "dns/promises";
import { Pool } from "pg";

// Parse a postgres URL and return a pg config with hostname resolved to IPv4
async function resolveToIPv4Config(url: string) {
  const parsed = new URL(url);
  const hostname = parsed.hostname;
  const [ip] = await dns.resolve4(hostname);
  return {
    host: ip,
    port: parseInt(parsed.port) || 5432,
    database: parsed.pathname.slice(1),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    ssl: { rejectUnauthorized: false, servername: hostname },
  };
}

async function main() {
  const config = await resolveToIPv4Config(process.env.DATABASE_URL!);
  console.log("Connecting to:", config.host);
  const pool = new Pool(config);
  const client = await pool.connect();
  const { rows } = await client.query("SELECT count(*) FROM departments");
  console.log("✅ Connected:", rows[0].count, "departments");
  client.release();
  await pool.end();
}

main().catch(e => { console.error("❌", e.code, e.message); process.exit(1); });
