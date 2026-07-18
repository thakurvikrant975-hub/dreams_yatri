import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query(`SELECT id, email, role, status FROM "User" WHERE email IS NOT NULL AND status NOT IN ('BANNED','DELETED') LIMIT 5`);
console.log(JSON.stringify(res.rows));
await client.end();
