import { db } from "@/app/lib/db";
import { headers } from "next/headers";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import crypto from "crypto";
import type { LogAction, LogStatus, LogSeverity } from "@/app/generated/prisma";

export type LogPayload = {
  userId?:          string;
  userEmail?:       string;
  userName?:        string;
  userRole?:        string;

  action:       LogAction;
  entity:       string;
  entityId?:    string;
  entitySlug?:  string;
  description?: string;   
  
  previousData?: object;
  newData?:      object;
  metadata?:     object;

  status?:       LogStatus;
  errorMessage?: string;
  statusCode?:   number;

  severity?:     LogSeverity;
  isSuspicious?: boolean;
  flagReason?:   string;
};

// ── Auto-generate description if not passed ───────────────────────────────────
function buildDescription(
  payload: LogPayload,
  actorName: string | undefined,
  actorRole: string | undefined,
): string {
  if (payload.description) return payload.description;

  const actor = actorName ?? "Unknown user";
  const role  = actorRole  ? `(${actorRole})` : "";
  const target = payload.entityId
    ? `${payload.entity} [${payload.entitySlug ?? payload.entityId}]`
    : payload.entity;

  const actionMap: Record<string, string> = {
    CREATE:            `${actor} ${role} created a new ${target}`,
    UPDATE:            `${actor} ${role} updated ${target}`,
    DELETE:            `${actor} ${role} permanently deleted ${target}`,
    LOGIN:             `${actor} ${role} signed in to the dashboard`,
    LOGOUT:            `${actor} ${role} signed out`,
    LOGIN_FAILED:      `Failed login attempt for ${payload.userEmail ?? "unknown email"}`,
    PASSWORD_CHANGE:   `${actor} ${role} changed password for ${target}`,
    PERMISSION_CHANGE: `${actor} ${role} changed permissions on ${target}`,
    EXPORT:            `${actor} ${role} exported ${target}`,
    BULK_ACTION:       `${actor} ${role} performed a bulk action on ${payload.entity}`,
    VIEW_SENSITIVE:    `${actor} ${role} accessed sensitive data in ${target}`,
  };

  const base = actionMap[payload.action] ?? `${actor} performed ${payload.action} on ${target}`;

  // Append metadata hints if present
  const meta = payload.metadata as Record<string, string> | undefined;
  if (meta?.operation === "toggle_active" && payload.newData) {
    const d = payload.newData as { isActive?: boolean };
    return `${actor} ${role} ${d.isActive ? "activated" : "deactivated"} ${target}`;
  }
  if (meta?.type === "system_reset") {
    return `${actor} ${role} reset password for ${target}`;
  }
  if (meta?.type === "manual_set") {
    return `${actor} ${role} manually set a new password for ${target}`;
  }

  if (payload.status === "FAILED") {
    return `${base} — FAILED: ${payload.errorMessage ?? "unknown error"}`;
  }

  return base;
}

// ── Geo lookup ────────────────────────────────────────────────────────────────
async function getGeoFromIp(
  ip: string
): Promise<{ country: string | null; region: string | null; city: string | null }> {
  const empty = { country: null, region: null, city: null };

  if (
    !ip ||
    ip === "::1" ||
    ip === "127.0.0.1" ||
    ip.startsWith("192.168.") ||
    ip.startsWith("10.") ||
    ip === "unknown"
  ) return empty;

  try {
    const res = await fetch(
      `http://ip-api.com/json/${ip}?fields=status,country,regionName,city`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();
    if (data.status !== "success") return empty;
    return {
      country: data.country   ?? null,
      region:  data.regionName ?? null,
      city:    data.city       ?? null,
    };
  } catch {
    return empty;
  }
}

// ── Main logger ───────────────────────────────────────────────────────────────
export async function createLog(payload: LogPayload): Promise<void> {
  try {
    const session = await dashboardAuth();

    const actor = {
      userId:    payload.userId    ?? session?.user?.id    ?? undefined,
      userEmail: payload.userEmail ?? session?.user?.email ?? undefined,
      userName:  payload.userName  ?? session?.user?.name  ?? undefined,
      userRole:  payload.userRole  ?? session?.user?.role  ?? undefined,
    };

    const headersList = await headers();

    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "::1";

    const sessionToken = headersList.get("x-session-token");
    const sessionId = sessionToken
      ? crypto.createHash("sha256").update(sessionToken).digest("hex").slice(0, 16)
      : undefined;

    // Geo + description run in parallel
    const [geo] = await Promise.all([
      getGeoFromIp(ip),
    ]);

    const description = buildDescription(payload, actor.userName, actor.userRole);

    await db.activityLog.create({
      data: {
        // Actor
        userId:    actor.userId,
        userEmail: actor.userEmail,
        userName:  actor.userName,
        userRole:  actor.userRole,

        // Action
        action:      payload.action,
        entity:      payload.entity,
        entityId:    payload.entityId,
        entitySlug:  payload.entitySlug,
        description,

        // Diff
        previousData: payload.previousData ?? undefined,
        newData:      payload.newData      ?? undefined,
        metadata:     payload.metadata     ?? undefined,

        // Outcome
        status:       payload.status       ?? "SUCCESS",
        errorMessage: payload.errorMessage,
        statusCode:   payload.statusCode,

        // Risk
        severity:     payload.severity    ?? "LOW",
        isSuspicious: payload.isSuspicious ?? false,
        flagReason:   payload.flagReason,

        // Request context
        ipAddress:     ip,
        userAgent:     headersList.get("user-agent")       ?? undefined,
        referer:       headersList.get("referer")          ?? undefined,
        requestPath:   headersList.get("x-request-path")   ?? undefined,
        requestMethod: headersList.get("x-request-method") ?? undefined,
        requestId:     headersList.get("x-request-id")     ?? crypto.randomUUID(),
        sessionId,

        // Geo
        country: geo.country,
        region:  geo.region,
        city:    geo.city,
      },
    });
  } catch (err) {
    console.error("[createLog] Failed:", err);
  }
}