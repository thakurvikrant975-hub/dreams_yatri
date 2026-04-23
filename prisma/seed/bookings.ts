import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient, BookingStatus, TripType, TimelineAction } from "../../app/generated/prisma";

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

function randomFutureDate(minDays = 10, maxDays = 120): Date {
  const days = Math.floor(Math.random() * (maxDays - minDays)) + minDays;
  return addDays(new Date(), days);
}

function randomPastDate(minDays = 1, maxDays = 30): Date {
  const days = Math.floor(Math.random() * (maxDays - minDays)) + minDays;
  return addDays(new Date(), -days);
}

function generateBookingNumber(index: number): string {
  const year = new Date().getFullYear();
  return `DY-${year}-${String(index).padStart(5, "0")}`;
}

// ── Seed ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("🌱 Seeding bookings...");

  // ── Fetch required relations ──────────────────────────────────────────────

  const users = await db.user.findMany({
    select: { id: true, name: true, email: true },
    take: 20,
  });

  if (users.length === 0) {
    throw new Error("No users found. Seed users first before seeding bookings.");
  }

  const destinations = await db.destinations.findMany({
    select: { id: true, name: true },
  });

  if (destinations.length === 0) {
    throw new Error("No destinations found. Seed destinations first.");
  }

  const teamMembers = await db.teamMember.findMany({
    select: {
      id: true,
      name: true,
      departmentId: true,
      department: { select: { id: true, name: true } },
    },
    where: { isActive: true },
  });

  if (teamMembers.length === 0) {
    console.warn("⚠️  No team members found. Bookings will be created without assignees.");
  }

  const hotelTeam = teamMembers.filter(
    (m) => m.department?.name?.toLowerCase().includes("hotel")
  );
  const cabTeam = teamMembers.filter(
    (m) => m.department?.name?.toLowerCase().includes("cab")
  );
  const opsTeam = teamMembers.filter(
    (m) =>
      m.department?.name?.toLowerCase().includes("ops") ||
      m.department?.name?.toLowerCase().includes("operation")
  );

  const anyMember = teamMembers[0];
  const hotelMember = hotelTeam[0] ?? anyMember;
  const cabMember = cabTeam[0] ?? anyMember;
  const opsMember = opsTeam[0] ?? anyMember;

  const hotelDept = await db.department.findFirst({
    where: { name: { contains: "Hotel", mode: "insensitive" } },
  });
  const cabDept = await db.department.findFirst({
    where: { name: { contains: "Cab", mode: "insensitive" } },
  });
  const opsDept = await db.department.findFirst({
    where: {
      OR: [
        { name: { contains: "Ops", mode: "insensitive" } },
        { name: { contains: "Operation", mode: "insensitive" } },
      ],
    },
  });

  // ── Booking templates ─────────────────────────────────────────────────────

  const tripTypes = Object.values(TripType);

  const bookingTemplates: {
    status: BookingStatus;
    label: string;
    count: number;
  }[] = [
    { status: BookingStatus.PENDING_REVIEW,           label: "Pending Review",          count: 5 },
    { status: BookingStatus.HOTEL_VERIFICATION,       label: "Hotel Verification",      count: 4 },
    { status: BookingStatus.HOTEL_CONFIRMED,          label: "Hotel Confirmed",         count: 3 },
    { status: BookingStatus.CAB_VERIFICATION,         label: "Cab Verification",        count: 4 },
    { status: BookingStatus.CAB_CONFIRMED,            label: "Cab Confirmed",           count: 2 },
    { status: BookingStatus.OPS_REVIEW,               label: "Ops Review",              count: 3 },
    { status: BookingStatus.CONFIRMED,                label: "Confirmed",               count: 5 },
    { status: BookingStatus.UPCOMING,                 label: "Upcoming",                count: 4 },
    { status: BookingStatus.ONGOING,                  label: "Ongoing",                 count: 2 },
    { status: BookingStatus.COMPLETED,                label: "Completed",               count: 4 },
    { status: BookingStatus.MODIFICATION_REQUESTED,   label: "Modification Requested",  count: 2 },
    { status: BookingStatus.CANCELLED,                label: "Cancelled",               count: 3 },
    { status: BookingStatus.REJECTED,                 label: "Rejected",                count: 2 },
  ];

  const notes = [
    "Need ground floor room, travelling with elderly parents.",
    "Honeymoon trip, please arrange flowers in room if possible.",
    "Vegetarian meals required for all members.",
    "First time travellers, please guide on what to carry.",
    "Need extra bed for child.",
    "Corporate team outing, require invoice with GST.",
    null,
    null,
    null,
  ];

  const hotelNoteOptions = [
    "Hotel Shivalik confirmed, deluxe rooms available. Rate: ₹3500/night.",
    "The Orchard Retreat confirmed. 3 rooms blocked for travel dates.",
    "Hotel Snowflake Manali confirmed. Early check-in arranged.",
    "Zostel Kasol confirmed. Dormitory + private room booked.",
    "Vivanta by Taj confirmed. Suite available for dates.",
  ];

  const cabNoteOptions = [
    "Tempo Traveller confirmed. Driver: Ramesh +91-9876543210. Pickup: 6 AM.",
    "Innova Crysta confirmed. Driver will report at hotel lobby.",
    "Force Urbania confirmed for 12-seater group. AC vehicle.",
    "Swift Dzire confirmed for couple package. Driver: Suresh.",
    "Mini bus (20-seater) confirmed for corporate group.",
  ];

  const rejectionReasons = [
    "Package dates are unavailable due to peak season block.",
    "Customer failed to provide required travel documents.",
    "Hotel and transport unavailable for selected dates.",
  ];

  const modificationNotes = [
    "Hotel fully booked for Jun 15-18. Requesting date change to Jun 20-23.",
    "Requested cab type (Tempo Traveller) not available. Suggesting Force Urbania instead.",
  ];

  // ── Create bookings ───────────────────────────────────────────────────────

  const existingCount = await db.booking.count();
  let bookingIndex = existingCount + 1;

  for (const template of bookingTemplates) {
    console.log(`  → Creating ${template.count} bookings: ${template.label}`);

    for (let i = 0; i < template.count; i++) {
      const user = randomItem(users);
      const destination = randomItem(destinations);
      const tripType = randomItem(tripTypes);
      const duration = randomItem([3, 4, 5, 6, 7, 8, 10]);
      const travellers = randomItem([1, 2, 2, 3, 4, 5, 6]);
      const baseRate = randomItem([8000, 10000, 12000, 15000, 18000, 22000]);
      const totalAmount = baseRate * travellers + (duration - 3) * 2000;
      const paidAmount = totalAmount;
      const startDate = randomFutureDate(15, 100);
      const endDate = addDays(startDate, duration);
      const createdAt = randomPastDate(1, 20);

      const s = template.status;

      let hotelConfirmedAt: Date | null = null;
      let hotelNotes: string | null = null;
      let cabConfirmedAt: Date | null = null;
      let cabNotes: string | null = null;
      let opsReviewedAt: Date | null = null;
      let rejectionReason: string | null = null;
      let modificationNote: string | null = null;
      let cancelledAt: Date | null = null;
      let cancelReason: string | null = null;
      let currentDepartmentId: string | null = null;
      let currentAssigneeId: string | null = null;
      let hotelAssigneeId: string | null = null;
      let cabAssigneeId: string | null = null;
      let opsAssigneeId: string | null = null;

      const hotelDoneStatuses: BookingStatus[] = [
        BookingStatus.HOTEL_CONFIRMED,
        BookingStatus.CAB_VERIFICATION,
        BookingStatus.CAB_CONFIRMED,
        BookingStatus.OPS_REVIEW,
        BookingStatus.CONFIRMED,
        BookingStatus.UPCOMING,
        BookingStatus.ONGOING,
        BookingStatus.COMPLETED,
      ];
      const hotelDone = hotelDoneStatuses.includes(s);

      const cabDoneStatuses: BookingStatus[] = [
        BookingStatus.CAB_CONFIRMED,
        BookingStatus.OPS_REVIEW,
        BookingStatus.CONFIRMED,
        BookingStatus.UPCOMING,
        BookingStatus.ONGOING,
        BookingStatus.COMPLETED,
      ];
      const cabDone = cabDoneStatuses.includes(s);

      if (hotelDone && hotelMember) {
        hotelConfirmedAt = addDays(createdAt, 1);
        hotelNotes = randomItem(hotelNoteOptions);
        hotelAssigneeId = hotelMember.id;
      }

      if (cabDone && cabMember) {
        cabConfirmedAt = addDays(createdAt, 2);
        cabNotes = randomItem(cabNoteOptions);
        cabAssigneeId = cabMember.id;
      }

      const opsReviewStatuses: BookingStatus[] = [
        BookingStatus.OPS_REVIEW,
        BookingStatus.CONFIRMED,
        BookingStatus.UPCOMING,
        BookingStatus.ONGOING,
        BookingStatus.COMPLETED,
      ];
      if (opsReviewStatuses.includes(s) && opsMember) {
        opsReviewedAt = addDays(createdAt, 3);
        opsAssigneeId = opsMember.id;
      }

      if (s === BookingStatus.PENDING_REVIEW && opsDept) {
        currentDepartmentId = opsDept.id;
        currentAssigneeId = opsMember?.id ?? null;
      } else if (s === BookingStatus.HOTEL_VERIFICATION && hotelDept) {
        currentDepartmentId = hotelDept.id;
        currentAssigneeId = hotelMember?.id ?? null;
        hotelAssigneeId = hotelMember?.id ?? null;
      } else if (s === BookingStatus.HOTEL_CONFIRMED && hotelDept) {
        currentDepartmentId = hotelDept.id;
        hotelConfirmedAt = addDays(createdAt, 1);
        hotelNotes = randomItem(hotelNoteOptions);
        hotelAssigneeId = hotelMember?.id ?? null;
      } else if (s === BookingStatus.CAB_VERIFICATION && cabDept) {
        currentDepartmentId = cabDept.id;
        currentAssigneeId = cabMember?.id ?? null;
        cabAssigneeId = cabMember?.id ?? null;
      } else if (s === BookingStatus.OPS_REVIEW && opsDept) {
        currentDepartmentId = opsDept.id;
        currentAssigneeId = opsMember?.id ?? null;
      }

      if (s === BookingStatus.REJECTED) {
        rejectionReason = randomItem(rejectionReasons);
      }

      if (s === BookingStatus.MODIFICATION_REQUESTED) {
        modificationNote = randomItem(modificationNotes);
      }

      if (s === BookingStatus.CANCELLED) {
        cancelledAt = randomPastDate(1, 10);
        cancelReason = randomItem([
          "Customer requested cancellation due to personal reasons.",
          "Flight cancelled, unable to travel.",
          "Medical emergency in family.",
        ]);
      }

      // ── Create booking ────────────────────────────────────────────────────
      const booking = await db.booking.create({
        data: {
          bookingNumber: generateBookingNumber(bookingIndex++),
          userId: user.id,
          destinationId: destination.id,
          tripType,
          startDate,
          endDate,
          duration,
          travellers,
          status: s,
          totalAmount,
          paidAmount,
          currency: "INR",
          notes: randomItem(notes),
          hotelConfirmedAt,
          hotelNotes,
          hotelAssigneeId,
          cabConfirmedAt,
          cabNotes,
          cabAssigneeId,
          opsReviewedAt,
          opsAssigneeId,
          rejectionReason,
          modificationNote,
          cancelledAt,
          cancelReason,
          currentDepartmentId,
          currentAssigneeId,
          createdAt,
          updatedAt: createdAt,
        },
      });

      // ── Create timeline entries ───────────────────────────────────────────
      if (!anyMember) continue;

      const timelineActor = opsMember ?? anyMember;

      const timelineEntries: {
        action: TimelineAction;
        fromStatus?: BookingStatus;
        toStatus?: BookingStatus;
        note: string;
        performedById: string;
        performedByName: string;
        departmentId?: string | null;
        createdAt: Date;
      }[] = [];

      // Always: booking created
      timelineEntries.push({
        action: TimelineAction.BOOKING_CREATED,
        toStatus: BookingStatus.PENDING_REVIEW,
        note: "Booking received after successful payment.",
        performedById: timelineActor.id,
        performedByName: timelineActor.name,
        departmentId: opsDept?.id ?? null,
        createdAt,
      });

      // Hotel dept assigned
      if (s !== BookingStatus.PENDING_REVIEW && hotelMember) {
        timelineEntries.push({
          action: TimelineAction.DEPARTMENT_ASSIGNED,
          fromStatus: BookingStatus.PENDING_REVIEW,
          toStatus: BookingStatus.HOTEL_VERIFICATION,
          note: "Assigned to hotel department for verification.",
          performedById: timelineActor.id,
          performedByName: timelineActor.name,
          departmentId: hotelDept?.id ?? null,
          createdAt: addDays(createdAt, 0),
        });
      }

      // Hotel confirmed
      if (hotelDone && hotelMember) {
        timelineEntries.push({
          action: TimelineAction.DEPARTMENT_CONFIRMED,
          fromStatus: BookingStatus.HOTEL_VERIFICATION,
          toStatus: BookingStatus.CAB_VERIFICATION,
          note: hotelNotes ?? "Hotel confirmed.",
          performedById: hotelMember.id,
          performedByName: hotelMember.name,
          departmentId: hotelDept?.id ?? null,
          createdAt: addDays(createdAt, 1),
        });
      }

      // Cab confirmed
      if (cabDone && cabMember) {
        timelineEntries.push({
          action: TimelineAction.DEPARTMENT_CONFIRMED,
          fromStatus: BookingStatus.CAB_VERIFICATION,
          toStatus: BookingStatus.OPS_REVIEW,
          note: cabNotes ?? "Cab confirmed.",
          performedById: cabMember.id,
          performedByName: cabMember.name,
          departmentId: cabDept?.id ?? null,
          createdAt: addDays(createdAt, 2),
        });
      }

      // Ops confirmed
      const opsConfirmedStatuses: BookingStatus[] = [
        BookingStatus.CONFIRMED,
        BookingStatus.UPCOMING,
        BookingStatus.ONGOING,
        BookingStatus.COMPLETED,
      ];
      if (opsConfirmedStatuses.includes(s) && opsMember) {
        timelineEntries.push({
          action: TimelineAction.STATUS_CHANGED,
          fromStatus: BookingStatus.OPS_REVIEW,
          toStatus: BookingStatus.CONFIRMED,
          note: "All verifications complete. Booking confirmed. Confirmation email sent to customer.",
          performedById: opsMember.id,
          performedByName: opsMember.name,
          departmentId: opsDept?.id ?? null,
          createdAt: addDays(createdAt, 3),
        });
      }

      // Ongoing
      const ongoingStatuses: BookingStatus[] = [BookingStatus.ONGOING, BookingStatus.COMPLETED];
      if (ongoingStatuses.includes(s)) {
        timelineEntries.push({
          action: TimelineAction.STATUS_CHANGED,
          fromStatus: BookingStatus.UPCOMING,
          toStatus: BookingStatus.ONGOING,
          note: "Travel started. Customer departed.",
          performedById: timelineActor.id,
          performedByName: timelineActor.name,
          departmentId: opsDept?.id ?? null,
          createdAt: addDays(new Date(), -3),
        });
      }

      // Completed
      if (s === BookingStatus.COMPLETED) {
        timelineEntries.push({
          action: TimelineAction.STATUS_CHANGED,
          fromStatus: BookingStatus.ONGOING,
          toStatus: BookingStatus.COMPLETED,
          note: "Trip completed successfully. Customer returned.",
          performedById: timelineActor.id,
          performedByName: timelineActor.name,
          departmentId: opsDept?.id ?? null,
          createdAt: addDays(new Date(), -1),
        });
      }

      // Modification
      if (s === BookingStatus.MODIFICATION_REQUESTED) {
        timelineEntries.push({
          action: TimelineAction.DEPARTMENT_FLAGGED,
          fromStatus: BookingStatus.HOTEL_VERIFICATION,
          toStatus: BookingStatus.MODIFICATION_REQUESTED,
          note: modificationNote ?? "Issue flagged by department.",
          performedById: hotelMember?.id ?? timelineActor.id,
          performedByName: hotelMember?.name ?? timelineActor.name,
          departmentId: hotelDept?.id ?? null,
          createdAt: addDays(createdAt, 1),
        });
      }

      // Rejected
      if (s === BookingStatus.REJECTED) {
        timelineEntries.push({
          action: TimelineAction.STATUS_CHANGED,
          fromStatus: BookingStatus.OPS_REVIEW,
          toStatus: BookingStatus.REJECTED,
          note: rejectionReason ?? "Booking rejected.",
          performedById: opsMember?.id ?? timelineActor.id,
          performedByName: opsMember?.name ?? timelineActor.name,
          departmentId: opsDept?.id ?? null,
          createdAt: addDays(createdAt, 2),
        });
      }

      // Cancelled
      if (s === BookingStatus.CANCELLED) {
        timelineEntries.push({
          action: TimelineAction.STATUS_CHANGED,
          fromStatus: BookingStatus.CONFIRMED,
          toStatus: BookingStatus.CANCELLED,
          note: cancelReason ?? "Booking cancelled.",
          performedById: timelineActor.id,
          performedByName: timelineActor.name,
          departmentId: opsDept?.id ?? null,
          createdAt: cancelledAt ?? addDays(createdAt, 5),
        });
      }

      await db.bookingTimeline.createMany({
        data: timelineEntries.map((entry) => ({
          bookingId: booking.id,
          action: entry.action,
          fromStatus: entry.fromStatus ?? null,
          toStatus: entry.toStatus ?? null,
          note: entry.note,
          performedById: entry.performedById,
          performedByName: entry.performedByName,
          departmentId: entry.departmentId ?? null,
          createdAt: entry.createdAt,
        })),
      });
    }
  }

  const total = await db.booking.count();
  console.log(`✅ Booking seed complete. Total bookings in DB: ${total}`);
}

main()
  .catch(console.error)
  .finally(async () => {
    await db.$disconnect();
    await pool.end();
  });
  