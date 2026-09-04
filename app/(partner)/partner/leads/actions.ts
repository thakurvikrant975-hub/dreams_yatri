import "server-only";
import { db } from "@/app/lib/db";

export type PartnerLeadRow = {
  id: string;
  receivedAt: string;
  name: string;
  phone: string;
  email: string | null;
  destination: string | null;
  groupSize: number | null;
  travelDate: string | null;
};

/**
 * The leads one agency has been given.
 *
 * Scoped by an id the caller resolved from the session, never from anything
 * the browser sent — this parameter is the only thing standing between one
 * agency and another's customers, so it is the query's own input rather than
 * a filter applied to a wider result.
 *
 * Ordered by when the lead was handed over, which is the order the agency
 * experiences them in.
 */
export async function getAgencyLeads(memberId: string): Promise<PartnerLeadRow[]> {
  const leads = await db.package_queries.findMany({
    where: { assignedTo: memberId, deletedAt: null },
    orderBy: { assignedAt: "desc" },
    select: {
      id: true, name: true, phone: true, email: true,
      destination: true, groupSize: true, travelDate: true,
      assignedAt: true, createdAt: true,
    },
  });

  return leads.map((l) => ({
    id: l.id,
    receivedAt: (l.assignedAt ?? l.createdAt).toISOString(),
    name: l.name,
    phone: l.phone,
    email: l.email,
    destination: l.destination,
    groupSize: l.groupSize,
    travelDate: l.travelDate?.toISOString() ?? null,
  }));
}
