import "server-only";
import { db } from "@/app/lib/db";
import { getBoolSetting, SETTINGS_KEYS } from "@/app/lib/system-settings";
import { resolveManagerRecipients, notifyOnce } from "@/app/lib/notifications/recipients";

const CUTOFF_HOUR = 10;
const CUTOFF_MINUTE = 5;
const TIMEZONE = "Asia/Kolkata";

function todayStart(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

/** Roles the 10:05 AM login cutoff applies to — Sales Executives and
 * anyone leading a sales team (requirement #1 names "Sales Executives and
 * Team Leaders"; this codebase models "team leader" as a relation
 * (SalesTeam.leaderId), not a separate role name, so both are checked). */
export function isCutoffRole(roleName: string | null | undefined, leadsTeam: boolean): boolean {
  const role = (roleName ?? "").toLowerCase();
  return role === "sales executive" || role === "team leader" || leadsTeam;
}

/** Current hour/minute in IST, independent of the server's own timezone. */
function currentIstMinutes(): number {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: TIMEZONE, hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(new Date());
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? "0");
  const minute = Number(parts.find((p) => p.type === "minute")?.value ?? "0");
  return hour * 60 + minute;
}

export function isPastLoginCutoff(): boolean {
  return currentIstMinutes() > CUTOFF_HOUR * 60 + CUTOFF_MINUTE;
}

/** First login of the day creates the row; a later login in the same day
 * only touches lastHeartbeatAt, not loginAt. */
export async function stampLogin(memberId: string): Promise<void> {
  const date = todayStart();
  const now = new Date();
  await db.attendance.upsert({
    where: { memberId_date: { memberId, date } },
    create: { memberId, date, loginAt: now },
    update: {},
  });
  await db.teamMember.update({ where: { id: memberId }, data: { lastHeartbeatAt: now } });
}

/** Explicit sign-out — no approval implication, unlike the inactivity
 * sweep's auto-logout (see sla-sweep.service.ts). */
export async function stampLogout(memberId: string): Promise<void> {
  const date = todayStart();
  const now = new Date();
  await db.attendance.upsert({
    where: { memberId_date: { memberId, date } },
    create: { memberId, date, logoutAt: now },
    update: { logoutAt: now },
  });
  await db.teamMember.update({ where: { id: memberId }, data: { lastHeartbeatAt: null } });
}

export type LoginGateResult =
  | { blocked: false }
  | { blocked: true; reason: "late_login_pending_approval" | "relogin_pending_approval" };

/** Fails OPEN on any unexpected error — a bug here must never lock out the
 * whole sales floor. Called from auth-dashboard.ts's authorize(). */
export async function checkLoginGate(
  memberId: string,
  roleName: string | null | undefined,
  leadsTeam: boolean,
): Promise<LoginGateResult> {
  try {
    const member = await db.teamMember.findUnique({
      where: { id: memberId },
      select: { pendingReloginApproval: true },
    });

    if (member?.pendingReloginApproval) {
      const approved = await db.loginApprovalRequest.findFirst({
        where: { memberId, reason: "AUTO_LOGOUT", forDate: todayStart(), status: "APPROVED" },
      });
      if (approved) {
        await db.teamMember.update({ where: { id: memberId }, data: { pendingReloginApproval: false } });
      } else {
        await db.loginApprovalRequest.upsert({
          where: { memberId_forDate_reason: { memberId, forDate: todayStart(), reason: "AUTO_LOGOUT" } },
          create: { memberId, forDate: todayStart(), reason: "AUTO_LOGOUT" },
          update: {},
        });
        return { blocked: true, reason: "relogin_pending_approval" };
      }
    }

    if (!isCutoffRole(roleName, leadsTeam) || !isPastLoginCutoff()) return { blocked: false };

    const enforce = await getBoolSetting(SETTINGS_KEYS.enforceLoginCutoff, false);
    const approved = await db.loginApprovalRequest.findFirst({
      where: { memberId, reason: "LATE_LOGIN", forDate: todayStart(), status: "APPROVED" },
    });
    if (approved) return { blocked: false };

    await db.loginApprovalRequest.upsert({
      where: { memberId_forDate_reason: { memberId, forDate: todayStart(), reason: "LATE_LOGIN" } },
      create: { memberId, forDate: todayStart(), reason: "LATE_LOGIN" },
      update: {},
    });

    const recipients = await resolveManagerRecipients(memberId);
    for (const recipientId of recipients) {
      await notifyOnce({
        memberId: recipientId,
        type: "LATE_LOGIN",
        entityType: "team_members",
        entityId: memberId,
        title: enforce ? "Late login blocked" : "Late login",
        body: enforce
          ? "Tried to log in past 10:05 AM — blocked pending approval."
          : "Logged in past 10:05 AM (shadow mode — not blocked).",
        link: "/dashboard/login-approvals",
        severity: "MEDIUM",
      });
    }

    return enforce ? { blocked: true, reason: "late_login_pending_approval" } : { blocked: false };
  } catch (e) {
    console.error("[checkLoginGate] failing open:", e);
    return { blocked: false };
  }
}
