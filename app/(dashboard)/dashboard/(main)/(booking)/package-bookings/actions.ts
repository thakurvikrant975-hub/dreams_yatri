"use server";

import { db } from "@/app/lib/db";
import { BookingStatus, TimelineAction, Prisma } from "@/app/generated/prisma";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { revalidatePath } from "next/cache";

const BOOKINGS_PER_PAGE = 15;

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingWithRelations = Prisma.BookingGetPayload<{
  include: {
    user: { select: { id: true; name: true; email: true; image: true } };
    destination: { select: { id: true; name: true } };
    payments: { select: { id: true; amount: true; status: true; createdAt: true } };
    timeline: {
      include: {
        performedBy: { select: { id: true; name: true } };
        department: { select: { id: true; name: true } };
      };
      orderBy: { createdAt: "desc" };
    };
    currentDepartment: { select: { id: true; name: true } };
    currentAssignee: { select: { id: true; name: true } };
    hotelAssignee: { select: { id: true; name: true } };
    cabAssignee: { select: { id: true; name: true } };
    opsAssignee: { select: { id: true; name: true } };
  };
}>;

export type PaginatedBookings = {
  bookings: BookingWithRelations[];
  totalPages: number;
  totalCount: number;
};

export type BookingStats = {
  total: number;

  // Pipeline statuses — these all add up to total
  pendingReview:          number; // inbox — just paid, not yet dispatched
  hotelVerification:      number; // hotel dept working on it
  hotelConfirmed:         number; // hotel done, cab still pending
  cabVerification:        number; // cab dept working on it
  cabConfirmed:           number; // cab done, hotel still pending
  opsReview:              number; // both verified, ops final check
  confirmed:              number; // fully confirmed, email sent
  upcoming:               number; // confirmed + travel date in future
  ongoing:                number; // currently travelling
  completed:              number; // returned

  // Problem statuses
  modificationRequested:  number; // dept flagged an issue
  cancelled:              number; // customer/ops cancelled
  rejected:               number; // ops rejected

  // Derived — for sidebar badges (not additive to total)
  hotelQueuePending:      number; // bookings hotel dept still needs to action
  cabQueuePending:        number; // bookings cab dept still needs to action
};

// ── Actor helper ──────────────────────────────────────────────────────────────

type Actor = {
  id: string;
  name: string;
  departmentId: string | null;
};

async function getActor(): Promise<Actor> {
  const session = await dashboardAuth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return {
    id: session.user.id,
    name: session.user.name ?? "Unknown",
    departmentId: (session.user as any).departmentId ?? null,
  };
}

// ── Include helper ────────────────────────────────────────────────────────────

const bookingInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
  destination: { select: { id: true, name: true } },
  payments: { select: { id: true, amount: true, status: true, createdAt: true } },
  timeline: {
    include: {
      performedBy: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" as const },
  },
  currentDepartment: { select: { id: true, name: true } },
  currentAssignee: { select: { id: true, name: true } },
  hotelAssignee: { select: { id: true, name: true } },
  cabAssignee: { select: { id: true, name: true } },
  opsAssignee: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

// ── Statuses visible to verification depts ────────────────────────────────────
// Both hotel and cab see a booking as long as it is anywhere in the
// verification pipeline and their own confirmation is still pending.

const VERIFICATION_STATUSES: BookingStatus[] = [
  "PENDING_REVIEW",
  "HOTEL_VERIFICATION",
  "HOTEL_CONFIRMED",
  "CAB_VERIFICATION",
  "CAB_CONFIRMED",
];

// ── Decimal serializer ────────────────────────────────────────────────────────

function serializeBooking(booking: any): any {
  return {
    ...booking,
    totalAmount: Number(booking.totalAmount),
    paidAmount: Number(booking.paidAmount),
    payments: booking.payments?.map((p: any) => ({
      ...p,
      amount: Number(p.amount),
    })),
  };
}

// ── Raw FK update ─────────────────────────────────────────────────────────────

async function updateBookingFKs(
  bookingId: string,
  fields: Record<string, string | null>
) {
  let i = 1;
  const setClauses = Object.entries(fields)
    .map(([col]) => `"${col}" = $${i++}`)
    .join(", ");
  const values = [...Object.values(fields), bookingId];
  await db.$queryRawUnsafe(
    `UPDATE bookings SET ${setClauses} WHERE id = $${i}`,
    ...values
  );
}

// ── Timeline create helper ────────────────────────────────────────────────────

function createTimelineEntry({
  bookingId,
  action,
  fromStatus,
  toStatus,
  note,
  performedById,
  performedByName,
  departmentId,
}: {
  bookingId: string;
  action: TimelineAction;
  fromStatus?: BookingStatus | null;
  toStatus?: BookingStatus | null;
  note: string;
  performedById: string;
  performedByName: string;
  departmentId?: string | null;
}) {
  return db.bookingTimeline.create({
    data: {
      booking:     { connect: { id: bookingId } },
      performedBy: { connect: { id: performedById } },
      action,
      fromStatus:  fromStatus ?? null,
      toStatus:    toStatus ?? null,
      note,
      performedByName,
      ...(departmentId
        ? { department: { connect: { id: departmentId } } }
        : {}),
    },
  });
}

// ── Auto-advance logic ────────────────────────────────────────────────────────
// Called after every hotel/cab confirmation.
// If BOTH are now confirmed → move booking to OPS_REVIEW automatically.

async function maybeAdvanceToOpsReview(
  bookingId: string,
  currentStatus: BookingStatus,
  actor: Actor
) {
  const fresh = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { hotelConfirmedAt: true, cabConfirmedAt: true },
  });

  if (!fresh.hotelConfirmedAt || !fresh.cabConfirmedAt) return; // not both done yet

  const opsDept = await db.department.findFirst({
    where: {
      OR: [
        { name: { contains: "Ops", mode: "insensitive" } },
        { name: { contains: "Operation", mode: "insensitive" } },
      ],
    },
  });

  await updateBookingFKs(bookingId, {
    status:              "OPS_REVIEW",
    currentDepartmentId: opsDept?.id ?? null,
    currentAssigneeId:   null,
  });

  await createTimelineEntry({
    bookingId,
    action:          "STATUS_CHANGED",
    fromStatus:      currentStatus,
    toStatus:        "OPS_REVIEW",
    note:            "Both hotel and cab verified. Auto-moved to ops review.",
    performedById:   actor.id,
    performedByName: actor.name,
    departmentId:    actor.departmentId,
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBookingsPaginated(
  page: number = 1,
  filters: {
    status?: BookingStatus;
    search?: string;
    destinationId?: number;
    assigneeId?: string;
  } = {}
): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;

  const where: Prisma.BookingWhereInput = {
    ...(filters.status && { status: filters.status }),
    ...(filters.destinationId && { destinationId: filters.destinationId }),
    ...(filters.assigneeId && { currentAssigneeId: filters.assigneeId }),
    ...(filters.search && {
      OR: [
        { bookingNumber: { contains: filters.search, mode: "insensitive" } },
        { user: { name: { contains: filters.search, mode: "insensitive" } } },
        { user: { email: { contains: filters.search, mode: "insensitive" } } },
      ],
    }),
  };

  const [bookings, totalCount] = await Promise.all([
    db.booking.findMany({
      where,
      include: bookingInclude,
      orderBy: { startDate: "asc" },
      skip,
      take: BOOKINGS_PER_PAGE,
    }),
    db.booking.count({ where }),
  ]);

  return {
    bookings: bookings.map(serializeBooking) as unknown as BookingWithRelations[],
    totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE),
    totalCount,
  };
}

export async function getBookingStats(): Promise<BookingStats> {
  const [statusCounts, hotelQueuePending, cabQueuePending] = await Promise.all([
    // One query gives us all status counts
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    // Sidebar badge — how many bookings hotel dept still needs to action
    db.booking.count({
      where: { status: { in: VERIFICATION_STATUSES }, hotelConfirmedAt: null },
    }),
    // Sidebar badge — how many bookings cab dept still needs to action
    db.booking.count({
      where: { status: { in: VERIFICATION_STATUSES }, cabConfirmedAt: null },
    }),
  ]);

  const s = Object.fromEntries(
    statusCounts.map((c) => [c.status, c._count._all])
  );

  const total = Object.values(s).reduce((a, b) => a + b, 0);

  return {
    total,
    // Pipeline — all add up to total
    pendingReview:         s["PENDING_REVIEW"]         ?? 0,
    hotelVerification:     s["HOTEL_VERIFICATION"]     ?? 0,
    hotelConfirmed:        s["HOTEL_CONFIRMED"]        ?? 0,
    cabVerification:       s["CAB_VERIFICATION"]       ?? 0,
    cabConfirmed:          s["CAB_CONFIRMED"]          ?? 0,
    opsReview:             s["OPS_REVIEW"]             ?? 0,
    confirmed:             s["CONFIRMED"]              ?? 0,
    upcoming:              s["UPCOMING"]               ?? 0,
    ongoing:               s["ONGOING"]                ?? 0,
    completed:             s["COMPLETED"]              ?? 0,
    // Problem statuses
    modificationRequested: s["MODIFICATION_REQUESTED"] ?? 0,
    cancelled:             s["CANCELLED"]              ?? 0,
    rejected:              s["REJECTED"]               ?? 0,
    // Derived sidebar badges
    hotelQueuePending,
    cabQueuePending,
  };
}

export async function getBookingById(id: string): Promise<BookingWithRelations | null> {
  const booking = await db.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
  if (!booking) return null;
  return serializeBooking(booking) as unknown as BookingWithRelations;
}

// Hotel dept queue — any verification-stage booking where hotel not confirmed yet
export async function getHotelVerificationQueue(page: number = 1): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;
  const where: Prisma.BookingWhereInput = {
    status: { in: VERIFICATION_STATUSES },
    hotelConfirmedAt: null,
  };

  const [bookings, totalCount] = await Promise.all([
    db.booking.findMany({ where, include: bookingInclude, orderBy: { startDate: "asc" }, skip, take: BOOKINGS_PER_PAGE }),
    db.booking.count({ where }),
  ]);

  return {
    bookings: bookings.map(serializeBooking) as unknown as BookingWithRelations[],
    totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE),
    totalCount,
  };
}

// Cab dept queue — any verification-stage booking where cab not confirmed yet
export async function getCabVerificationQueue(page: number = 1): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;
  const where: Prisma.BookingWhereInput = {
    status: { in: VERIFICATION_STATUSES },
    cabConfirmedAt: null,
  };

  const [bookings, totalCount] = await Promise.all([
    db.booking.findMany({ where, include: bookingInclude, orderBy: { startDate: "asc" }, skip, take: BOOKINGS_PER_PAGE }),
    db.booking.count({ where }),
  ]);

  return {
    bookings: bookings.map(serializeBooking) as unknown as BookingWithRelations[],
    totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE),
    totalCount,
  };
}

export async function getTeamMembersForAssign() {
  return db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, name: true, department: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });
}

export async function getDestinationsForFilter() {
  return db.destinations.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

// ── Mutations ─────────────────────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

export async function confirmHotel(bookingId: string, notes?: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    // Mark hotel as confirmed — status stays wherever it is
    // (cab dept may still be working on their side)
    await updateBookingFKs(bookingId, {
      hotelConfirmedAt: new Date().toISOString(),
      hotelNotes:       notes ?? null,
      hotelAssigneeId:  actor.id,
    });

    await createTimelineEntry({
      bookingId,
      action:          "DEPARTMENT_CONFIRMED",
      fromStatus:      booking.status,
      toStatus:        booking.status, // status unchanged — parallel flow
      note:            notes ?? "Hotel availability and pricing confirmed",
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    // If cab is also done → auto-advance to OPS_REVIEW
    await maybeAdvanceToOpsReview(bookingId, booking.status, actor);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm hotel" };
  }
}

export async function flagHotelIssue(bookingId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, {
      status:           "MODIFICATION_REQUESTED",
      modificationNote: note,
    });

    await createTimelineEntry({
      bookingId,
      action:          "DEPARTMENT_FLAGGED",
      fromStatus:      booking.status,
      toStatus:        "MODIFICATION_REQUESTED",
      note,
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag hotel issue" };
  }
}

export async function confirmCab(bookingId: string, notes?: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    // Mark cab as confirmed — status stays wherever it is
    // (hotel dept may still be working on their side)
    await updateBookingFKs(bookingId, {
      cabConfirmedAt: new Date().toISOString(),
      cabNotes:       notes ?? null,
      cabAssigneeId:  actor.id,
    });

    await createTimelineEntry({
      bookingId,
      action:          "DEPARTMENT_CONFIRMED",
      fromStatus:      booking.status,
      toStatus:        booking.status, // status unchanged — parallel flow
      note:            notes ?? "Cab availability confirmed",
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    // If hotel is also done → auto-advance to OPS_REVIEW
    await maybeAdvanceToOpsReview(bookingId, booking.status, actor);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm cab" };
  }
}

export async function flagCabIssue(bookingId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, {
      status:           "MODIFICATION_REQUESTED",
      modificationNote: note,
    });

    await createTimelineEntry({
      bookingId,
      action:          "DEPARTMENT_FLAGGED",
      fromStatus:      booking.status,
      toStatus:        "MODIFICATION_REQUESTED",
      note,
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag cab issue" };
  }
}

export async function confirmBooking(bookingId: string, note?: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, {
      status:              "CONFIRMED",
      opsReviewedAt:       new Date().toISOString(),
      opsAssigneeId:       actor.id,
      currentDepartmentId: null,
      currentAssigneeId:   null,
    });

    await createTimelineEntry({
      bookingId,
      action:          "STATUS_CHANGED",
      fromStatus:      booking.status,
      toStatus:        "CONFIRMED",
      note:            note ?? "Booking confirmed by operations",
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm booking" };
  }
}

export async function rejectBooking(bookingId: string, reason: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, {
      status:              "REJECTED",
      rejectionReason:     reason,
      currentDepartmentId: null,
      currentAssigneeId:   null,
    });

    await createTimelineEntry({
      bookingId,
      action:          "STATUS_CHANGED",
      fromStatus:      booking.status,
      toStatus:        "REJECTED",
      note:            reason,
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to reject booking" };
  }
}

export async function assignMember(bookingId: string, memberId: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const member = await db.teamMember.findUniqueOrThrow({
      where: { id: memberId },
      select: { name: true },
    });

    await updateBookingFKs(bookingId, { currentAssigneeId: memberId });

    await createTimelineEntry({
      bookingId,
      action:          "MEMBER_ASSIGNED",
      note:            `Assigned to ${member.name}`,
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to assign member" };
  }
}

export async function addNote(bookingId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor();

    await createTimelineEntry({
      bookingId,
      action:          "NOTE_ADDED",
      note,
      performedById:   actor.id,
      performedByName: actor.name,
      departmentId:    actor.departmentId,
    });

    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to add note" };
  }
}