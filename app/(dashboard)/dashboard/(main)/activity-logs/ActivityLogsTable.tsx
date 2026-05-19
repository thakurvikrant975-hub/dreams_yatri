"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ShieldAlert, AlertTriangle, CheckCircle2, XCircle, LogIn, CalendarHeart, Ban, CircleAlert, Skull, Logs } from "lucide-react";
import { Badge } from "../components/ui/badge";
import { format } from "date-fns";
import { Stats } from "../components/dashboard/Stats";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import type { PaginatedLogs, ActivityLogRow, LogStats } from "./actions";
import { StatGrid, StatCard } from "../components/dashboard/Statcard";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";

// ── Badge helpers ─────────────────────────────────────────────────────────────
function ActionBadge({ action }: { action: string }) {
  const map: Record<string, string> = {
    CREATE: "bg-blue-50 text-blue-700 border-blue-200",
    UPDATE: "bg-yellow-50 text-yellow-700 border-yellow-200",
    DELETE: "bg-red-50 text-red-700 border-red-200",
    LOGIN: "bg-green-50 text-green-700 border-green-200",
    LOGOUT: "bg-slate-50 text-slate-600 border-slate-200",
    LOGIN_FAILED: "bg-red-50 text-red-700 border-red-200",
    PERMISSION_CHANGE: "bg-purple-50 text-purple-700 border-purple-200",
  };
  return (
    <Badge className={`rounded-full px-2 py-0.5 text-xs font-medium border ${map[action] ?? "bg-slate-50 text-slate-600 border-slate-200"}`}>
      {action.replace("_", " ")}
    </Badge>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { cls: string; icon: React.ReactNode }> = {
    SUCCESS: { cls: "bg-green-50 text-green-800 border-green-200", icon: <CheckCircle2 className="h-3 w-3" /> },
    FAILED: { cls: "bg-red-50 text-red-800 border-red-200", icon: <XCircle className="h-3 w-3" /> },
    REJECTED: { cls: "bg-orange-50 text-orange-800 border-orange-200", icon: <AlertTriangle className="h-3 w-3" /> },
  };
  const s = map[status] ?? map.SUCCESS;
  return (
    <Badge className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium border ${s.cls}`}>
      {s.icon} {status}
    </Badge>
  );
}

function SeverityBadge({ severity, isSuspicious }: { severity: string; isSuspicious: boolean }) {
  const map: Record<string, string> = {
    LOW: "bg-slate-50 text-slate-600 border-slate-200",
    MEDIUM: "bg-yellow-50 text-yellow-700 border-yellow-200",
    HIGH: "bg-orange-50 text-orange-700 border-orange-200",
    CRITICAL: "bg-red-50 text-red-700 border-red-200",
  };
  return (
    <div className="flex items-center gap-1">
      <Badge className={`rounded-full px-2 py-0.5 text-xs font-medium border ${map[severity] ?? map.LOW}`}>
        {severity}
      </Badge>
      {isSuspicious && (
        <ShieldAlert className="h-3.5 w-3.5 text-red-500" />
      )}
    </div>
  );
}

// ── Props ─────────────────────────────────────────────────────────────────────
interface Props {
  paginated: PaginatedLogs;
  stats: LogStats;
  currentPage: number;
}

const ACTION_OPTIONS = [
  "CREATE", "UPDATE", "DELETE", "LOGIN", "LOGOUT",
  "LOGIN_FAILED", "PERMISSION_CHANGE", "EXPORT", "BULK_ACTION", "VIEW_SENSITIVE",
].map((a) => ({ label: a.replace("_", " "), value: a }));

const STATUS_OPTIONS = ["SUCCESS", "FAILED", "REJECTED", "PENDING"].map((s) => ({
  label: s, value: s,
}));

const SEVERITY_OPTIONS = ["LOW", "MEDIUM", "HIGH", "CRITICAL"].map((s) => ({
  label: s, value: s,
}));

// ── Component ─────────────────────────────────────────────────────────────────
export function ActivityLogsTable({ paginated, stats, currentPage }: Props) {
  const { logs, totalPages } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  const [search, setSearch] = useState("");
  const [actionFilter, setAction] = useState("all");
  const [statusFilter, setStatus] = useState("all");
  const [severityFilter, setSeverity] = useState("all");

  // Client-side filter within current page
  const filtered = useMemo(() => {
    return logs.filter((l) => {
      const matchSearch =
        l.userName?.toLowerCase().includes(search.toLowerCase()) ||
        l.userEmail?.toLowerCase().includes(search.toLowerCase()) ||
        l.entity?.toLowerCase().includes(search.toLowerCase()) ||
        l.ipAddress?.includes(search);
      const matchAction = actionFilter === "all" || l.action === actionFilter;
      const matchStatus = statusFilter === "all" || l.status === statusFilter;
      const matchSeverity = severityFilter === "all" || l.severity === severityFilter;
      return matchSearch && matchAction && matchStatus && matchSeverity;
    });
  }, [logs, search, actionFilter, statusFilter, severityFilter]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.replace(`?${params.toString()}`));
  };

  // ── Columns ──────────────────────────────────────────────────────────────
  const columns: ColumnDef<ActivityLogRow>[] = [
    {
      header: "Actor",
      width: "w-52",
      cell: (l) => (
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{l.userName ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate">{l.userEmail ?? "Guest"}</p>
          {l.userRole && (
            <p className="text-xs text-muted-foreground">{l.userRole}{l.userDesignation ? ` · ${l.userDesignation}` : ""}</p>
          )}
        </div>
      ),
    },
    {
      header: "Action",
      cell: (l) => <ActionBadge action={l.action} />,
    },
    {
      header: "Entity",
      cell: (l) => (
        <div>
          <p className="text-sm font-medium">{l.entity}</p>
          {l.entitySlug && <p className="text-xs text-muted-foreground truncate">{l.entitySlug}</p>}
        </div>
      ),
    },
    {
      header: "Status",
      cell: (l) => (
        <div className="space-y-1">
          <StatusBadge status={l.status} />
          {l.errorMessage && (
            <p className="text-xs text-red-500 truncate max-w-[140px]" title={l.errorMessage}>
              {l.errorMessage}
            </p>
          )}
        </div>
      ),
    },
    {
      header: "Severity",
      cell: (l) => <SeverityBadge severity={l.severity} isSuspicious={l.isSuspicious} />,
    },
    {
      header: "IP / Path",
      cell: (l) => (
        <div>
          <p className="text-xs font-mono text-muted-foreground">{l.ipAddress ?? "—"}</p>
          <p className="text-xs text-muted-foreground truncate max-w-[160px]">{l.requestPath ?? ""}</p>
        </div>
      ),
    },
    {
      header: "Time",
      cell: (l) => (
        <span className="text-xs text-muted-foreground whitespace-nowrap">
          {format(new Date(l.actionAt), "dd MMM yyyy, HH:mm:ss")}
        </span>
      ),
    },
  ];

  return ( 
    <div className="space-y-4">
      <StatGrid cols={5}>
        <StatCard
          label="Total Logs"
          value={stats.total}
          icon={Logs}
        />
        <StatCard
          label="Today"
          value={stats.today}
          icon={CalendarHeart}
        />
        <StatCard
          label="Failed"
          value={stats.failed}
          icon={Ban}
        />
        <StatCard
          label="Critical"
          value={stats.critical}
          icon={Skull}
        />
        <StatCard
          label="Suspicious"
          value={stats.suspicious}
          icon={CircleAlert}
        />
      </StatGrid>

      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, entity, IP..."
        filteredCount={filtered.length}
        totalCount={logs.length}
        filters={[
          { value: actionFilter, onChange: setAction, placeholder: "All Actions", options: ACTION_OPTIONS },
          { value: statusFilter, onChange: setStatus, placeholder: "All Statuses", options: STATUS_OPTIONS },
          { value: severityFilter, onChange: setSeverity, placeholder: "All Severities", options: SEVERITY_OPTIONS },
        ]}
      />

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(l) => l.id}
        emptyState={
          <TableEmptyState
            title={"No logs found"}
            description={"No logs. No traces. Like Heisenberg was never here. 🧪"}
          />
        }
        pagination={{
          currentPage,
          totalPages,
          onPageChange: goToPage,
        }}
      />
    </div>
  );
}