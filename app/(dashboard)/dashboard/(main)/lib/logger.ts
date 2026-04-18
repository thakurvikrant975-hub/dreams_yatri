// app/lib/logger.ts
import { db } from "@/app/lib/db";
import { headers } from "next/headers";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import crypto from "crypto";
import type { LogAction, LogStatus, LogSeverity } from "@/app/generated/prisma";

export type LogPayload = {
  // All actor fields optional — auto-resolved from dashboardAuth()
  userId?:          string;
  userEmail?:       string;
  userName?:        string;
  userRole?:        string;

  // What happened
  action:      LogAction;
  entity:      string;
  entityId?:   string;
  entitySlug?: string;

  // Data diff
  previousData?: object;
  newData?:      object;
  metadata?:     object;

  // Outcome
  status?:       LogStatus;
  errorMessage?: string;
  statusCode?:   number;

  // Risk
  severity?:     LogSeverity;
  isSuspicious?: boolean;
  flagReason?:   string;
};

export async function createLog(payload: LogPayload): Promise<void> {
  try {
    // ── Auto-resolve actor from dashboard session ──────────────────────────
    // Reads dy.dashboard.session-token cookie — always the logged-in employee,
    // never the public website user. Zero manual passing required.
    const session = await dashboardAuth();

    const actor = {
      userId:    payload.userId    ?? session?.user?.id    ?? undefined,
      userEmail: payload.userEmail ?? session?.user?.email ?? undefined,
      userName:  payload.userName  ?? session?.user?.name  ?? undefined,
      userRole:  payload.userRole  ?? session?.user?.role  ?? undefined,
    };

    // ── Auto-capture request context from middleware headers ───────────────
    const headersList = await headers();

    const ip =
      headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
      headersList.get("x-real-ip") ||
      "unknown";

    const sessionToken = headersList.get("x-session-token");
    const sessionId = sessionToken
      ? crypto.createHash("sha256").update(sessionToken).digest("hex").slice(0, 16)
      : undefined;

    await db.activityLog.create({
      data: {
        // Actor
        userEmail: actor.userEmail,
        userName:  actor.userName,
        userRole:  actor.userRole,

        // Action
        action:     payload.action,
        entity:     payload.entity,
        entityId:   payload.entityId,
        entitySlug: payload.entitySlug,

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

        // Request context — stamped by middleware
        ipAddress:     ip,
        userAgent:     headersList.get("user-agent")       ?? undefined,
        referer:       headersList.get("referer")          ?? undefined,
        requestPath:   headersList.get("x-request-path")   ?? undefined,
        requestMethod: headersList.get("x-request-method") ?? undefined,
        requestId:     headersList.get("x-request-id")     ?? crypto.randomUUID(),
        sessionId,
      },
    });
  } catch (err) {
    console.error("[createLog] Failed:", err);
  }
}