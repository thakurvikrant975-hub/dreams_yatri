import "server-only";
import { db } from "@/app/lib/db";

/** The member plus everyone who should also see their exceptions: their
 * sales team's leader, and every "Sales Manager"-role member (there's no
 * single designated manager per team member today — see SalesTeam in
 * schema.prisma — so every Sales Manager gets full visibility, matching
 * requirement #8). Deduped by memberId. */
export async function resolveManagerRecipients(memberId: string): Promise<string[]> {
  const ids = new Set<string>([memberId]);

  const member = await db.teamMember.findUnique({
    where: { id: memberId },
    select: { salesTeam: { select: { leaderId: true } } },
  });
  if (member?.salesTeam?.leaderId) ids.add(member.salesTeam.leaderId);

  const managers = await db.teamMember.findMany({
    where: { teamRole: { name: { equals: "Sales Manager", mode: "insensitive" } }, isActive: true },
    select: { id: true },
  });
  managers.forEach((m) => ids.add(m.id));

  return [...ids];
}

/** Skip re-notifying while an earlier, still-unread alert for the same
 * entity+type+recipient already exists. */
export async function notifyOnce(params: {
  memberId: string;
  type: "UNATTENDED_LEAD" | "PACKAGE_SEND_DELAY" | "MISSED_FOLLOW_UP" | "LATE_LOGIN" | "LOGIN_APPROVAL_REQUEST" | "DASHBOARD_INACTIVITY" | "TARGET_SHORTFALL";
  entityId: string;
  entityType?: string;
  title: string;
  body: string;
  link: string;
  severity: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}) {
  const existing = await db.teamNotification.findFirst({
    where: { memberId: params.memberId, type: params.type, entityId: params.entityId, readAt: null },
    select: { id: true },
  });
  if (existing) return;

  await db.teamNotification.create({
    data: {
      memberId: params.memberId,
      type: params.type,
      entityType: params.entityType,
      entityId: params.entityId,
      title: params.title,
      body: params.body,
      link: params.link,
      severity: params.severity,
    },
  });
}
