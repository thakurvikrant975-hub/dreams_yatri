"use client";

import { useState, useCallback } from "react";
import { toast } from "sonner";
import { SearchSelect, type Option } from "../../components/dashboard/SearchSelect";
import {
  searchPoliciesByType,
  setPackagePolicy,
  removePackagePolicy,
} from "@/app/actions/packages/policies.actions";
import {
  POLICY_TYPE_LABELS,
  POLICY_TYPE_COLORS,
  POLICY_TYPES,
  type PolicyType,
} from "../../policies/constants";
import { XCircle, CalendarX, RefreshCcw, FileText, ExternalLink, Loader2, CheckCircle2 } from "lucide-react";
import { cn } from "@/app/lib/utils";

// ── Types ──────────────────────────────────────────────────────────────────

type LinkedPolicy = { id: number; title: string } | null;

type Props = {
  packageId: number;
  initialPolicies: Record<PolicyType, LinkedPolicy>;
};

// ── Icon map ───────────────────────────────────────────────────────────────

const TYPE_ICONS: Record<PolicyType, React.ElementType> = {
  CANCELLATION:         XCircle,
  DATE_CHANGE:          CalendarX,
  REFUND:               RefreshCcw,
  TERMS_AND_CONDITIONS: FileText,
};

// ── Single policy row ──────────────────────────────────────────────────────

function PolicyRow({
  type,
  packageId,
  initial,
}: {
  type: PolicyType;
  packageId: number;
  initial: LinkedPolicy;
}) {
  const [selected, setSelected] = useState<LinkedPolicy>(initial);
  const [saving, setSaving] = useState(false);

  const Icon = TYPE_ICONS[type];
  const label = POLICY_TYPE_LABELS[type];
  const colorClass = POLICY_TYPE_COLORS[type];

  const fetchOptions = useCallback(
    async (query: string): Promise<Option[]> => {
      const res = await searchPoliciesByType(type, query);
      if (!res.success) return [];
      return res.data.map((p) => ({
        id: p.id,
        label: p.title,
        description: p.points[0] ?? undefined,
      }));
    },
    [type],
  );

  async function handleChange(policyId: number | null) {
    setSaving(true);
    if (policyId === null) {
      const res = await removePackagePolicy(packageId, type);
      setSaving(false);
      if (!res.success) { toast.error(res.message); return; }
      setSelected(null);
      toast.success(`${label} removed`);
    } else {
      const res = await setPackagePolicy(packageId, type, policyId);
      setSaving(false);
      if (!res.success) { toast.error(res.message); return; }
      // We don't have the title here yet — SearchSelect will show it via selectedLabel internal state
      // Refresh selected from search to get title
      const search = await searchPoliciesByType(type, "");
      const found = search.data.find((p) => p.id === policyId);
      setSelected(found ? { id: found.id, title: found.title } : { id: policyId, title: "Policy" });
      toast.success(`${label} assigned`);
    }
  }

  return (
    <div className="rounded-xl border border-dashboard-base-content/30 bg-background p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className={cn("flex items-center justify-center h-8 w-8 rounded-lg border", colorClass)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-sm font-semibold">{label}</p>
            {selected ? (
              <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                <CheckCircle2 className="h-2.5 w-2.5 text-green-500" />
                Assigned
              </p>
            ) : (
              <p className="text-[10px] text-muted-foreground/60 mt-0.5">Not assigned</p>
            )}
          </div>
        </div>
        <a
          href="/dashboard/policies"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-primary transition-colors shrink-0"
        >
          Manage policies
          <ExternalLink className="h-2.5 w-2.5" />
        </a>
      </div>

      {/* SearchSelect */}
      <div className="relative">
        <SearchSelect
          value={selected?.id ?? null}
          onChange={(val, opt) => {
            if (val !== null && opt) {
              setSelected({ id: val, title: opt.label });
            }
            handleChange(val);
          }}
          fetchOptions={fetchOptions}
          placeholder={`Search ${label.toLowerCase()}…`}
          initialLabel={selected?.title ?? ""}
          disabled={saving}
        />
        {saving && (
          <div className="absolute right-9 top-1/2 -translate-y-1/2 pointer-events-none">
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main tab ───────────────────────────────────────────────────────────────

export function PoliciesTab({ packageId, initialPolicies }: Props) {
  return (
    <div className="space-y-4 bg-dashboard-base-100 p-8 rounded-xl shadow-lg border border-dashboard-base-content/20">
      <div>
        <h3 className="text-sm font-semibold">Package Policies</h3>
        <p className="text-xs text-muted-foreground mt-0.5">
          Link one policy of each type to this package. Policies are managed on the{" "}
          <a
            href="/dashboard/policies"
            target="_blank"
            rel="noopener noreferrer"
            className="underline underline-offset-2 hover:text-foreground transition-colors"
          >
            Policies page
          </a>
          .
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {POLICY_TYPES.map((type) => (
          <PolicyRow
            key={type}
            type={type}
            packageId={packageId}
            initial={initialPolicies[type]}
          />
        ))}
      </div>
    </div>
  );
}
