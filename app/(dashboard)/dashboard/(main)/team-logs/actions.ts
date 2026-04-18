"use server";

import { db } from "@/app/lib/db";
import type { LogAction, LogStatus, LogSeverity } from "@/app/generated/prisma";

const PAGE_SIZE = 15;

// ── Types ─────────────────────────────────────────────────────────────────────
export type ActivityLogRow = {
  id: string;
  userId: string | null;
  userName: string | null;
  userEmail: string | null;
  userRole: string | null;
  userDesignation: string | null;
  action: LogAction;
  entity: string;
  entityId: string | null;
  entitySlug: string | null;
  status: LogStatus;
  severity: LogSeverity;
  isSuspicious: boolean;
  flagReason: string | null;
  errorMessage: string | null;
  ipAddress: string | null;
  requestPath: string | null;
  requestMethod: string | null;
  userAgent: string | null;
  previousData: unknown;
  newData: unknown;
  actionAt: Date;
};

export type PaginatedLogs = {
  logs: ActivityLogRow[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type LogStats = {
  total: number;
  today: number;
  failed: number;
  critical: number;
  suspicious: number;
};

// ── Reads ─────────────────────────────────────────────────────────────────────
export async function getLogsPaginated(page = 1): Promise<PaginatedLogs> {
  const skip = (page - 1) * PAGE_SIZE;

  const [logs, total] = await db.$transaction([
    db.activityLog.findMany({
      skip,
      take: PAGE_SIZE,
      orderBy: { actionAt: "desc" },
    }),
    db.activityLog.count(),
  ]);

  return {
    logs: logs as ActivityLogRow[],
    total,
    page,
    pageSize: PAGE_SIZE,
    totalPages: Math.ceil(total / PAGE_SIZE),
  };
}

export async function getLogStats(): Promise<LogStats> {
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [total, today, failed, critical, suspicious] = await db.$transaction([
    db.activityLog.count(),
    db.activityLog.count({ where: { actionAt: { gte: todayStart } } }),
    db.activityLog.count({ where: { status: "FAILED" } }),
    db.activityLog.count({ where: { severity: "CRITICAL" } }),
    db.activityLog.count({ where: { isSuspicious: true } }),
  ]);

  return { total, today, failed, critical, suspicious };
}