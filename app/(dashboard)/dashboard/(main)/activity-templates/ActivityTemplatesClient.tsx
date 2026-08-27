"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";
import {
  Check, Ban, Pencil, ImageOff, Calendar, MapPin, Users, Lock,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Textarea } from "../components/ui/textarea";
import { Input } from "../components/ui/input";
import { Badge } from "../components/ui/badge";
import {
  approveActivityTemplate, rejectActivityTemplate, updateActivityTemplate,
  type ActivityTemplateRow,
} from "./actions";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
  APPROVED: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
  REJECTED: "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300",
};

const TABS = ["PENDING", "APPROVED", "REJECTED", "ALL"] as const;

function ActivityCard({ activity }: { activity: ActivityTemplateRow }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [title, setTitle] = useState(activity.title);
  const [description, setDescription] = useState(activity.description ?? "");
  const [reason, setReason] = useState("");

  function approve() {
    startTransition(async () => {
      const result = await approveActivityTemplate(activity.id);
      if (result.success) { toast.success(`"${activity.title}" approved`); router.refresh(); }
      else toast.error(result.error ?? "Failed to approve");
    });
  }

  function reject() {
    if (!reason.trim()) { toast.error("A reason is required"); return; }
    startTransition(async () => {
      const result = await rejectActivityTemplate(activity.id, reason);
      if (result.success) { toast.success("Rejected"); setRejecting(false); setReason(""); router.refresh(); }
      else toast.error(result.error ?? "Failed to reject");
    });
  }

  function save() {
    startTransition(async () => {
      const result = await updateActivityTemplate(activity.id, { title, description });
      if (result.success) { toast.success("Saved"); setEditing(false); router.refresh(); }
      else toast.error(result.error ?? "Failed to save");
    });
  }

  return (
    <div className="rounded-xl border bg-card overflow-hidden flex flex-col">
      <div className="relative h-36 w-full bg-muted flex items-center justify-center">
        {activity.photo ? (
          <Image src={activity.photo} alt={activity.title} fill className="object-cover" />
        ) : (
          <ImageOff className="h-6 w-6 text-muted-foreground" />
        )}
        <Badge className={`absolute top-2 right-2 ${STATUS_STYLES[activity.status]}`}>{activity.status}</Badge>
      </div>

      <div className="p-4 space-y-2.5 flex-1 flex flex-col">
        {editing ? (
          <div className="space-y-2">
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Title" />
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="text-sm resize-none" placeholder="Description" />
            <div className="flex gap-2">
              <Button size="sm" className="h-8 text-xs" disabled={isPending || !title.trim()} onClick={save}>Save</Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setEditing(false); setTitle(activity.title); setDescription(activity.description ?? ""); }}>Cancel</Button>
            </div>
          </div>
        ) : (
          <>
            <p className="text-sm font-semibold truncate">{activity.title}</p>
            {activity.description && <p className="text-xs text-muted-foreground line-clamp-2">{activity.description}</p>}
          </>
        )}

        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground pt-1">
          <span className="flex items-center gap-1"><Calendar className="h-3 w-3" /> Day {activity.day}</span>
          {activity.destination && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {activity.destination}</span>}
        </div>
        <p className="text-[11px] text-muted-foreground truncate">
          From &ldquo;{activity.packageTemplateTitle}&rdquo;
        </p>
        <p className="text-[11px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {activity.submittedByName}{activity.submittedByTeamName ? ` · ${activity.submittedByTeamName}` : ""} · {formatDistanceToNow(new Date(activity.submittedAt), { addSuffix: true })}
          </span>
        </p>

        {activity.status === "REJECTED" && activity.rejectionNote && (
          <p className="text-xs text-red-700 dark:text-red-400">Rejected by {activity.rejectedByName}: &quot;{activity.rejectionNote}&quot;</p>
        )}
        {activity.status === "APPROVED" && (
          <p className="text-xs text-emerald-700 dark:text-emerald-400 flex items-center gap-1"><Check className="h-3 w-3" /> Approved by {activity.approvedByName}</p>
        )}

        <div className="flex-1" />

        {activity.canManage ? (
          !editing && !rejecting && (
            <div className="flex items-center gap-2 pt-1">
              <Button size="sm" variant="outline" className="h-8 text-xs gap-1" onClick={() => setEditing(true)}>
                <Pencil className="h-3.5 w-3.5" /> Edit
              </Button>
              {activity.status !== "REJECTED" && (
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800" disabled={isPending} onClick={() => setRejecting(true)}>
                  <Ban className="h-3.5 w-3.5" /> Reject
                </Button>
              )}
              {activity.status !== "APPROVED" && (
                <Button size="sm" className="h-8 text-xs gap-1" disabled={isPending} onClick={approve}>
                  <Check className="h-3.5 w-3.5" /> Approve
                </Button>
              )}
            </div>
          )
        ) : (
          <p className="flex items-center gap-1 text-xs text-muted-foreground pt-1">
            <Lock className="h-3 w-3" /> View only — a different team&apos;s submission
          </p>
        )}

        {rejecting && (
          <div className="rounded-lg border border-red-300 bg-red-50 dark:bg-red-950/20 p-2.5 space-y-2">
            <Textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this being rejected?" rows={2} className="text-sm resize-none bg-white dark:bg-transparent" autoFocus />
            <div className="flex items-center gap-2">
              <Button size="sm" className="h-8 text-xs bg-red-600 hover:bg-red-700 text-white" disabled={isPending || !reason.trim()} onClick={reject}>
                {isPending ? "Rejecting…" : "Confirm Reject"}
              </Button>
              <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={() => { setRejecting(false); setReason(""); }}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function ActivityTemplatesClient({ rows }: { rows: ActivityTemplateRow[] }) {
  const [tab, setTab] = useState<typeof TABS[number]>("PENDING");
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
          <p className="text-xs text-muted-foreground">Activities saved to the library from an approved package will show up here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((a) => <ActivityCard key={a.id} activity={a} />)}
        </div>
      )}
    </div>
  );
}
