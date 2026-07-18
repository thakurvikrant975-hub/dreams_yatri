import pg from "pg";
import crypto from "crypto";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const token = crypto.randomBytes(24).toString("hex");
const id = "cm" + crypto.randomBytes(12).toString("hex");
const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
await client.query(
  `INSERT INTO "MagicSession" (id, token, email, "expiresAt", "createdAt") VALUES ($1,$2,$3,$4,now())`,
  [id, token, "thakurvikrant975@gmail.com", expiresAt],
);
console.log(token);
await client.end();
