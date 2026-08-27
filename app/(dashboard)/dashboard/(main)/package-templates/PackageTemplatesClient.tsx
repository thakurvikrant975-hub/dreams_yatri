"use client";

import { useState } from "react";
import Image from "next/image";
import { formatDistanceToNow } from "date-fns";
import { Check, ImageOff, MapPin, Calendar, Users, Lock, Settings2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { ManagePackageTemplateDrawer } from "./ManagePackageTemplateDrawer";
import type { PackageTemplateRow } from "./actions";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

const TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

export function PackageTemplatesClient({ rows }: { rows: PackageTemplateRow[] }) {
  const [tab, setTab] = useState<typeof TABS[number]>("PENDING");
  const [managingId, setManagingId] = useState<string | null>(null);
  const managing = rows.find((r) => r.id === managingId) ?? null;
  const filtered = tab === "ALL" ? rows : rows.filter((r) => r.status === tab);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors ${
              tab === t ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted-foreground hover:bg-muted"
            }`}
          >
            {t === "ALL" ? "All" : t.charAt(0) + t.slice(1).toLowerCase()}
            {" "}({t === "ALL" ? rows.length : rows.filter((r) => r.status === t).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-14 gap-2 text-center">
          <p className="text-sm font-medium">Nothing here</p>
          <p className="text-xs text-muted-foreground">Packages saved to the library from an approved package will show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((t) => (
            <div key={t.id} className="rounded-xl border bg-card overflow-hidden flex flex-col">
              <div className="relative h-36 w-full bg-muted flex items-center justify-center">
                {t.coverImage ? (
                  <Image src={t.coverImage} alt={t.title} fill className="object-cover" />
                ) : (
                  <ImageOff className="h-6 w-6 text-muted-foreground" />
                )}
                <Badge className={`absolute top-2 right-2 ${STATUS_STYLES[t.status]}`}>{t.status}</Badge>
              </div>

              <div className="p-4 space-y-2 flex-1 flex flex-col">
                <p className="text-sm font-semibold truncate">{t.title}</p>
                {t.description && <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>}

                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
                  <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> {t.totalDays}D/{t.totalNights}N</span>
                  {t.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {t.destination}</span>}
                  <span>{t.activityCount} activit{t.activityCount === 1 ? "y" : "ies"}</span>
                </div>
                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  {t.submittedByName}{t.submittedByTeamName ? ` · ${t.submittedByTeamName}` : ""} · {formatDistanceToNow(new Date(t.submittedAt), { addSuffix: true })}
                </p>

                {t.status === "REJECTED" && t.rejectionNote && (
                  <p className="text-xs text-red-700 dark:text-red-400">Rejected: &quot;{t.rejectionNote}&quot;</p>
                )}
                {t.status === "APPROVED" && (
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Approved by {t.approvedByName}</p>
                )}

                <div className="flex-1" />

                <div className="flex items-center justify-between gap-2 pt-1">
                  {t.canManage ? (
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setManagingId(t.id)}>
                      <Settings2 className="h-3.5 w-3.5" /> Manage
                    </Button>
                  ) : (
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <Lock className="h-3 w-3" /> View only
                    </p>
                  )}
                  {!t.canManage && (
                    <Button size="sm" variant="ghost" onClick={() => setManagingId(t.id)}>View</Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <ManagePackageTemplateDrawer
        key={managingId ?? "none"}
        template={managing}
        open={managingId !== null}
        onOpenChange={(o) => { if (!o) setManagingId(null); }}
      />
    </div>
  );
}
