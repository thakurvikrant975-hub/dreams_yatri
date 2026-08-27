import dns from "dns";
import net from "net";
import pg from "pg";

dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const { Pool } = pg;

async function main() {
  const url = new URL(process.env.DATABASE_URL!);
  const pool = new Pool({
    host: url.hostname,
    port: parseInt(url.port) || 5432,
    database: url.pathname.slice(1),
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    ssl: { rejectUnauthorized: false, servername: url.hostname },
  });
  const res = await pool.query(`select id, name, "pageAccess" from team_roles where name ilike 'team leader'`);
  console.log(JSON.stringify(res.rows, null, 2));
  await pool.end();
}

main().catch((e) => { console.error(e); process.exit(1); });
