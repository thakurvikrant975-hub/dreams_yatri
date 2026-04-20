import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
async function run() {
  const client = await pool.connect();
  console.log("URL:", process.env.DATABASE_URL?.slice(0, 80));
  try {
    await client.query("BEGIN");
    await client.query(`DO $$ BEGIN CREATE TYPE "QueryStatus" AS ENUM ('SUBMITTED','IN_PROGRESS','VERIFIED','REJECTED'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`DO $$ BEGIN CREATE TYPE "QuerySource" AS ENUM ('WEBSITE_FORM','LANDING_PAGE','WHATSAPP','PHONE_CALL','REFERRAL','OTHER'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`);
    await client.query(`CREATE TABLE IF NOT EXISTS "rejection_reasons" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(),"label" TEXT NOT NULL,"description" TEXT,"isSystem" BOOLEAN NOT NULL DEFAULT false,"isActive" BOOLEAN NOT NULL DEFAULT true,"sortOrder" INTEGER NOT NULL DEFAULT 0,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY ("id"));`);
    await client.query(`CREATE TABLE IF NOT EXISTS "package_queries" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(),"name" TEXT NOT NULL,"email" TEXT,"phone" TEXT NOT NULL,"message" TEXT,"packageName" TEXT,"destination" TEXT,"travelDate" TIMESTAMP(3),"groupSize" INTEGER,"source" "QuerySource" NOT NULL DEFAULT 'WEBSITE_FORM',"gclid" TEXT,"utmSource" TEXT,"utmMedium" TEXT,"utmCampaign" TEXT,"pageUrl" TEXT,"status" "QueryStatus" NOT NULL DEFAULT 'SUBMITTED',"verified" BOOLEAN NOT NULL DEFAULT false,"verifiedAt" TIMESTAMP(3),"verifiedBy" TEXT,"rejectionReasonId" TEXT,"rejectionNote" TEXT,"callAttempts" INTEGER NOT NULL DEFAULT 0,"lastAttemptAt" TIMESTAMP(3),"nextFollowUpAt" TIMESTAMP(3),"assignedTo" TEXT,"assignedAt" TIMESTAMP(3),"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY ("id"),FOREIGN KEY ("rejectionReasonId") REFERENCES "rejection_reasons"("id"));`);
    await client.query(`CREATE TABLE IF NOT EXISTS "query_notes" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(),"queryId" TEXT NOT NULL,"authorId" TEXT NOT NULL,"content" TEXT NOT NULL,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY ("id"),FOREIGN KEY ("queryId") REFERENCES "package_queries"("id") ON DELETE CASCADE);`);
    await client.query(`CREATE TABLE IF NOT EXISTS "query_timeline" ("id" TEXT NOT NULL DEFAULT gen_random_uuid(),"queryId" TEXT NOT NULL,"actorId" TEXT,"actorName" TEXT,"event" TEXT NOT NULL,"meta" JSONB,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,PRIMARY KEY ("id"),FOREIGN KEY ("queryId") REFERENCES "package_queries"("id") ON DELETE CASCADE);`);
    await client.query(`INSERT INTO "rejection_reasons" ("label","isSystem","sortOrder") VALUES ('Not Interested',true,1),('Purchased from Competitor',true,2),('Budget Constraints',true,3),('Travel Date Passed',true,4),('No Response (3 Attempts)',true,5),('Duplicate Enquiry',true,6),('Wrong Number',true,7) ON CONFLICT DO NOTHING;`);
    await client.query("COMMIT");
    const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('package_queries','rejection_reasons','query_notes','query_timeline') ORDER BY table_name;`);
    console.log("✅ Done! Tables:", res.rows.map(r => r.table_name).join(", "));
  } catch(e) { await client.query("ROLLBACK"); throw e; }
  finally { client.release(); await pool.end(); }
}
run().catch(e => { console.error("❌", e.message); process.exit(1); });
