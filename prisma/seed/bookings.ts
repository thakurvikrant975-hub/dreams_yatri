import "dotenv/config";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, TripType } from "../../app/generated/prisma";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const db = new PrismaClient({ adapter });

// ── Helpers ───────────────────────────────────────────────────────────────────

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function randomFutureDate(minDays = 15, maxDays = 120): Date {
  const days = Math.floor(Math.random() * (maxDays - minDays)) + minDays;
  return addDays(new Date(), days);
}

function generateBookingNumber(index: number): string {
  const year = new Date().getFullYear();
  return `DY-${year}-${String(index).padStart(5, "0")}`;
}

// ── Real Indian traveller profiles ────────────────────────────────────────────

const travellers = [
  { name: "Rahul Sharma",     email: "rahul.sharma@gmail.com",     phone: "+91-9876543210" },
  { name: "Priya Mehta",      email: "priya.mehta@gmail.com",      phone: "+91-9823456781" },
  { name: "Amit Verma",       email: "amit.verma@outlook.com",     phone: "+91-9712345678" },
  { name: "Sneha Kapoor",     email: "sneha.kapoor@gmail.com",     phone: "+91-9654321098" },
  { name: "Vikram Singh",     email: "vikram.singh@yahoo.com",     phone: "+91-9543210987" },
  { name: "Anjali Gupta",     email: "anjali.gupta@gmail.com",     phone: "+91-9432109876" },
  { name: "Rohit Malhotra",   email: "rohit.malhotra@gmail.com",   phone: "+91-9321098765" },
  { name: "Deepika Nair",     email: "deepika.nair@gmail.com",     phone: "+91-9210987654" },
  { name: "Arjun Patel",      email: "arjun.patel@hotmail.com",    phone: "+91-9109876543" },
  { name: "Kavita Joshi",     email: "kavita.joshi@gmail.com",     phone: "+91-9098765432" },
  { name: "Suresh Iyer",      email: "suresh.iyer@gmail.com",      phone: "+91-8987654321" },
  { name: "Meena Pillai",     email: "meena.pillai@gmail.com",     phone: "+91-8876543210" },
  { name: "Ravi Tiwari",      email: "ravi.tiwari@outlook.com",    phone: "+91-8765432109" },
  { name: "Pooja Yadav",      email: "pooja.yadav@gmail.com",      phone: "+91-8654321098" },
  { name: "Nikhil Bhatia",    email: "nikhil.bhatia@gmail.com",    phone: "+91-8543210987" },
  { name: "Shalini Mishra",   email: "shalini.mishra@yahoo.com",   phone: "+91-8432109876" },
  { name: "Karan Oberoi",     email: "karan.oberoi@gmail.com",     phone: "+91-8321098765" },
  { name: "Nisha Chaudhary",  email: "nisha.chaudhary@gmail.com",  phone: "+91-8210987654" },
  { name: "Manish Agarwal",   email: "manish.agarwal@gmail.com",   phone: "+91-8109876543" },
  { name: "Sunita Pandey",    email: "sunita.pandey@hotmail.com",  phone: "+91-8098765432" },
];

// ── Package details by destination ───────────────────────────────────────────

const packagesByDest: Record<string, {
  duration: number;
  tripType: TripType;
  baseRate: number;
  notes: string | null;
}[]> = {
  "Manali": [
    { duration: 5, tripType: TripType.Adventure,  baseRate: 12000, notes: "Need snow gear rental info please." },
    { duration: 7, tripType: TripType.Honeymoon,  baseRate: 18000, notes: "Honeymoon package. Please arrange flower decoration in room." },
    { duration: 4, tripType: TripType.Family,     baseRate: 10000, notes: "Travelling with 2 kids aged 6 and 9." },
  ],
  "Kashmir": [
    { duration: 6, tripType: TripType.Leisure,    baseRate: 16000, notes: "First time in Kashmir. Need complete guidance." },
    { duration: 8, tripType: TripType.Honeymoon,  baseRate: 22000, notes: "Anniversary trip. Shikara ride must be included." },
    { duration: 5, tripType: TripType.Family,     baseRate: 14000, notes: "Vegetarian meals required for all members." },
  ],
  "Goa": [
    { duration: 4, tripType: TripType.Leisure,    baseRate: 9000,  notes: null },
    { duration: 3, tripType: TripType.Corporate,  baseRate: 11000, notes: "Team outing. Need GST invoice. Company: TechSoft Pvt Ltd." },
    { duration: 5, tripType: TripType.Honeymoon,  baseRate: 13000, notes: "Beach-facing room preferred." },
  ],
  "Rajasthan": [
    { duration: 7, tripType: TripType.Leisure,    baseRate: 13000, notes: "Interested in heritage sites and local cuisine." },
    { duration: 5, tripType: TripType.Family,     baseRate: 11000, notes: "Elderly parents travelling. Need ground floor rooms." },
    { duration: 4, tripType: TripType.Corporate,  baseRate: 15000, notes: "Corporate retreat. Need conference room for half day." },
  ],
  "Shimla": [
    { duration: 4, tripType: TripType.Family,     baseRate: 8000,  notes: "Kids excited for snow. First hill station trip." },
    { duration: 3, tripType: TripType.Honeymoon,  baseRate: 10000, notes: null },
    { duration: 5, tripType: TripType.Leisure,    baseRate: 9000,  notes: "Mall Road shopping and local sightseeing." },
  ],
  "Uttarakhand": [
    { duration: 6, tripType: TripType.Adventure,  baseRate: 11000, notes: "Interested in river rafting and camping." },
    { duration: 5, tripType: TripType.Pilgrimage, baseRate: 10000, notes: "Char Dham yatra. Need comfortable transport for senior citizens." },
    { duration: 4, tripType: TripType.Family,     baseRate: 9000,  notes: null },
  ],
  "Spiti Valley": [
    { duration: 8, tripType: TripType.Adventure,  baseRate: 15000, notes: "Bike trip. Need luggage vehicle support." },
    { duration: 7, tripType: TripType.Backpacking,baseRate: 9000,  notes: "Budget accommodation preferred." },
  ],
  "Andaman": [
    { duration: 6, tripType: TripType.Honeymoon,  baseRate: 20000, notes: "Scuba diving package must be included." },
    { duration: 5, tripType: TripType.Family,     baseRate: 17000, notes: "Neil Island and Havelock both." },
  ],
  "Kerala": [
    { duration: 6, tripType: TripType.Honeymoon,  baseRate: 16000, notes: "Houseboat stay is a must." },
    { duration: 5, tripType: TripType.Leisure,    baseRate: 13000, notes: "Interested in backwaters and Ayurveda." },
    { duration: 7, tripType: TripType.Family,     baseRate: 14000, notes: null },
  ],
  "Dubai": [
    { duration: 5, tripType: TripType.Leisure,    baseRate: 35000, notes: "Need visa assistance. Travelling as couple." },
    { duration: 6, tripType: TripType.Corporate,  baseRate: 45000, notes: "Business trip + sightseeing. Need business class." },
    { duration: 4, tripType: TripType.Family,     baseRate: 38000, notes: "Kids park visits a must. Burj Khalifa tickets needed." },
  ],
  "Thailand": [
    { duration: 6, tripType: TripType.Leisure,    baseRate: 28000, notes: "Phuket and Bangkok both. Island hopping." },
    { duration: 5, tripType: TripType.Honeymoon,  baseRate: 32000, notes: "Luxury resort preferred. Spa package." },
    { duration: 7, tripType: TripType.Adventure,  baseRate: 25000, notes: "Diving and trekking activities." },
  ],
};

const defaultPackages = [
  { duration: 5, tripType: TripType.Leisure,  baseRate: 12000, notes: null },
  { duration: 4, tripType: TripType.Family,   baseRate: 10000, notes: "Family trip with elderly parents." },
  { duration: 6, tripType: TripType.Adventure,baseRate: 14000, notes: null },
];

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding fresh bookings (PENDING_REVIEW only)...\n");

  // ── Fetch destinations ────────────────────────────────────────────────────

  const destinations = await db.destinations.findMany({
    select: { id: true, name: true },
  });

  if (destinations.length === 0) {
    throw new Error("❌ No destinations found. Seed destinations first.");
  }

  console.log(`✓ Found ${destinations.length} destinations`);

  // ── Fetch or create users ─────────────────────────────────────────────────
  // We create real-looking users if they don't exist yet.

  const userIds: string[] = [];

  for (const traveller of travellers) {
    let user = await db.user.findUnique({
      where: { email: traveller.email },
      select: { id: true },
    });

    if (!user) {
      user = await db.user.create({
        data: {
          name:  traveller.name,
          email: traveller.email,
          // phone field — add if your User model has it
          // phone: traveller.phone,
        },
        select: { id: true },
      });
      console.log(`  + Created user: ${traveller.name}`);
    }

    userIds.push(user.id);
  }

  console.log(`\n✓ ${userIds.length} users ready\n`);

  // ── Get existing booking count for numbering ──────────────────────────────

  const existingCount = await db.booking.count();
  let bookingIndex = existingCount + 1;

  // ── Create fresh PENDING_REVIEW bookings ──────────────────────────────────

  const bookingsToCreate = [
    // Recent bookings — just paid, hot leads
    { traveller: travellers[0],  daysAgo: 0,  dest: "Manali",      pax: 2 },
    { traveller: travellers[1],  daysAgo: 0,  dest: "Kashmir",     pax: 2 },
    { traveller: travellers[2],  daysAgo: 1,  dest: "Goa",         pax: 4 },
    { traveller: travellers[3],  daysAgo: 1,  dest: "Rajasthan",   pax: 3 },
    { traveller: travellers[4],  daysAgo: 1,  dest: "Dubai",       pax: 2 },
    { traveller: travellers[5],  daysAgo: 2,  dest: "Thailand",    pax: 2 },
    { traveller: travellers[6],  daysAgo: 2,  dest: "Shimla",      pax: 5 },
    { traveller: travellers[7],  daysAgo: 2,  dest: "Kerala",      pax: 2 },
    { traveller: travellers[8],  daysAgo: 3,  dest: "Andaman",     pax: 2 },
    { traveller: travellers[9],  daysAgo: 3,  dest: "Uttarakhand", pax: 6 },
    { traveller: travellers[10], daysAgo: 4,  dest: "Spiti Valley",pax: 4 },
    { traveller: travellers[11], daysAgo: 4,  dest: "Manali",      pax: 3 },
    { traveller: travellers[12], daysAgo: 5,  dest: "Kashmir",     pax: 2 },
    { traveller: travellers[13], daysAgo: 5,  dest: "Goa",         pax: 2 },
    { traveller: travellers[14], daysAgo: 6,  dest: "Rajasthan",   pax: 4 },
    { traveller: travellers[15], daysAgo: 7,  dest: "Dubai",       pax: 2 },
    { traveller: travellers[16], daysAgo: 7,  dest: "Thailand",    pax: 3 },
    { traveller: travellers[17], daysAgo: 8,  dest: "Kerala",      pax: 2 },
    { traveller: travellers[18], daysAgo: 9,  dest: "Shimla",      pax: 4 },
    { traveller: travellers[19], daysAgo: 10, dest: "Andaman",     pax: 2 },
  ];

  let created = 0;

  for (const entry of bookingsToCreate) {
    // Find destination
    const destination = destinations.find(
      (d) => d.name.toLowerCase().includes(entry.dest.toLowerCase())
    ) ?? randomItem(destinations);

    // Find user
    const user = await db.user.findUnique({
      where: { email: entry.traveller.email },
      select: { id: true },
    });

    if (!user) continue;

    // Pick package details for this destination
    const packages = packagesByDest[entry.dest] ?? defaultPackages;
    const pkg = randomItem(packages);

    const totalAmount = pkg.baseRate * entry.pax;
    const paidAmount  = totalAmount; // assume full payment at booking

    const createdAt = addDays(new Date(), -entry.daysAgo);
    // Set exact time to simulate different booking times
    createdAt.setHours(
      randomItem([9, 10, 11, 14, 15, 16, 18, 19, 20]),
      randomItem([0, 15, 30, 45]),
      0, 0
    );

    const startDate = randomFutureDate(20, 90);
    const endDate   = addDays(startDate, pkg.duration);

    const booking = await db.booking.create({
      data: {
        bookingNumber: generateBookingNumber(bookingIndex++),
        userId:        user.id,
        destinationId: destination.id,
        tripType:      pkg.tripType,
        startDate,
        endDate,
        duration:      pkg.duration,
        travellers:    entry.pax,
        status:        BookingStatus.PENDING_REVIEW,
        totalAmount,
        paidAmount,
        currency:      "INR",
        notes:         pkg.notes,
        // All verification fields null — fresh booking
        hotelConfirmedAt:      null,
        hotelNotes:            null,
        hotelAssigneeId:       null,
        cabConfirmedAt:        null,
        cabNotes:              null,
        cabAssigneeId:         null,
        opsReviewedAt:         null,
        opsAssigneeId:         null,
        currentDepartmentId:   null,
        currentAssigneeId:     null,
        rejectionReason:       null,
        modificationNote:      null,
        cancelledAt:           null,
        cancelReason:          null,
        createdAt,
        updatedAt: createdAt,
      },
    });

    console.log(
      `  ✓ ${booking.bookingNumber} | ${entry.traveller.name.padEnd(20)} | ${entry.dest.padEnd(14)} | ` +
      `${entry.pax} pax | ₹${totalAmount.toLocaleString("en-IN")} | ` +
      `${entry.daysAgo === 0 ? "Today" : `${entry.daysAgo}d ago`}`
    );

    created++;
  }

  console.log(`\n✅ Created ${created} fresh PENDING_REVIEW bookings`);
  console.log(`📊 Total bookings in DB: ${await db.booking.count()}`);
  console.log(`\nWhat to test:`);
  console.log(`  1. Open /dashboard/package-bookings → all ${created} show as "Pending Review"`);
  console.log(`  2. Open any booking → click "Confirm Hotel" and "Confirm Cab" from different team members`);
  console.log(`  3. Once both confirmed → booking auto-moves to OPS_REVIEW`);
  console.log(`  4. Ops manager confirms → status becomes CONFIRMED`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });