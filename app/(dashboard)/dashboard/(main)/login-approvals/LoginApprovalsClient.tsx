"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Check, X } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";
import { approveLoginRequest, denyLoginRequest, type PendingLoginApproval } from "./actions";

const REASON_LABELS: Record<PendingLoginApproval["reason"], string> = {
  LATE_LOGIN: "Late login (past 10:05 AM)",
  AUTO_LOGOUT: "Re-login after inactivity auto-logout",
};

export function LoginApprovalsClient({ initialRequests }: { initialRequests: PendingLoginApproval[] }) {
  const [requests, setRequests] = useState(initialRequests);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleDecision(id: string, action: "approve" | "deny") {
    setPendingId(id);
    startTransition(async () => {
      const result = action === "approve" ? await approveLoginRequest(id) : await denyLoginRequest(id);
      if (result.success) {
        toast.success(result.message);
        setRequests((prev) => prev.filter((r) => r.id !== id));
      } else {
        toast.error(result.message);
      }
      setPendingId(null);
    });
  }

  if (requests.length === 0) {
    return (
      <TableEmptyState
        title="No pending requests"
        description="Late-login and re-login-after-auto-logout requests will show up here."
      />
    );
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <div
          key={r.id}
          className="flex items-center justify-between gap-4 rounded-xl border bg-dashboard-base-100 px-4 py-3"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold">{r.memberName}</p>
              {r.roleName && <Badge variant="outline" className="text-[11px]">{r.roleName}</Badge>}
            </div>
            <p className="text-xs text-dashboard-base-content/60">
              {REASON_LABELS[r.reason]} — requested {new Date(r.requestedAt).toLocaleString("en-IN")}
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <Button
              size="sm" variant="outline"
              className="gap-1.5 text-dashboard-error border-dashboard-error/30 hover:bg-dashboard-error/10"
              disabled={isPending && pendingId === r.id}
              onClick={() => handleDecision(r.id, "deny")}
            >
              <X className="h-3.5 w-3.5" /> Deny
            </Button>
            <Button
              size="sm"
              className="gap-1.5 bg-dashboard-primary"
              disabled={isPending && pendingId === r.id}
              onClick={() => handleDecision(r.id, "approve")}
            >
              <Check className="h-3.5 w-3.5" /> Approve
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}
