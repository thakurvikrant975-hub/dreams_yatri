import "server-only";
import { db } from "@/app/lib/db";
import { resolveManagerRecipients, notifyOnce } from "@/app/lib/notifications/recipients";

const UNATTENDED_LEAD_MS = 15 * 60 * 1000;
const PACKAGE_DELAY_MS = 2 * 60 * 60 * 1000;
const DASHBOARD_INACTIVITY_MS = 15 * 60 * 1000;

// Statuses a lead sits in before a package has gone out — the package-send
// SLA only applies while it's still in one of these.
const PRE_PACKAGE_STATUSES = ["ASSIGNED", "IN_PROGRESS", "FOLLOW_UP"] as const;

async function sweepUnattendedLeads(now: Date) {
  const cutoff = new Date(now.getTime() - UNATTENDED_LEAD_MS);

  const leads = await db.package_queries.findMany({
    where: {
      deletedAt: null,
      status: "ASSIGNED",
      firstRespondedAt: null,
      assignedTo: { not: null },
      assignedAt: { not: null, lte: cutoff },
    },
    select: { id: true, name: true, assignedTo: true, assignedAt: true },
  });

  let created = 0;
  for (const lead of leads) {
    if (!lead.assignedTo || !lead.assignedAt) continue;
    const minsOverdue = Math.round((now.getTime() - lead.assignedAt.getTime()) / 60000);
    const recipients = await resolveManagerRecipients(lead.assignedTo);
    for (const memberId of recipients) {
      await notifyOnce({
        memberId,
        type: "UNATTENDED_LEAD",
        entityType: "package_queries",
        entityId: lead.id,
        title: "Unattended lead",
        body: `${lead.name}'s lead has been unattended for ${minsOverdue} min.`,
        link: `/dashboard/sales-query?query=${lead.id}`,
        severity: "MEDIUM",
      });
    }
    created += 1;
  }
  return created;
}

async function sweepPackageDelays(now: Date) {
  const cutoff = new Date(now.getTime() - PACKAGE_DELAY_MS);

  const leads = await db.package_queries.findMany({
    where: {
      deletedAt: null,
      status: { in: [...PRE_PACKAGE_STATUSES] },
      firstPackageSentAt: null,
      assignedTo: { not: null },
      OR: [
        { firstRespondedAt: { not: null, lte: cutoff } },
        { firstRespondedAt: null, assignedAt: { not: null, lte: cutoff } },
      ],
    },
    select: { id: true, name: true, assignedTo: true, assignedAt: true, firstRespondedAt: true },
  });

  let created = 0;
  for (const lead of leads) {
    if (!lead.assignedTo) continue;
    const since = lead.firstRespondedAt ?? lead.assignedAt;
    if (!since) continue;
    const hoursOverdue = (now.getTime() - since.getTime()) / 3600000;
    const recipients = await resolveManagerRecipients(lead.assignedTo);
    for (const memberId of recipients) {
      await notifyOnce({
        memberId,
        type: "PACKAGE_SEND_DELAY",
        entityType: "package_queries",
        entityId: lead.id,
        title: "Package sending delayed",
        body: `${lead.name}'s package hasn't been sent — ${hoursOverdue.toFixed(1)}h since assignment.`,
        link: `/dashboard/sales-query?query=${lead.id}`,
        severity: "HIGH",
      });
    }
    created += 1;
  }
  return created;
}

/** Auto-logout for dashboard inactivity (requirement #3). Bumps
 * sessionVersion — the SAME field auth-dashboard.ts's force-logout check
 * already compares against on every request (see schema.prisma's comment
 * on TeamMember.sessionVersion) — so this reuses that existing kill-switch
 * instead of inventing new session-invalidation logic. Re-login is then
 * gated by checkLoginGate() in attendance.ts via pendingReloginApproval. */
async function sweepDashboardInactivity(now: Date) {
  const cutoff = new Date(now.getTime() - DASHBOARD_INACTIVITY_MS);

  // Scoped to Sales Executives / Team Leaders only, matching requirement #3
  // — not every dashboard user (hotel/marketing/admin staff untouched).
  const stale = await db.teamMember.findMany({
    where: {
      lastHeartbeatAt: { not: null, lte: cutoff },
      isActive: true,
      OR: [
        { teamRole: { name: { equals: "Sales Executive", mode: "insensitive" } } },
        { teamRole: { name: { equals: "Team Leader", mode: "insensitive" } } },
        { ledSalesTeam: { isNot: null } },
      ],
    },
    select: { id: true, name: true },
  });

  const date = new Date();
  date.setUTCHours(0, 0, 0, 0);

  for (const member of stale) {
    await db.$transaction([
      db.teamMember.update({
        where: { id: member.id },
        data: { sessionVersion: { increment: 1 }, lastHeartbeatAt: null, pendingReloginApproval: true },
      }),
      db.attendance.upsert({
        where: { memberId_date: { memberId: member.id, date } },
        create: { memberId: member.id, date, logoutAt: now },
        update: { logoutAt: now },
      }),
    ]);

    const recipients = await resolveManagerRecipients(member.id);
    for (const memberId of recipients) {
      await notifyOnce({
        memberId,
        type: "DASHBOARD_INACTIVITY",
        entityType: "team_members",
        entityId: member.id,
        title: "Auto-logged out for inactivity",
        body: `${member.name} was logged out after 15 min inactive — re-login needs approval.`,
        link: "/dashboard/login-approvals",
        severity: "MEDIUM",
      });
    }
  }
  return stale.length;
}

export async function runSlaSweep() {
  const now = new Date();
  const [unattendedLeads, packageDelays, dashboardInactivity] = await Promise.all([
    sweepUnattendedLeads(now),
    sweepPackageDelays(now),
    sweepDashboardInactivity(now),
  ]);
  return { unattendedLeads, packageDelays, dashboardInactivity };
}
