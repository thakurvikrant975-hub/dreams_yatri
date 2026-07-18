import pg from "pg";
const { Client } = pg;
const client = new Client({ connectionString: process.env.DATABASE_URL });
await client.connect();
const res = await client.query(`
  SELECT tm.id, tm.name, tm.email, tm."departmentId", tr.name as role, tr.permissions, tr."pageAccess"
  FROM "team_members" tm
  LEFT JOIN "team_roles" tr ON tm."teamRoleId" = tr.id
  WHERE tm."isActive" = true AND tr."pageAccess" @> '["/dashboard/packages"]'::jsonb
  LIMIT 1
`);
console.log(JSON.stringify(res.rows, null, 2));
await client.end();
