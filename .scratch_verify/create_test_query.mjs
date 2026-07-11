import { PrismaClient } from "../app/generated/prisma/index.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const db = new PrismaClient({ adapter: new PrismaPg(pool) });
const member = await db.teamMember.findFirst({ where: { email: "dev@dreamsyatri.com" }, select: { id: true, name: true } });
const q = await db.package_queries.create({
  data: {
    name: "Test Full Scan", phone: "9999999989", email: "test@example.com",
    destination: "Vythiri taluk", travelDate: new Date("2026-12-20"), groupSize: 3,
    status: "IN_PROGRESS", assignedTo: member.id, assignedToName: member.name,
    assignedAt: new Date(Date.now() - 2 * 3600 * 1000), // 2h ago, so time-to-send has something to show
    requirements: {
      travellers: { leadName: "Test Full Scan", adults: 2, children: 1, infants: 0 },
      journey: { startingPoint: "Delhi", dateType: "FIXED", travelDate: "2026-12-20", noOfDays: 3, noOfNights: 2, destinations: ["Vythiri taluk"] },
      stay: { types: [], mealTypes: [] },
      transport: { required: true, cabTypes: [], includeFlights: false, includeTrain: false },
      activities: { selected: [], custom: [] },
      budget: { type: "PER_PERSON", currency: "INR" },
    },
  },
  select: { id: true },
});
console.log("created", q.id);
await pool.end();
