/**
 * seed-kavita-booking.ts
 *
 * Converts Kavita Shetty's package_query (status: PAYMENT_INITIATED)
 * into a real Booking + 50% advance Payment.
 *
 * Run:
 *   npx tsx scripts/seed-kavita-booking.ts
 *
 * Prerequisites:
 *   - PaymentType enum added to schema (ADVANCE | BALANCE | FULL)
 *   - Payment.type field added
 *   - npx prisma migrate dev --name add_payment_type
 */

import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import {
  PrismaClient,
  BookingStatus,
  PaymentStatus,
  PaymentGateway,
  PaymentMethod,
  TripType,
  CabType,
  MealPlan,
  RoomSharingType,
} from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ─── helpers ─────────────────────────────────────────────────────────────────

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateBookingNumber(index: number): string {
  const year = new Date().getFullYear();
  return `DY-${year}-${String(index).padStart(5, "0")}`;
}

/** Parse requirements.journey.travelDate → Date */
function parseTravelDate(query: any): Date {
  const raw =
    query.requirements?.journey?.travelDate ??
    query.travelDate ??
    null;
  if (!raw) throw new Error("No travel date found on query");
  return new Date(raw);
}

/** Parse requirements.budget.max → number (total package price) */
function parseTotalAmount(query: any): number {
  return (
    query.requirements?.budget?.max ??
    query.requirements?.budget?.min ??
    50000
  );
}

/** Returns a deterministic fake gatewayPaymentId for seeding */
function fakePaymentId(prefix: string): string {
  return `${prefix}_SEED_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

// ─── Raw FK update (bypasses Prisma enum issues on status) ────────────────────

async function rawUpdate(
  table: string,
  id: string,
  fields: Record<string, string | number | boolean | null>
) {
  let i = 1;
  const setClauses = Object.entries(fields)
    .map(([col]) => `"${col}" = $${i++}`)
    .join(", ");
  await db.$queryRawUnsafe(
    `UPDATE ${table} SET ${setClauses} WHERE id = $${i}`,
    ...Object.values(fields),
    id
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Converting Kavita Shetty query → Booking + Payment\n");

  // 1. Load the query
  const query = await db.package_queries.findFirst({
    where: {
      name: { contains: "Kavita", mode: "insensitive" },
      status: "PAYMENT_INITIATED",
    },
  });

  if (!query) {
    throw new Error(
      "❌ No PAYMENT_INITIATED query found for Kavita. " +
      "Make sure package_queries.json data has been seeded first."
    );
  }

  console.log(`✓ Found query: ${query.id}`);
  console.log(`  Name      : ${query.name}`);
  console.log(`  Phone     : ${query.phone}`);
  console.log(`  Package   : ${query.packageName}`);
  console.log(`  Dest      : ${query.destination}`);

  // 2. Check it hasn't already been converted
  if (query.booking) {
    // Prisma returns the booking relation only if included; let's check via booking table
  }
  const existingBooking = await db.booking.findUnique({
    where: { sourceQueryId: query.id },
  });
  if (existingBooking) {
    console.log(`\n⚠️  Query already converted → ${existingBooking.bookingNumber}`);
    console.log("   Delete the booking first if you want to re-seed.");
    return;
  }

  // 3. Parse query requirements
  const req = query.requirements as any;
  const travelDate = parseTravelDate(query);
  const totalAmount = parseTotalAmount(query);
  const noOfDays = req?.journey?.noOfDays ?? 3;
  const noOfNights = req?.journey?.noOfNights ?? 2;
  const endDate = addDays(travelDate, noOfDays);
  const adults = req?.travellers?.adults ?? 1;
  const children = req?.travellers?.children ?? 0;
  const infants = req?.travellers?.infants ?? 0;
  const totalTravellers = adults + children; // infants don't count for hotel/cab capacity
  const startingPoint = req?.journey?.startingPoint ?? "Delhi";

  // Payment split
  // ─── Business rule ────────────────────────────────────────────────────────
  // Customer can pay 50% advance. Balance is due 15 days before travel.
  // If travel is within 15 days, full payment is required upfront.
  // ─────────────────────────────────────────────────────────────────────────
  const daysToTravel = Math.ceil(
    (travelDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const isWithin15Days = daysToTravel <= 15;

  const advanceAmount = isWithin15Days
    ? totalAmount                   // full payment required
    : Math.ceil(totalAmount * 0.5); // 50% advance
  const balanceAmount = totalAmount - advanceAmount;
  const balanceDueDate = isWithin15Days
    ? null
    : addDays(travelDate, -15); // 15 days before travel

  const paymentStatus: PaymentStatus = isWithin15Days
    ? PaymentStatus.FULLY_PAID
    : PaymentStatus.ADVANCE_PAID;

  console.log(`\n  💰 Payment Plan:`);
  console.log(`     Total      : ₹${totalAmount.toLocaleString("en-IN")}`);
  console.log(`     Advance    : ₹${advanceAmount.toLocaleString("en-IN")} (${isWithin15Days ? "100% — within 15 days" : "50%"})`);
  if (balanceAmount > 0) {
    console.log(`     Balance    : ₹${balanceAmount.toLocaleString("en-IN")}`);
    console.log(`     Balance due: ${balanceDueDate?.toDateString()}`);
  }

  // 4. Find or create User for Kavita
  let user = await db.user.findFirst({
    where: {
      OR: [
        { phone: query.phone },
        ...(query.email ? [{ email: query.email }] : []),
      ],
    },
    select: { id: true },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        name: query.name,
        email: query.email ?? undefined,
        phone: query.phone,
        country_code: query.countryCode,
      },
      select: { id: true },
    });
    console.log(`\n  + Created user for ${query.name} (${user.id})`);
  } else {
    console.log(`\n  ✓ Found existing user ${user.id}`);
  }

  // 5. Find destination
  const destinationName = (query.destination ?? "Goa").split(" ")[0];
  const destination = await db.destinations.findFirst({
    where: { name: { contains: destinationName, mode: "insensitive" } },
    select: { id: true, name: true },
  });

  if (!destination) {
    throw new Error(`❌ Destination "${destinationName}" not found. Seed destinations first.`);
  }
  console.log(`  ✓ Destination: ${destination.name} (id: ${destination.id})`);

  // 6. Determine cab type from requirements
  const reqCabTypes = (req?.transport?.cabTypes ?? ["SEDAN"]) as string[];
  const cabType = (reqCabTypes[0] as CabType) ?? CabType.SEDAN;

  // 7. Get booking index for number generation
  const existingCount = await db.booking.count();

  // 8. Build customer notes from requirements
  const noteParts: string[] = [];
  if (query.message) noteParts.push(query.message);
  if (req?.stay?.specialDemands) noteParts.push(`Stay: ${req.stay.specialDemands}`);
  if (req?.transport?.specialDemands) noteParts.push(`Transport: ${req.transport.specialDemands}`);
  if (req?.travellers?.specialDemands) noteParts.push(`Travellers: ${req.travellers.specialDemands}`);
  if (req?.activities?.selected?.length) {
    noteParts.push(`Activities requested: ${req.activities.selected.join(", ")}`);
  }
  if (req?.transport?.includeFlights) noteParts.push("Flights to be included.");
  const notes = noteParts.join(" | ") || null;

  // 9. Create Booking
  const booking = await db.booking.create({
    data: {
      bookingNumber:    generateBookingNumber(existingCount + 1),
      userId:           user.id,
      destinationId:    destination.id,
      sourceQueryId:    query.id,
      tripType:         TripType.Leisure,
      startDate:        travelDate,
      endDate,
      duration:         noOfNights,
      travellers:       totalTravellers,
      status:           BookingStatus.PENDING_REVIEW,
      cabType,
      roomSharingType:  RoomSharingType.SHARED,
      mealPlan:         MealPlan.MAP,
      totalAmount,
      paidAmount:       advanceAmount,
      advancePaidAmount: advanceAmount,
      balanceDueAmount:  balanceAmount,
      balanceDueDate,
      paymentStatus,
      currency:         req?.budget?.currency ?? "INR",
      notes,
      salesAgentId:     query.assignedTo ?? undefined,
      salesAgentName:   query.assignedToName ?? undefined,
      convertedAt:      new Date(),
      createdAt:        new Date(),
      updatedAt:        new Date(),
    },
  });

  console.log(`\n  ✅ Booking created: ${booking.bookingNumber} (${booking.id})`);

  // 10. Create Payment record (advance / full)
  const payment = await db.payment.create({
    data: {
      bookingId:        booking.id,
      userId:           user.id,
      amount:           advanceAmount,
      currency:         "INR",
      gateway:          PaymentGateway.OFFLINE,  // adjust if via Razorpay etc
      method:           PaymentMethod.CASH,
      status:           PaymentStatus.FULLY_PAID,
      // type:          isWithin15Days ? "FULL" : "ADVANCE",  // ← uncomment after migration
      gatewayPaymentId: fakePaymentId("PAY"),
      paidAt:           new Date(),
    },
  });

  console.log(`  ✅ Payment created: ${payment.id} — ₹${advanceAmount.toLocaleString("en-IN")}`);

  // 11. Mark query as CONVERTED
  await rawUpdate("package_queries", query.id, {
    status: "CONVERTED",
    closedAt: new Date().toISOString(),
  });
  console.log(`  ✅ Query status → CONVERTED`);

  // 12. Summary
  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Booking Summary
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ref#          : ${booking.bookingNumber}
  Customer      : ${query.name}
  Phone         : ${query.phone}
  Destination   : ${destination.name}
  Travel Date   : ${travelDate.toDateString()}
  Duration      : ${noOfNights}N/${noOfDays}D
  Travellers    : ${totalTravellers} pax (${adults}A + ${children}C, ${infants} infants)
  Starting From : ${startingPoint}
  Cab           : ${cabType}
  Total         : ₹${totalAmount.toLocaleString("en-IN")}
  Advance Paid  : ₹${advanceAmount.toLocaleString("en-IN")}
  Balance Due   : ₹${balanceAmount.toLocaleString("en-IN")}${balanceDueDate ? ` by ${balanceDueDate.toDateString()}` : " (nil)"}
  Status        : PENDING_REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  Next steps:
  1. Open /dashboard/package-bookings → find ${booking.bookingNumber}
  2. Assign to hotel + cab teams
  3. Both teams confirm → auto-moves to OPS_REVIEW
  4. Ops confirms → CONFIRMED, send confirmation email
  5. 15 days before travel, chase balance of ₹${balanceAmount.toLocaleString("en-IN")}
`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });