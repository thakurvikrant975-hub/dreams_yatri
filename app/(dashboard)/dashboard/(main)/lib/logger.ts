import { db } from "@/app/lib/db";
import { headers } from "next/headers";
import crypto from "crypto";
import type { LogAction, LogStatus, LogSeverity } from "@/app/generated/prisma";

export type LogPayload = {
  // Actor — who did it
  userId?:          string;
  userEmail?:       string;
  userName?:        string;
  userRole?:        string;
  userDesignation?: string;

  // What happened
  action:      LogAction;
  entity:      string;       // "Hotel" | "Package" | "TeamMember" | "Booking" etc.
  entityId?:   string;
  entitySlug?: string;

  // Data diff
  previousData?: object;
  newData?:      object;
  metadata?:     object;

  // Outcome
  status?:       LogStatus;   // defaults to SUCCESS
  errorMessage?: string;
  statusCode?:   number;

  // Risk
  severity?:     LogSeverity; // defaults to LOW
  isSuspicious?: boolean;
  flagReason?:   string;
};

export async function createLog(payload: LogPayload): Promise<void> {
  try {
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
        userId:          payload.userId,
        userEmail:       payload.userEmail,
        userName:        payload.userName,
        userRole:        payload.userRole,
        userDesignation: payload.userDesignation,

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
        severity:    payload.severity    ?? "LOW",
        isSuspicious: payload.isSuspicious ?? false,
        flagReason:  payload.flagReason,

        // Request context — auto-captured from middleware headers
        ipAddress:     ip,
        userAgent:     headersList.get("user-agent")     ?? undefined,
        referer:       headersList.get("referer")        ?? undefined,
        requestPath:   headersList.get("x-request-path") ?? undefined,
        requestMethod: headersList.get("x-request-method") ?? undefined,
        requestId:     headersList.get("x-request-id")  ?? crypto.randomUUID(),
        sessionId,
      },
    });
  } catch (err) {
    // Logging must NEVER crash the main flow
    console.error("[createLog] Failed to write activity log:", err);
  }
}