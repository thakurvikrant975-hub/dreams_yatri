"use server";

import { db } from "@/app/lib/db";
import { BookingStatus, TimelineAction, Prisma, CabType, MealPlan, FoodPreference, RoomSharingType } from "@/app/generated/prisma";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { revalidatePath } from "next/cache";

const BOOKINGS_PER_PAGE = 15;

// ── Actor ─────────────────────────────────────────────────────────────────────

type Actor = { id: string; name: string; departmentId: string | null };

async function getActor(): Promise<Actor> {
  const session = await dashboardAuth();
  if (!session?.user?.id) throw new Error("Unauthorized");
  return {
    id: session.user.id,
    name: session.user.name ?? "Unknown",
    departmentId: (session.user as any).departmentId ?? null,
  };
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type BookingHotelWithRelations = Prisma.BookingHotelGetPayload<{
  include: {
    hotel: {
      select: {
        id: true; name: true; slug: true; star_rating: true;
        address: true; destination_id: true;
      };
    };
    meals: true;
    confirmedBy: { select: { id: true; name: true } };
  };
}>;

export type BookingCabWithRelations = Prisma.BookingCabGetPayload<{
  include: {
    confirmedBy: { select: { id: true; name: true } };
  };
}>;

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
    hotelBookings: {
      include: {
        hotel: {
          select: {
            id: true; name: true; slug: true; star_rating: true; address: true; destination_id: true;
          };
        };
        meals: true;
        confirmedBy: { select: { id: true; name: true } };
      };
      orderBy: { dayNumber: "asc" };
    };
    cabBookings: {
      include: {
        confirmedBy: { select: { id: true; name: true } };
      };
      orderBy: { legNumber: "asc" };
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
  pendingReview: number;
  hotelVerification: number;
  cabVerification: number;
  opsReview: number;
  confirmed: number;
  upcoming: number;
  ongoing: number;
  completed: number;
  modificationRequested: number;
  cancelled: number;
  rejected: number;
  hotelQueuePending: number;
  cabQueuePending: number;
};

// ── Include helpers ───────────────────────────────────────────────────────────

const hotelBookingInclude = {
  hotel: {
    select: {
      id: true, name: true, slug: true,
      star_rating: true, address: true, destination_id: true,
    },
  },
  meals: true,
  confirmedBy: { select: { id: true, name: true } },
} satisfies Prisma.BookingHotelInclude;

const cabBookingInclude = {
  confirmedBy: { select: { id: true, name: true } },
} satisfies Prisma.BookingCabInclude;

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
  hotelBookings: {
    include: hotelBookingInclude,
    orderBy: { dayNumber: "asc" as const },
  },
  cabBookings: {
    include: cabBookingInclude,
    orderBy: { legNumber: "asc" as const },
  },
  currentDepartment: { select: { id: true, name: true } },
  currentAssignee: { select: { id: true, name: true } },
  hotelAssignee: { select: { id: true, name: true } },
  cabAssignee: { select: { id: true, name: true } },
  opsAssignee: { select: { id: true, name: true } },
} satisfies Prisma.BookingInclude;

const VERIFICATION_STATUSES: BookingStatus[] = [
  "PENDING_REVIEW",
  "HOTEL_VERIFICATION",
  "HOTEL_CONFIRMED",
  "CAB_VERIFICATION",
  "CAB_CONFIRMED",
];

// ── Serializer ────────────────────────────────────────────────────────────────

function serializeBooking(b: any): any {
  return {
    ...b,
    totalAmount:  Number(b.totalAmount),
    paidAmount:   Number(b.paidAmount),
    hotelCost:    Number(b.hotelCost ?? 0),
    cabCost:      Number(b.cabCost ?? 0),
    mealCost:     Number(b.mealCost ?? 0),
    subtotal:     Number(b.subtotal ?? 0),
    marginAmount: Number(b.marginAmount ?? 0),
    gstAmount:    Number(b.gstAmount ?? 0),
    payments: b.payments?.map((p: any) => ({ ...p, amount: Number(p.amount) })),
    hotelBookings: b.hotelBookings?.map((h: any) => ({
      ...h,
      ratePerRoom: Number(h.ratePerRoom),
      totalCost:   Number(h.totalCost),
      meals: h.meals?.map((m: any) => ({
        ...m,
        ratePerPerson: Number(m.ratePerPerson),
        totalCost:     Number(m.totalCost),
      })),
    })),
    cabBookings: b.cabBookings?.map((c: any) => ({
      ...c,
      ratePerCab: Number(c.ratePerCab),
      totalCost:  Number(c.totalCost),
    })),
  };
}

// ── Raw FK update ─────────────────────────────────────────────────────────────

async function updateBookingFKs(bookingId: string, fields: Record<string, string | null>) {
  let i = 1;
  const setClauses = Object.entries(fields).map(([col]) => `"${col}" = $${i++}`).join(", ");
  await db.$queryRawUnsafe(
    `UPDATE bookings SET ${setClauses} WHERE id = $${i}`,
    ...Object.values(fields),
    bookingId
  );
}

// ── Timeline helper ───────────────────────────────────────────────────────────

function createTimelineEntry({
  bookingId, action, fromStatus, toStatus,
  note, performedById, performedByName, departmentId,
}: {
  bookingId: string; action: TimelineAction;
  fromStatus?: BookingStatus | null; toStatus?: BookingStatus | null;
  note: string; performedById: string; performedByName: string;
  departmentId?: string | null;
}) {
  return db.bookingTimeline.create({
    data: {
      booking:     { connect: { id: bookingId } },
      performedBy: { connect: { id: performedById } },
      action, fromStatus: fromStatus ?? null, toStatus: toStatus ?? null,
      note, performedByName,
      ...(departmentId ? { department: { connect: { id: departmentId } } } : {}),
    },
  });
}

// ── Auto-advance ──────────────────────────────────────────────────────────────

async function maybeAdvanceToOpsReview(bookingId: string, currentStatus: BookingStatus, actor: Actor) {
  const fresh = await db.booking.findUniqueOrThrow({
    where: { id: bookingId },
    select: { hotelConfirmedAt: true, cabConfirmedAt: true },
  });
  if (!fresh.hotelConfirmedAt || !fresh.cabConfirmedAt) return;

  const opsDept = await db.department.findFirst({
    where: { OR: [
      { name: { contains: "Ops", mode: "insensitive" } },
      { name: { contains: "Operation", mode: "insensitive" } },
    ]},
  });

  await updateBookingFKs(bookingId, {
    status: "OPS_REVIEW",
    currentDepartmentId: opsDept?.id ?? null,
    currentAssigneeId: null,
  });

  await createTimelineEntry({
    bookingId, action: "STATUS_CHANGED",
    fromStatus: currentStatus, toStatus: "OPS_REVIEW",
    note: "Both hotel and cab verified. Auto-moved to ops review.",
    performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
  });
}

// ── Queries ───────────────────────────────────────────────────────────────────

export async function getBookingsPaginated(
  page = 1,
  filters: { status?: BookingStatus; search?: string; destinationId?: number } = {}
): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;
  const where: Prisma.BookingWhereInput = {
    ...(filters.status && { status: filters.status }),
    ...(filters.destinationId && { destinationId: filters.destinationId }),
    ...(filters.search && {
      OR: [
        { bookingNumber: { contains: filters.search, mode: "insensitive" } },
        { user: { name: { contains: filters.search, mode: "insensitive" } } },
        { user: { email: { contains: filters.search, mode: "insensitive" } } },
      ],
    }),
  };

  const [bookings, totalCount] = await Promise.all([
    db.booking.findMany({ where, include: bookingInclude, orderBy: { createdAt: "desc" }, skip, take: BOOKINGS_PER_PAGE }),
    db.booking.count({ where }),
  ]);

  return {
    bookings: bookings.map(serializeBooking) as unknown as BookingWithRelations[],
    totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE),
    totalCount,
  };
}

export async function getBookingById(id: string): Promise<BookingWithRelations | null> {
  const b = await db.booking.findUnique({ where: { id }, include: bookingInclude });
  return b ? serializeBooking(b) as unknown as BookingWithRelations : null;
}

export async function getBookingStats(): Promise<BookingStats> {
  const [statusCounts, hotelQueuePending, cabQueuePending] = await Promise.all([
    db.booking.groupBy({ by: ["status"], _count: { _all: true } }),
    db.booking.count({ where: { status: { in: VERIFICATION_STATUSES }, hotelConfirmedAt: null } }),
    db.booking.count({ where: { status: { in: VERIFICATION_STATUSES }, cabConfirmedAt: null } }),
  ]);

  const s = Object.fromEntries(statusCounts.map((c) => [c.status, c._count._all]));

  return {
    total:                 Object.values(s).reduce((a, b) => a + b, 0),
    pendingReview:         s["PENDING_REVIEW"] ?? 0,
    hotelVerification:     s["HOTEL_VERIFICATION"] ?? 0,
    cabVerification:       s["CAB_VERIFICATION"] ?? 0,
    opsReview:             s["OPS_REVIEW"] ?? 0,
    confirmed:             s["CONFIRMED"] ?? 0,
    upcoming:              s["UPCOMING"] ?? 0,
    ongoing:               s["ONGOING"] ?? 0,
    completed:             s["COMPLETED"] ?? 0,
    modificationRequested: s["MODIFICATION_REQUESTED"] ?? 0,
    cancelled:             s["CANCELLED"] ?? 0,
    rejected:              s["REJECTED"] ?? 0,
    hotelQueuePending,
    cabQueuePending,
  };
}

export async function getHotelVerificationQueue(page = 1): Promise<PaginatedBookings> {
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

export async function getCabVerificationQueue(page = 1): Promise<PaginatedBookings> {
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
  return db.destinations.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
}

// Get hotels by city for hotel swap
export async function getHotelsByCity(cityName: string, destinationId: number) {
  return db.hotels.findMany({
    where: {
      destination_id: destinationId,
      is_active: true,
      OR: [
        { address: { contains: cityName, mode: "insensitive" } },
        { name:    { contains: cityName, mode: "insensitive" } },
      ],
    },
    select: {
      id: true, name: true, slug: true, star_rating: true,
      address: true,
      room_pricing: {
        where: { is_active: true },
<<<<<<< HEAD
        select: { id: true, room_type: true,  max_occupancy: true },
=======
        select: { id: true, room_type: true, rate_per_night: true, max_occupancy: true },
>>>>>>> origin/website-pages
      },
    },
    orderBy: { star_rating: "desc" },
  });
}

// ── Hotel day-wise mutations ───────────────────────────────────────────────────

type ActionResult = { success: true } | { success: false; error: string };

export async function confirmBookingHotelDay(
  bookingHotelId: string,
  bookingId: string
): Promise<ActionResult> {
  try {
    const actor = await getActor();

    await db.bookingHotel.update({
      where: { id: bookingHotelId },
      data: {
        isConfirmed: true,
        confirmedAt: new Date(),
        confirmedBy: { connect: { id: actor.id } },
      },
    });

    // Check if ALL hotel days for this booking are confirmed
    const allDays = await db.bookingHotel.findMany({
      where: { bookingId },
      select: { isConfirmed: true },
    });

    const allConfirmed = allDays.every((d) => d.isConfirmed);

    if (allConfirmed) {
      const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

      await updateBookingFKs(bookingId, {
        hotelConfirmedAt: new Date().toISOString(),
        hotelAssigneeId:  actor.id,
      });

      await createTimelineEntry({
        bookingId, action: "DEPARTMENT_CONFIRMED",
        fromStatus: booking.status, toStatus: booking.status,
        note: "All hotel nights confirmed by hotel department.",
        performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
      });

      await maybeAdvanceToOpsReview(bookingId, booking.status, actor);
    }

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm hotel day" };
  }
}

export async function swapBookingHotel(
  bookingHotelId: string,
  bookingId: string,
  newHotelId: number,
  roomType: string,
  ratePerRoom: number,
  note?: string
): Promise<ActionResult> {
  try {
    const actor = await getActor();

    const existingDay = await db.bookingHotel.findUniqueOrThrow({
      where: { id: bookingHotelId },
      select: { roomsCount: true, dayNumber: true },
    });

    const totalCost = existingDay.roomsCount * ratePerRoom;

    await db.bookingHotel.update({
      where: { id: bookingHotelId },
      data: {
        hotel:       { connect: { id: newHotelId } },
        roomType,
        ratePerRoom,
        totalCost,
        isConfirmed: false,
        confirmedAt: null,
        confirmedById: null,
        notes: note ?? null,
      },
    });

    await createTimelineEntry({
      bookingId, action: "NOTE_ADDED",
      note: `Day ${existingDay.dayNumber} hotel changed.${note ? ` Reason: ${note}` : ""}`,
      performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
    });

    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to swap hotel" };
  }
}

export async function flagHotelIssue(bookingId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, { status: "MODIFICATION_REQUESTED", modificationNote: note });
    await createTimelineEntry({
      bookingId, action: "DEPARTMENT_FLAGGED",
      fromStatus: booking.status, toStatus: "MODIFICATION_REQUESTED",
      note, performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag hotel issue" };
  }
}

// ── Cab mutations ─────────────────────────────────────────────────────────────

export async function confirmBookingCabLeg(
  bookingCabId: string,
  bookingId: string,
  driverName?: string,
  driverPhone?: string,
  vehicleNumber?: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const actor = await getActor();

    await db.bookingCab.update({
      where: { id: bookingCabId },
      data: {
        isConfirmed:   true,
        confirmedAt:   new Date(),
        confirmedBy:   { connect: { id: actor.id } },
        driverName:    driverName    ?? null,
        driverPhone:   driverPhone   ?? null,
        vehicleNumber: vehicleNumber ?? null,
        notes:         notes         ?? null,
      },
    });

    // Check if ALL cab legs confirmed
    const allLegs = await db.bookingCab.findMany({
      where: { bookingId },
      select: { isConfirmed: true },
    });

    const allConfirmed = allLegs.every((l) => l.isConfirmed);

    if (allConfirmed) {
      const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

      await updateBookingFKs(bookingId, {
        cabConfirmedAt: new Date().toISOString(),
        cabAssigneeId:  actor.id,
      });

      await createTimelineEntry({
        bookingId, action: "DEPARTMENT_CONFIRMED",
        fromStatus: booking.status, toStatus: booking.status,
        note: "All cab legs confirmed by cab department.",
        performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
      });

      await maybeAdvanceToOpsReview(bookingId, booking.status, actor);
    }

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm cab leg" };
  }
}

export async function updateCabType(
  bookingCabId: string,
  bookingId: string,
  cabType: CabType,
  capacity: number,
  ratePerCab: number,
  note?: string
): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const existing = await db.bookingCab.findUniqueOrThrow({
      where: { id: bookingCabId },
      select: { cabCount: true, legNumber: true },
    });

    await db.bookingCab.update({
      where: { id: bookingCabId },
      data: {
        cabType, capacity, ratePerCab,
        totalCost:   existing.cabCount * ratePerCab,
        isConfirmed: false,
        confirmedAt: null,
        confirmedById: null,
      },
    });

    await createTimelineEntry({
      bookingId, action: "NOTE_ADDED",
      note: `Leg ${existing.legNumber} cab changed to ${cabType}.${note ? ` Reason: ${note}` : ""}`,
      performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
    });

    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to update cab type" };
  }
}

export async function flagCabIssue(bookingId: string, note: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, { status: "MODIFICATION_REQUESTED", modificationNote: note });
    await createTimelineEntry({
      bookingId, action: "DEPARTMENT_FLAGGED",
      fromStatus: booking.status, toStatus: "MODIFICATION_REQUESTED",
      note, performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
    });

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag cab issue" };
  }
}

// ── Ops mutations ─────────────────────────────────────────────────────────────

export async function confirmBooking(bookingId: string, note?: string): Promise<ActionResult> {
  try {
    const actor = await getActor();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await updateBookingFKs(bookingId, {
      status: "CONFIRMED", opsReviewedAt: new Date().toISOString(),
      opsAssigneeId: actor.id, currentDepartmentId: null, currentAssigneeId: null,
    });

    await createTimelineEntry({
      bookingId, action: "STATUS_CHANGED",
      fromStatus: booking.status, toStatus: "CONFIRMED",
      note: note ?? "Booking confirmed by operations. Confirmation email sent.",
      performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
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
      status: "REJECTED", rejectionReason: reason,
      currentDepartmentId: null, currentAssigneeId: null,
    });

    await createTimelineEntry({
      bookingId, action: "STATUS_CHANGED",
      fromStatus: booking.status, toStatus: "REJECTED",
      note: reason, performedById: actor.id, performedByName: actor.name,
      departmentId: actor.departmentId,
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
      where: { id: memberId }, select: { name: true },
    });

    await updateBookingFKs(bookingId, { currentAssigneeId: memberId });
    await createTimelineEntry({
      bookingId, action: "MEMBER_ASSIGNED",
      note: `Assigned to ${member.name}`,
      performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
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
      bookingId, action: "NOTE_ADDED", note,
      performedById: actor.id, performedByName: actor.name, departmentId: actor.departmentId,
    });
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to add note" };
  }
}