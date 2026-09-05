"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { Prisma, QuerySource } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { toTitleCase } from "@/app/lib/utils";
import { actionError } from "@/app/lib/action-error";
import {
  logTimeline, getCurrentActor, checkExistingQueryByPhone, type ExistingQueryMatch,
} from "../(marketing)/queries/actions";
import { createLog } from "../lib/logger";
import { notifyMember } from "@/app/services/notifications/notify";
import { broadcastVerificationCounts } from "@/app/services/verification-counts.service";
import { phoneKey, PHONE_KEY_SQL } from "@/app/lib/phone";

export type LeadRequestFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

const leadRequestSchema = z.object({
  name: z.string().trim().min(1, "Client name is required").max(255),
  phone: z.string().trim().min(6, "Enter a valid phone number").max(20),
  email: z.string().trim().email("Enter a valid email").optional().or(z.literal("")),
  destination: z.string().trim().min(1, "Destination is required"),
  notes: z.string().trim().max(2000).optional().or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  source: z.enum(["PHONE_CALL", "OTHER"], { message: "Source is required" }),
  sourceOther: z.string().trim().max(200).optional().or(z.literal("")),
}).refine(
  (data) => data.source !== "OTHER" || !!data.sourceOther,
  { message: "Specify the source", path: ["sourceOther"] },
);

/** Who should hear about a freshly submitted request — every active member
 * whose role can actually see the Lead Requests page (empty pageAccess means
 * unrestricted, same rule the sidebar/layout enforce elsewhere), minus the
 * requester themself. There's no separate "lead manager" role in this
 * schema — page access IS the access-control model here. */
async function getLeadRequestNotifyRecipients(excludeId?: string): Promise<string[]> {
  const members = await db.teamMember.findMany({
    where: { isActive: true },
    select: { id: true, teamRole: { select: { pageAccess: true } } },
  });
  return members
    .filter((m) => m.id !== excludeId)
    .filter((m) => {
      const access = Array.isArray(m.teamRole?.pageAccess) ? (m.teamRole!.pageAccess as unknown as string[]) : [];
      return access.length === 0 || access.includes("/dashboard/lead-requests");
    })
    .map((m) => m.id);
}

// ── Sales exec: submit a request ────────────────────────────────────────────

export async function createLeadRequest(
  _prev: LeadRequestFormState,
  formData: FormData,
): Promise<LeadRequestFormState> {
  const parsed = leadRequestSchema.safeParse({
    name: formData.get("name"),
    phone: formData.get("phone"),
    email: formData.get("email") || "",
    destination: formData.get("destination"),
    notes: formData.get("notes") || "",
    message: formData.get("message") || "",
    source: formData.get("source"),
    sourceOther: formData.get("sourceOther") || "",
  });
  if (!parsed.success) {
    return { success: false, message: "Please check the fields below", errors: parsed.error.flatten().fieldErrors };
  }

  try {
    const { teamMemberId, teamMemberName } = await getCurrentActor();
    if (!teamMemberId) return { success: false, message: "Unauthorized" };

    const request = await db.leadRequest.create({
      data: {
        name: toTitleCase(parsed.data.name),
        phone: parsed.data.phone.replace(/\s+/g, ""),
        email: parsed.data.email || null,
        destination: parsed.data.destination,
        notes: parsed.data.notes || null,
        message: parsed.data.message || null,
        source: parsed.data.source,
        sourceOther: parsed.data.source === "OTHER" ? parsed.data.sourceOther || null : null,
        requestedById: teamMemberId,
        requestedByName: teamMemberName ?? "Unknown",
      },
    });

    await createLog({
      action: "CREATE", entity: "lead_request", entityId: request.id, entitySlug: request.name,
      metadata: { operation: "create_lead_request" },
    });

    const recipients = await getLeadRequestNotifyRecipients(teamMemberId);
    await Promise.all(recipients.map((recipientId) => notifyMember({
      recipientId,
      type: "LEAD_REQUEST_SUBMITTED",
      title: `${teamMemberName ?? "A team member"} requested to add a lead`,
      body: `${request.name} — ${request.destination}`,
      link: "/dashboard/lead-requests",
    })));
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/request-lead");
    revalidatePath("/dashboard/lead-requests");
    return { success: true, message: `Request for ${request.name} sent to the lead manager` };
  } catch (e) {
    console.error(e);
    return actionError(e);
  }
}

// ── Sales exec: their own request history ───────────────────────────────────

export async function getMyLeadRequests() {
  const { teamMemberId } = await getCurrentActor();
  if (!teamMemberId) return [];

  return db.leadRequest.findMany({
    where: { requestedById: teamMemberId },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

// ── Lead manager: the review queue ───────────────────────────────────────────

export type LeadRequestRow = Awaited<ReturnType<typeof db.leadRequest.findMany>>[number] & {
  /** Whether this phone already has a query on file — same check Add Query
   * runs live as someone types, reused here so the manager sees it up front
   * instead of having to try each one in Add Query first. */
  duplicate: ExistingQueryMatch | null;
};

export type LeadRequestsFilter = "all" | "pending" | "accepted" | "rejected";

export type LeadRequestStats = { total: number; pending: number; accepted: number; rejected: number };

export async function getLeadRequestsQueue(params: {
  page: number;
  limit: number;
  search: string;
  filter: LeadRequestsFilter;
}): Promise<{ rows: LeadRequestRow[]; totalCount: number; stats: LeadRequestStats }> {
  const { page, limit, search, filter } = params;

  const searchWhere: Prisma.LeadRequestWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: "insensitive" } },
          { phone: { contains: search, mode: "insensitive" } },
          { destination: { contains: search, mode: "insensitive" } },
          { requestedByName: { contains: search, mode: "insensitive" } },
        ],
      }
    : {};

  const filterWhere: Prisma.LeadRequestWhereInput =
    filter === "pending" ? { status: "PENDING" } :
    filter === "accepted" ? { status: "ACCEPTED" } :
    filter === "rejected" ? { status: "REJECTED" } :
    {};

  const where: Prisma.LeadRequestWhereInput = { ...searchWhere, ...filterWhere };

  const [rows, totalCount, total, pending, accepted, rejected] = await Promise.all([
    db.leadRequest.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    db.leadRequest.count({ where }),
    db.leadRequest.count(),
    db.leadRequest.count({ where: { status: "PENDING" } }),
    db.leadRequest.count({ where: { status: "ACCEPTED" } }),
    db.leadRequest.count({ where: { status: "REJECTED" } }),
  ]);

  // Exclude resultingQueryId so an accepted request doesn't match the very
  // query it just became — without this every ACCEPTED row would show a
  // "duplicate" that's just itself.
  const duplicates = await Promise.all(
    rows.map((r) => checkExistingQueryByPhone(r.phone, r.resultingQueryId ?? undefined)),
  );
  const requests = rows.map((r, i) => ({ ...r, duplicate: duplicates[i] }));

  return { rows: requests, totalCount, stats: { total, pending, accepted, rejected } };
}

/** Lead manager or costing manager jotting a note on a request while it's
 * still in the queue — independent of accept/reject so it isn't lost if the
 * reviewer wants to think it over first. Carried onto the resulting query as
 * a QueryNote when the request is accepted. */
export async function updateLeadRequestReviewNote(id: string, note: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { teamMemberId } = await getCurrentActor();
    if (!teamMemberId) return { success: false, error: "Unauthorized" };

    const request = await db.leadRequest.findUnique({ where: { id }, select: { id: true } });
    if (!request) return { success: false, error: "Request not found" };

    await db.leadRequest.update({
      where: { id },
      data: { reviewNote: note.trim() || null },
    });

    revalidatePath("/dashboard/lead-requests");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Something went wrong" };
  }
}

// ── Accept — same creation path Add Query uses ──────────────────────────────

/** Everything Add Query's createManualQuery does after its own validation —
 * duplicate guard, LeadProfile upsert, the package_queries row itself,
 * timeline entry — reused here so an accepted request becomes a query
 * indistinguishable from one entered by hand. Kept local rather than
 * exported off createManualQuery itself: that function is bound to its own
 * much larger FormData shape (whatsapp, package, travel dates…) that a lead
 * request never carries.
 *
 * Assigned straight to whoever requested it rather than through
 * autoAssignLead's least-loaded rotation — requesting a lead is the exec
 * saying "this one's mine," and running it through the fair-rotation
 * algorithm afterward could easily hand it to someone else entirely. */
async function createQueryFromLeadRequest(input: {
  name: string; phone: string; email: string | null; destination: string;
  requestedById: string; requestedByName: string;
  decidedById?: string; decidedByName?: string;
  notes?: string | null; reviewNote?: string | null; message?: string | null;
  source: QuerySource;
}): Promise<{ success: true; queryId: string } | { success: false; error: string }> {
  const cleanPhone = input.phone.replace(/\s+/g, "");
  const normalizedPhone = cleanPhone.replace(/[\-().+]/g, "");
  const displayName = toTitleCase(input.name.trim()) || "Unknown Caller";

  // Same identity rule as Add Query and the website intake — the spelling a
  // number arrives in must not decide whether it is the same person.
  const key = phoneKey(cleanPhone);
  const recentDuplicate = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM package_queries
      WHERE ${PHONE_KEY_SQL} = $1 AND "createdAt" >= $2 AND "deletedAt" IS NULL
      LIMIT 1;`,
    key, new Date(Date.now() - 1000 * 60 * 5),
  );
  if (recentDuplicate.length > 0) {
    return { success: false, error: "A query from this number was submitted in the last 5 minutes." };
  }

  const existingProfile = await db.$queryRawUnsafe<{ id: string }[]>(
    `SELECT id FROM lead_profiles WHERE ${PHONE_KEY_SQL} = $1 LIMIT 1;`, key,
  );
  const profile = existingProfile.length > 0
    ? await db.leadProfile.update({
        where: { id: existingProfile[0].id },
        data: { name: displayName, email: input.email ?? undefined, lastSeenAt: new Date(), totalQueries: { increment: 1 } },
      })
    : await db.leadProfile.create({
        data: { phone: normalizedPhone, name: displayName, email: input.email },
      });

  const query = await db.package_queries.create({
    data: {
      name: displayName,
      phone: cleanPhone,
      email: input.email,
      destination: input.destination,
      // Voice of the customer, in their own words — same field Add Query's
      // "Notes / Message" writes to, so it shows up everywhere a query's
      // message already does (package builder sidebar, the detail sheets).
      message: input.message?.trim() || null,
      source: input.source,
      status: "ASSIGNED",
      verified: false,
      leadProfileId: profile.id,
      assignedTo: input.requestedById,
      assignedToName: input.requestedByName,
      assignedAt: new Date(),
    },
  });

  await logTimeline(
    query.id,
    `Query created from ${input.requestedByName}'s lead request, approved by ${input.decidedByName ?? "the lead manager"} and assigned to ${input.requestedByName}`,
    input.decidedById, input.decidedByName,
    { source: "lead_request" },
  );

  // Carry both notes over so they're on the query from the moment it exists,
  // rather than the manager having to retype what was already written on
  // the request.
  if (input.notes?.trim()) {
    await db.queryNote.create({
      data: { queryId: query.id, authorId: input.requestedById, content: input.notes.trim() },
    });
  }
  if (input.reviewNote?.trim()) {
    await db.queryNote.create({
      data: { queryId: query.id, authorId: input.decidedById ?? "system", content: input.reviewNote.trim() },
    });
  }

  return { success: true, queryId: query.id };
}

async function acceptOne(
  request: {
    id: string; status: string; name: string; phone: string; email: string | null; destination: string;
    requestedById: string; requestedByName: string;
    notes?: string | null; reviewNote?: string | null; message?: string | null;
    source: QuerySource;
  },
  decidedById: string, decidedByName: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (request.status !== "PENDING") return { ok: false, error: "Already decided" };

  const created = await createQueryFromLeadRequest({
    name: request.name, phone: request.phone, email: request.email, destination: request.destination,
    requestedById: request.requestedById, requestedByName: request.requestedByName,
    decidedById, decidedByName,
    notes: request.notes, reviewNote: request.reviewNote, message: request.message,
    source: request.source,
  });
  if (!created.success) return { ok: false, error: created.error };

  await db.leadRequest.update({
    where: { id: request.id },
    data: {
      status: "ACCEPTED", resultingQueryId: created.queryId,
      decidedAt: new Date(), decidedById, decidedByName,
    },
  });

  await notifyMember({
    recipientId: request.requestedById,
    type: "LEAD_REQUEST_APPROVED",
    title: `${request.name} — lead request approved`,
    body: `Added to your queries, assigned to you.`,
    link: "/dashboard/sales-query",
  });

  return { ok: true };
}

export async function acceptLeadRequest(id: string): Promise<{ success: boolean; error?: string }> {
  try {
    const { teamMemberId, teamMemberName } = await getCurrentActor();
    if (!teamMemberId) return { success: false, error: "Unauthorized" };

    const request = await db.leadRequest.findUnique({ where: { id } });
    if (!request) return { success: false, error: "Request not found" };

    const result = await acceptOne(request, teamMemberId, teamMemberName ?? "Lead manager");
    if (!result.ok) return { success: false, error: result.error };

    await createLog({
      action: "UPDATE", entity: "lead_request", entityId: id, entitySlug: request.name,
      metadata: { operation: "accept_lead_request" },
    });
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/lead-requests");
    revalidatePath("/dashboard/queries");
    revalidatePath("/dashboard/sales-query");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Something went wrong" };
  }
}

export async function acceptAllLeadRequests(): Promise<{ success: boolean; accepted: number; skipped: number; error?: string }> {
  try {
    const { teamMemberId, teamMemberName } = await getCurrentActor();
    if (!teamMemberId) return { success: false, accepted: 0, skipped: 0, error: "Unauthorized" };

    const pending = await db.leadRequest.findMany({ where: { status: "PENDING" }, orderBy: { createdAt: "asc" } });

    let accepted = 0;
    let skipped = 0;
    for (const request of pending) {
      const result = await acceptOne(request, teamMemberId, teamMemberName ?? "Lead manager");
      if (result.ok) accepted++; else skipped++;
    }

    await createLog({
      action: "BULK_ACTION", entity: "lead_request",
      metadata: { operation: "accept_all_lead_requests", accepted, skipped },
    });
    await broadcastVerificationCounts();

    revalidatePath("/dashboard/lead-requests");
    revalidatePath("/dashboard/queries");
    revalidatePath("/dashboard/sales-query");
    return { success: true, accepted, skipped };
  } catch (e) {
    console.error(e);
    return { success: false, accepted: 0, skipped: 0, error: "Something went wrong" };
  }
}

// ── Reject ───────────────────────────────────────────────────────────────────

export async function rejectLeadRequest(id: string, reason: string): Promise<{ success: boolean; error?: string }> {
  const trimmed = reason.trim();
  if (!trimmed) return { success: false, error: "A reason is required to reject a request" };

  try {
    const { teamMemberId, teamMemberName } = await getCurrentActor();
    if (!teamMemberId) return { success: false, error: "Unauthorized" };

    const request = await db.leadRequest.findUnique({ where: { id } });
    if (!request) return { success: false, error: "Request not found" };
    if (request.status !== "PENDING") return { success: false, error: "Already decided" };

    await db.leadRequest.update({
      where: { id },
      data: {
        status: "REJECTED", rejectionReason: trimmed,
        decidedAt: new Date(), decidedById: teamMemberId, decidedByName: teamMemberName ?? "Lead manager",
      },
    });

    await createLog({
      action: "UPDATE", entity: "lead_request", entityId: id, entitySlug: request.name,
      metadata: { operation: "reject_lead_request", reason: trimmed },
    });
    await broadcastVerificationCounts();

    await notifyMember({
      recipientId: request.requestedById,
      type: "LEAD_REQUEST_REJECTED",
      title: `${request.name} — lead request rejected`,
      body: trimmed,
      link: "/dashboard/request-lead",
    });

    revalidatePath("/dashboard/lead-requests");
    return { success: true };
  } catch (e) {
    console.error(e);
    return { success: false, error: "Something went wrong" };
  }
}
