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

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function generateBookingNumber(index: number): string {
  const year = new Date().getFullYear();
  return `DY-${year}-${String(index).padStart(5, "0")}`;
}

function fakePaymentId(): string {
  return `pay_SEED_${Date.now()}_${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function computePaymentSplit(totalAmount: number, travelDate: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  const daysToTravel = Math.ceil((travelDate.getTime() - Date.now()) / msPerDay);
  const requiresFull = daysToTravel <= 15;
  const advanceAmount = requiresFull ? totalAmount : Math.ceil(totalAmount * 0.5);
  const balanceAmount = totalAmount - advanceAmount;
  const balanceDueDate = requiresFull ? null : addDays(travelDate, -15);
  const paymentStatus: PaymentStatus = requiresFull
    ? PaymentStatus.FULLY_PAID
    : PaymentStatus.ADVANCE_PAID;
  return { advanceAmount, balanceAmount, balanceDueDate, paymentStatus, requiresFull, daysToTravel };
}

async function main() {
  console.log("🌱 Converting Kavita Shetty query → Booking + Payment\n");

  // 1. Find query
  const query = await db.package_queries.findFirst({
    where: {
      name: { equals: "Kavita Shetty", mode: "insensitive" },
      status: { in: ["PAYMENT_INITIATED", "SUBMITTED"] },
    },
  });

  if (!query) {
    throw new Error("❌  No query found for Kavita Shetty.");
  }

  console.log(`✓  Query found : ${query.id}`);
  console.log(`   Name        : ${query.name}`);
  console.log(`   Destination : ${query.destination}`);

  // 2. Guard — already converted?
  const existing = await db.booking.findUnique({
    where: { sourceQueryId: query.id },
  });
  if (existing) {
    console.log(`\n⚠️  Already converted → ${existing.bookingNumber}`);
    return;
  }

  // 3. Parse requirements
  const req = (query.requirements as any) ?? {};
  const journey    = req.journey    ?? {};
  const budget     = req.budget     ?? {};
  const travellers = req.travellers ?? {};
  const transport  = req.transport  ?? {};
  const activities = req.activities ?? {};

  const travelDate  = new Date(journey.travelDate ?? query.travelDate ?? new Date());
  const noOfNights  = journey.noOfNights ?? 2;
  const noOfDays    = journey.noOfDays   ?? 3;
  const endDate     = addDays(travelDate, noOfDays);
  const totalAmount = budget.max ?? budget.min ?? 50000;
  const adults      = travellers.adults   ?? 1;
  const children    = travellers.children ?? 0;
  const infants     = travellers.infants  ?? 0;
  const paxCount    = adults + children;
  const cabType     = (transport.cabTypes?.[0] as CabType) ?? CabType.SEDAN;

  // 4. Payment split
  const split = computePaymentSplit(totalAmount, travelDate);
  console.log(`\n   💰 Payment breakdown:`);
  console.log(`      Travel date  : ${travelDate.toDateString()}`);
  console.log(`      Days to trip : ${split.daysToTravel}${split.daysToTravel <= 0 ? " (past)" : ""}`);
  console.log(`      Total        : ₹${totalAmount.toLocaleString("en-IN")}`);
  console.log(`      Advance paid : ₹${split.advanceAmount.toLocaleString("en-IN")} (${split.requiresFull ? "100% — full payment" : "50% advance"})`);
  if (split.balanceAmount > 0) {
    console.log(`      Balance due  : ₹${split.balanceAmount.toLocaleString("en-IN")} by ${split.balanceDueDate?.toDateString()}`);
  }

  // 5. Find or create User
  let user = await db.user.findFirst({
    where: {
      OR: [
        { phone: query.phone },
        ...(query.email ? [{ email: query.email }] : []),
      ],
    },
    select: { id: true, name: true },
  });

  if (!user) {
    user = await db.user.create({
      data: {
        name:         query.name,
        email:        query.email ?? undefined,
        phone:        query.phone,
        country_code: query.countryCode,
      },
      select: { id: true, name: true },
    });
    console.log(`\n   + Created user : ${user.name} (${user.id})`);
  } else {
    console.log(`\n   ✓ Found user   : ${user.name} (${user.id})`);
  }

  // 6. Find destination — fall back to first available
  const destKeyword = (query.destination ?? "Goa").split(" ")[0];
  const destination =
    (await db.destinations.findFirst({
      where: { name: { contains: destKeyword, mode: "insensitive" } },
      select: { id: true, name: true },
    })) ??
    (await db.destinations.findFirst({
      select: { id: true, name: true },
      orderBy: { id: "asc" },
    }));

  if (!destination) {
    throw new Error("❌  No destinations in DB at all. Seed destinations first.");
  }
  console.log(`   ✓ Destination  : ${destination.name} (id: ${destination.id})`);

  // 7. Build notes
  const noteParts: string[] = [];
  if (query.message) noteParts.push(query.message);
  if (activities.selected?.length) {
    noteParts.push(`Activities: ${(activities.selected as string[]).join(", ")}`);
  }
  if (transport.includeFlights) noteParts.push("Flights required.");
  if (infants > 0) noteParts.push(`${infants} infant(s) travelling.`);
  const notes = noteParts.join(" | ") || null;

  // 8. Booking number
  const bookingCount = await db.booking.count();

  // 9. Create Booking
  const booking = await db.booking.create({
    data: {
      bookingNumber:     generateBookingNumber(bookingCount + 1),
      userId:            user.id,
      destinationId:     destination.id,
      sourceQueryId:     query.id,
      tripType:          TripType.Leisure,
      startDate:         travelDate,
      endDate,
      duration:          noOfNights,
      travellers:        paxCount,
      status:            BookingStatus.PENDING_REVIEW,
      cabType,
      roomSharingType:   RoomSharingType.SHARED,
      mealPlan:          MealPlan.MAP,
      totalAmount,
      paidAmount:        split.advanceAmount,
      advancePaidAmount: split.advanceAmount,
      balanceDueAmount:  split.balanceAmount,
      balanceDueDate:    split.balanceDueDate,
      paymentStatus:     split.paymentStatus,
      currency:          budget.currency ?? "INR",
      notes,
      salesAgentId:      query.assignedTo    ?? undefined,
      salesAgentName:    query.assignedToName ?? undefined,
      convertedAt:       new Date(),
    },
  });

  console.log(`\n   ✅ Booking created : ${booking.bookingNumber} (${booking.id})`);

  // 10. Create Payment
  const payment = await db.payment.create({
    data: {
      bookingId:        booking.id,
      userId:           user.id,
      amount:           split.advanceAmount,
      currency:         "INR",
      gateway:          PaymentGateway.OFFLINE,
      method:           PaymentMethod.CASH,
      status:           PaymentStatus.FULLY_PAID,
      gatewayPaymentId: fakePaymentId(),
      paidAt:           new Date(),
    },
  });

  console.log(`   ✅ Payment created  : ${payment.id} — ₹${split.advanceAmount.toLocaleString("en-IN")}`);

  // 11. Mark query CONVERTED
  await db.$executeRawUnsafe(
    `UPDATE package_queries SET status = 'CONVERTED', "closedAt" = NOW(), "updatedAt" = NOW() WHERE id = $1`,
    query.id
  );
  console.log(`   ✅ Query status    : → CONVERTED`);

  console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  Ref#        ${booking.bookingNumber}
  Customer    ${query.name}  ·  ${query.phone}
  Destination ${destination.name}
  Travel      ${travelDate.toDateString()} (${noOfNights}N/${noOfDays}D)
  Pax         ${paxCount} (${adults}A + ${children}C) + ${infants} infant(s)
  Total       ₹${totalAmount.toLocaleString("en-IN")}
  Paid        ₹${split.advanceAmount.toLocaleString("en-IN")}
  Balance     ₹${split.balanceAmount.toLocaleString("en-IN")}${split.balanceDueDate ? ` — due ${split.balanceDueDate.toDateString()}` : ""}
  Status      PENDING_REVIEW
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
}

main()
  .catch((err) => {
    console.error("\n❌  Seed failed:", err.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });