import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding PackageQuery...");

  await db.packageQuery.createMany({
    data: [
      {
        name: "Rahul Sharma",
        phone: "9876543210",
        email: "rahul@example.com",
        destination: "Kashmir",
        packageName: "Kashmir Grand Tour",
        travelDate: new Date("2025-06-15"),
        groupSize: 4,
        source: "LANDING_PAGE",
        status: "SUBMITTED",
        utmSource: "google",
        utmMedium: "cpc",
        utmCampaign: "kashmir-summer-2025",
      },
      {
        name: "Priya Mehta",
        phone: "9812345678",
        email: "priya@example.com",
        destination: "Goa",
        packageName: "Goa Beach Escape",
        travelDate: new Date("2025-05-20"),
        groupSize: 2,
        source: "WEBSITE_FORM",
        status: "IN_PROGRESS",
        assignedTo: "cm_placeholder_id", // replace with actual TeamMember id after seeding team
      },
      {
        name: "Amit Verma",
        phone: "9701234567",
        destination: "Dubai",
        source: "WHATSAPP",
        status: "VERIFIED",
        verified: true,
        verifiedAt: new Date(),
        groupSize: 3,
      },
      {
        name: "Sunita Rawat",
        phone: "9988776655",
        destination: "Shimla",
        source: "PHONE_CALL",
        status: "REJECTED",
        rejectionNote: "Duplicate inquiry from same number",
      },
    ],
    skipDuplicates: true,
  });

  console.log("✅ PackageQuery seeded");
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });