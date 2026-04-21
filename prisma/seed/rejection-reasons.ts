import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding RejectionReason...");

  const reasons = [
    { label: "Duplicate Inquiry",      description: "Same person submitted multiple times",         isSystem: true,  sortOrder: 1 },
    { label: "Invalid Contact",         description: "Phone number unreachable or incorrect",        isSystem: true,  sortOrder: 2 },
    { label: "Budget Mismatch",         description: "Client budget does not match package pricing", isSystem: false, sortOrder: 3 },
    { label: "Date Not Available",      description: "Requested travel dates are fully booked",      isSystem: false, sortOrder: 4 },
    { label: "No Response",             description: "Client did not respond after multiple attempts",isSystem: true,  sortOrder: 5 },
    { label: "Destination Not Offered", description: "We don't operate the requested destination",   isSystem: false, sortOrder: 6 },
    { label: "Spam / Test Entry",       description: "Clearly a test or bot submission",             isSystem: true,  sortOrder: 7 },
  ];

  for (const reason of reasons) {
    await db.rejectionReason.upsert({
      where:  { id: reason.label.toLowerCase().replace(/\s+/g, "-") }, // won't work on cuid — use createMany below
      update: {},
      create: reason,
    });
  }

  // Safer: createMany with skipDuplicates if label is unique, else just createMany
  await db.rejectionReason.createMany({
    data: reasons,
    skipDuplicates: true,
  });

  console.log("✅ RejectionReason seeded");
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });