// prisma/seed.ts

import * as dotenv from "dotenv";
dotenv.config({ path: ".env" });
dotenv.config({ path: ".env.local" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg }     from "@prisma/adapter-pg";
import pg               from "pg";

const pool    = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl: false });
const adapter = new PrismaPg(pool as never);
const db      = new PrismaClient({ adapter } as never);

async function seed() {
  console.log("🌱 Seeding travel history test data...\n");

  // ── Clean only booking-related tables ──────────────────────────────────
  await db.payment.deleteMany();
  await db.booking.deleteMany();
  await db.travelPreference.deleteMany();
  console.log("🧹 Cleaned\n");

  // ── Get existing destination IDs ────────────────────────────────────────
// prisma/seed.ts — replace the destinations section with this

// ── Seed regions and destinations if empty ─────────────────────────────
let destinations = await db.destinations.findMany({
  select: { id: true, name: true },
});

if (destinations.length === 0) {
  console.log("No destinations found — creating...");

  const northIndia = await db.regions.upsert({
    where:  { slug: "north-india" },
    update: {},
    create: { name: "North India", slug: "north-india", country: "India" },
  });

  const westIndia = await db.regions.upsert({
    where:  { slug: "west-india" },
    update: {},
    create: { name: "West India", slug: "west-india", country: "India" },
  });

  await db.destinations.createMany({
    data: [
      { name: "Kashmir",          slug: "kashmir",          region_id: northIndia.id, country: "India" },
      { name: "Himachal Pradesh", slug: "himachal-pradesh", region_id: northIndia.id, country: "India" },
      { name: "Goa",              slug: "goa",              region_id: westIndia.id,  country: "India" },
    ],
  });

  destinations = await db.destinations.findMany({
    select: { id: true, name: true },
  });

  console.log("✅ Created destinations");
}

console.log("Destinations:", destinations.map(d => `${d.id}:${d.name}`));

  const d0 = destinations[0];
  const d1 = destinations[1] ?? destinations[0];
  const d2 = destinations[2] ?? destinations[0];

  // ── Upsert test user ────────────────────────────────────────────────────
  const user = await db.user.upsert({
    where:  { email: "test@dreamsyatri.com" },
    update: {},
    create: {
      email:             "test@dreamsyatri.com",
      name:              "Test User",
      phone:             "9876543210",
      country_code:      "+91",
      emailVerified:     new Date(),
      gender:            "MALE",
      dateOfBirth:       new Date("1995-08-15"),
      nationality:       "Indian",
      state:             "Himachal Pradesh",
      city:              "Shimla",
      isProfileComplete: true,
    },
  });
  console.log(`✅ User: ${user.email} (${user.id})`);

  // ── Travel preferences ──────────────────────────────────────────────────
  await db.travelPreference.upsert({
    where:  { userId: user.id },
    update: {},
    create: {
      userId:    user.id,
      tripTypes: ["Adventure", "Pilgrimage"],
      groupType: "Family",
      budget:    "MidRange",
      duration:  "Week",
      months:    ["Apr", "May", "Oct"],
    },
  });
  console.log("✅ Travel preferences");

  // ── Bookings ────────────────────────────────────────────────────────────
  const b1 = await db.booking.create({
    data: {
      userId:        user.id,
      bookingNumber: "DY-2024-0001",
      destinationId: d0.id,
      tripType:      "Pilgrimage",
      startDate:     new Date("2024-06-01"),
      endDate:       new Date("2024-06-08"),
      duration:      7,
      travellers:    4,
      status:        "COMPLETED",
      totalAmount:   45000,
      paidAmount:    45000,
    },
  });

  const b2 = await db.booking.create({
    data: {
      userId:        user.id,
      bookingNumber: "DY-2024-0002",
      destinationId: d1.id,
      tripType:      "Family",
      startDate:     new Date("2024-12-20"),
      endDate:       new Date("2024-12-25"),
      duration:      5,
      travellers:    3,
      status:        "COMPLETED",
      totalAmount:   28000,
      paidAmount:    28000,
    },
  });

  const b3 = await db.booking.create({
    data: {
      userId:        user.id,
      bookingNumber: "DY-2025-0001",
      destinationId: d2.id,
      tripType:      "Leisure",
      startDate:     new Date("2025-05-10"),
      endDate:       new Date("2025-05-16"),
      duration:      6,
      travellers:    2,
      status:        "CANCELLED",
      totalAmount:   32000,
      paidAmount:    16000,
      cancelledAt:   new Date("2025-04-01"),
      cancelReason:  "Change of plans",
    },
  });

  const b4 = await db.booking.create({
    data: {
      userId:        user.id,
      bookingNumber: "DY-2026-0001",
      destinationId: d0.id,
      tripType:      "Adventure",
      startDate:     new Date("2026-05-15"),
      endDate:       new Date("2026-05-22"),
      duration:      7,
      travellers:    2,
      status:        "UPCOMING",
      totalAmount:   95000,
      paidAmount:    47500,
    },
  });

  const b5 = await db.booking.create({
    data: {
      userId:        user.id,
      bookingNumber: "DY-2026-0002",
      destinationId: d1.id,
      tripType:      "Honeymoon",
      startDate:     new Date("2026-07-01"),
      endDate:       new Date("2026-07-08"),
      duration:      7,
      travellers:    2,
      status:        "UPCOMING",
      totalAmount:   120000,
      paidAmount:    60000,
    },
  });

  console.log("✅ Bookings: 5");

  // ── Payments ────────────────────────────────────────────────────────────
  await db.payment.create({ data: { userId: user.id, bookingId: b1.id, amount: 45000, gateway: "RAZORPAY", method: "UPI",         status: "SUCCESS",  gatewayOrderId: "order_001", gatewayPaymentId: "pay_001", paidAt: new Date("2024-05-01") } });
  await db.payment.create({ data: { userId: user.id, bookingId: b2.id, amount: 28000, gateway: "RAZORPAY", method: "CARD",        status: "SUCCESS",  gatewayOrderId: "order_002", gatewayPaymentId: "pay_002", paidAt: new Date("2024-11-20") } });
  await db.payment.create({ data: { userId: user.id, bookingId: b3.id, amount: 16000, gateway: "RAZORPAY", method: "NET_BANKING", status: "REFUNDED", gatewayOrderId: "order_003", gatewayPaymentId: "pay_003", paidAt: new Date("2025-03-01"), refundAmount: 16000, refundedAt: new Date("2025-04-05") } });
  await db.payment.create({ data: { userId: user.id, bookingId: b4.id, amount: 47500, gateway: "RAZORPAY", method: "UPI",         status: "SUCCESS",  gatewayOrderId: "order_004", gatewayPaymentId: "pay_004", paidAt: new Date("2026-03-01") } });
  await db.payment.create({ data: { userId: user.id, bookingId: b5.id, amount: 60000, gateway: "RAZORPAY", method: "EMI",         status: "SUCCESS",  gatewayOrderId: "order_005", gatewayPaymentId: "pay_005", paidAt: new Date("2026-04-01") } });
  await db.payment.create({ data: { userId: user.id, bookingId: b5.id, amount: 60000, gateway: "RAZORPAY", method: "CARD",        status: "FAILED",   gatewayOrderId: "order_006", failureReason: "Insufficient funds" } });

  console.log("✅ Payments: 6");

  console.log("\n🎉 Done");
  console.log("📋 Login as: test@dreamsyatri.com");
  console.log("📋 Test: GET /api/user/travel-history?status=UPCOMING");
}

seed()
  .catch((e) => { console.error("❌ Failed:", e.message); process.exit(1); })
  .finally(async () => { await db.$disconnect(); await pool.end(); });