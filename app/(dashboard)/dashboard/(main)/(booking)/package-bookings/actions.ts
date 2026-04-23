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
  pendingReview: number;
  hotelVerification: number;
  cabVerification: number;
  confirmed: number;
  cancelled: number;
};

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
    bookings,
    totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE),
    totalCount,
  };
}

export async function getBookingStats(): Promise<BookingStats> {
  const counts = await db.booking.groupBy({
    by: ["status"],
    _count: { _all: true },
  });

  const map = Object.fromEntries(counts.map((c) => [c.status, c._count._all]));

  return {
    total: Object.values(map).reduce((a, b) => a + b, 0),
    pendingReview: map["PENDING_REVIEW"] ?? 0,
    hotelVerification: map["HOTEL_VERIFICATION"] ?? 0,
    cabVerification: map["CAB_VERIFICATION"] ?? 0,
    confirmed: map["CONFIRMED"] ?? 0,
    cancelled: map["CANCELLED"] ?? 0,
  };
}

export async function getBookingById(id: string): Promise<BookingWithRelations | null> {
  return db.booking.findUnique({
    where: { id },
    include: bookingInclude,
  });
}

// Verify-hotel queue: bookings needing hotel verification
export async function getHotelVerificationQueue(page: number = 1): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;
  const where: Prisma.BookingWhereInput = {
    status: { in: ["HOTEL_VERIFICATION", "PENDING_REVIEW"] },
    hotelConfirmedAt: null,
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

  return { bookings, totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE), totalCount };
}

// Verify-cab queue: bookings needing cab verification
export async function getCabVerificationQueue(page: number = 1): Promise<PaginatedBookings> {
  const skip = (page - 1) * BOOKINGS_PER_PAGE;
  const where: Prisma.BookingWhereInput = {
    status: "CAB_VERIFICATION",
    cabConfirmedAt: null,
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

  return { bookings, totalPages: Math.ceil(totalCount / BOOKINGS_PER_PAGE), totalCount };
}

export async function getTeamMembersForAssign() {
  return db.teamMember.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      department: { select: { id: true, name: true } },
    },
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

export async function confirmHotel(
  bookingId: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    // Get cab department to auto-transition
    const cabDept = await db.department.findFirst({ where: { name: "Cab" } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: {
          hotelConfirmedAt: new Date(),
          hotelNotes: notes,
          status: "CAB_VERIFICATION",
          currentDepartmentId: cabDept?.id ?? null,
          currentAssigneeId: null,
        },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "DEPARTMENT_CONFIRMED",
          fromStatus: booking.status,
          toStatus: "CAB_VERIFICATION",
          note: notes ?? "Hotel availability and pricing confirmed",
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm hotel" };
  }
}

export async function flagHotelIssue(
  bookingId: string,
  note: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: { status: "MODIFICATION_REQUESTED", modificationNote: note },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "DEPARTMENT_FLAGGED",
          fromStatus: booking.status,
          toStatus: "MODIFICATION_REQUESTED",
          note,
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-hotel");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag hotel issue" };
  }
}

export async function confirmCab(
  bookingId: string,
  notes?: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    const opsDept = await db.department.findFirst({ where: { name: "Operations" } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: {
          cabConfirmedAt: new Date(),
          cabNotes: notes,
          status: "OPS_REVIEW",
          currentDepartmentId: opsDept?.id ?? null,
          currentAssigneeId: null,
        },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "DEPARTMENT_CONFIRMED",
          fromStatus: booking.status,
          toStatus: "OPS_REVIEW",
          note: notes ?? "Cab availability confirmed",
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm cab" };
  }
}

export async function flagCabIssue(
  bookingId: string,
  note: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: { status: "MODIFICATION_REQUESTED", modificationNote: note },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "DEPARTMENT_FLAGGED",
          fromStatus: booking.status,
          toStatus: "MODIFICATION_REQUESTED",
          note,
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath("/dashboard/verify-cabs");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to flag cab issue" };
  }
}

export async function confirmBooking(
  bookingId: string,
  note?: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: {
          status: "CONFIRMED",
          opsReviewedAt: new Date(),
          opsAssigneeId: actor.id,
          currentDepartmentId: null,
          currentAssigneeId: null,
        },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "STATUS_CHANGED",
          fromStatus: booking.status,
          toStatus: "CONFIRMED",
          note: note ?? "Booking confirmed by operations",
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    // TODO: trigger confirmation email here

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to confirm booking" };
  }
}

export async function rejectBooking(
  bookingId: string,
  reason: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const booking = await db.booking.findUniqueOrThrow({ where: { id: bookingId } });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: {
          status: "REJECTED",
          rejectionReason: reason,
          currentDepartmentId: null,
          currentAssigneeId: null,
        },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "STATUS_CHANGED",
          fromStatus: booking.status,
          toStatus: "REJECTED",
          note: reason,
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    // TODO: trigger rejection email + refund flag

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to reject booking" };
  }
}

export async function assignMember(
  bookingId: string,
  memberId: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();
    const member = await db.teamMember.findUniqueOrThrow({
      where: { id: memberId },
      select: { name: true },
    });

    await db.$transaction([
      db.booking.update({
        where: { id: bookingId },
        data: { currentAssigneeId: memberId },
      }),
      db.bookingTimeline.create({
        data: {
          bookingId,
          action: "MEMBER_ASSIGNED",
          note: `Assigned to ${member.name}`,
          performedById: actor.id,
          performedByName: actor.name ?? "Unknown",
          departmentId: actor.departmentId ?? undefined,
        },
      }),
    ]);

    revalidatePath("/dashboard/package-bookings");
    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to assign member" };
  }
}

export async function addNote(
  bookingId: string,
  note: string
): Promise<ActionResult> {
  try {
    const actor = await dashboardAuth();

    await db.bookingTimeline.create({
      data: {
        bookingId,
        action: "NOTE_ADDED",
        note,
        performedById: actor.id,
        performedByName: actor.name ?? "Unknown",
        departmentId: actor.departmentId ?? undefined,
      },
    });

    revalidatePath(`/dashboard/package-bookings/${bookingId}`);
    return { success: true };
  } catch (e: any) {
    return { success: false, error: e.message ?? "Failed to add note" };
  }
}