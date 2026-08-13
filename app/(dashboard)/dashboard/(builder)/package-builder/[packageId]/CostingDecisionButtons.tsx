"use client";

// ─────────────────────────────────────────────────────────────────────────────
// Approve / Reject, in the editor's header.
//
// Costing's two outcomes sit where the exec's PDF controls do, because those
// are not costing's job — the exec sends the document once it is approved. The
// decision belongs where the reviewer's eye already is, not behind a tab.
//
// Approve refuses while blocking findings are open. That is the point of the
// severity split: a reviewer who has said "this must be fixed" and then
// approves anyway has left the exec two contradictory instructions.
// ─────────────────────────────────────────────────────────────────────────────

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { Button } from "@/app/(dashboard)/dashboard/(main)/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger,
} from "@/app/(dashboard)/dashboard/(main)/components/ui/dialog";
import { Textarea } from "@/app/(dashboard)/dashboard/(main)/components/ui/textarea";
import {
  approveCustomPackage, rejectCustomPackage,
} from "@/app/(dashboard)/dashboard/(main)/verify-packages/actions";
import { getRejectionReasons } from "@/app/(dashboard)/dashboard/(main)/(marketing)/queries/actions";
import { countOpenFindings, getRevisionHistory, type RevisionEntry } from "../review-notes.actions";
import { RevisionHistoryDialog } from "@/app/(dashboard)/dashboard/(main)/verify-packages/[id]/RevisionHistoryDialog";

export function CostingDecisionButtons({ packageId }: { packageId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [reasons, setReasons] = useState<{ id: string; label: string }[]>([]);
  const [reasonId, setReasonId] = useState("");
  const [note, setNote] = useState("");
  const [blocking, setBlocking] = useState(0);
  const [revisions, setRevisions] = useState<RevisionEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      getRejectionReasons(),
      countOpenFindings(packageId),
      getRevisionHistory(packageId),
    ]).then(([r, c, revs]) => {
      if (cancelled) return;
      setReasons(r);
      setBlocking(c.errors);
      setRevisions(revs);
    });
    return () => { cancelled = true; };
  }, [packageId]);

  function approve() {
    if (blocking > 0) {
      toast.error(
        `${blocking} must-fix ${blocking === 1 ? "finding is" : "findings are"} still open`,
        { description: "Clear them on the sections they're pinned to, or reject the package instead." },
      );
      return;
    }
    startTransition(async () => {
      const r = await approveCustomPackage(packageId);
      if (r.success) { toast.success(r.message); router.refresh(); }
      else toast.error(r.message);
    });
  }

  function reject() {
    if (!reasonId) { toast.error("Pick a reason."); return; }
    const fd = new FormData();
    fd.set("rejectionReasonId", reasonId);
    // The open findings already say what is wrong element by element; this note
    // is the covering summary, so it is optional rather than a second place to
    // repeat them.
    if (note.trim()) fd.set("rejectionNote", note.trim());
    startTransition(async () => {
      const r = await rejectCustomPackage(packageId, fd);
      if (r.success) { toast.success(r.message); setOpen(false); router.refresh(); }
      else toast.error(r.message);
    });
  }

  return (
    <div className="flex items-center gap-2">
      {/* Before the decision, not after it: whether this package has been sent
          back before changes how the rest of the screen should be read, so it
          sits where a reviewer meets it first. Renders nothing on a first
          pass. */}
      <RevisionHistoryDialog entries={revisions} variant="header" />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button size="sm" variant="outline" className="h-8 gap-1.5 text-rose-600 border-rose-200 hover:bg-rose-50">
            <XCircle className="size-3.5" /> Reject
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Send this back</DialogTitle>
            <DialogDescription>
              {blocking > 0
                ? `${blocking} must-fix ${blocking === 1 ? "finding is" : "findings are"} already pinned to sections — the exec will see them in place.`
                : "Nothing is flagged on individual sections yet. Consider pinning findings to the elements that are wrong, so the exec knows where to look."}
            </DialogDescription>
          </DialogHeader>
          <select
            value={reasonId}
            onChange={(e) => setReasonId(e.target.value)}
            className="h-9 rounded-md border border-neutral-200 px-2 text-sm"
          >
            <option value="">Choose a reason…</option>
            {reasons.map((r) => <option key={r.id} value={r.id}>{r.label}</option>)}
          </select>
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={3}
            placeholder="Anything to add beyond the flagged sections (optional)"
            className="text-sm"
          />
          <Button onClick={reject} disabled={isPending} className="bg-rose-600 hover:bg-rose-700">
            {isPending ? <Loader2 className="size-4 animate-spin" /> : "Reject and send back"}
          </Button>
        </DialogContent>
      </Dialog>

      <Button
        size="sm"
        onClick={approve}
        disabled={isPending}
        title={blocking > 0 ? `${blocking} must-fix findings still open` : undefined}
        className="h-8 gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white disabled:opacity-60"
      >
        {isPending ? <Loader2 className="size-3.5 animate-spin" /> : <CheckCircle2 className="size-3.5" />}
        Approve
      </Button>
    </div>
  );
}
