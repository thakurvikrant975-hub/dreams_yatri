"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Loader2 } from "lucide-react";
import { cn } from "@/app/lib/utils";
import {
  getViewableMembers,
  startViewingAs,
  type ViewableMember,
} from "../../actions/view-as-actions";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";

interface ViewAsMemberPickerProps {
  open: boolean;
  onClose: () => void;
}

export function ViewAsMemberPicker({ open, onClose }: ViewAsMemberPickerProps) {
  const [members, setMembers] = useState<ViewableMember[]>([]);
  const [search, setSearch]   = useState("");
  const [loading, setLoading] = useState(false);
  const [isPending, start]    = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (!open) { setSearch(""); return; }
    setLoading(true);
    getViewableMembers().then((m) => { setMembers(m); setLoading(false); });
  }, [open]);

  function handleSelect(id: string) {
    start(async () => {
      await startViewingAs(id);
      onClose();
      router.push("/dashboard");
      router.refresh();
    });
  }

  const filtered = members.filter((m) => {
    const q = search.toLowerCase();
    return (
      m.name.toLowerCase().includes(q) ||
      m.email.toLowerCase().includes(q) ||
      (m.teamRole?.name ?? "").toLowerCase().includes(q) ||
      (m.department?.name ?? "").toLowerCase().includes(q)
    );
  });

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <DialogContent className="max-w-sm p-0 overflow-hidden rounded-2xl">
        <DialogHeader className="px-4 pt-4 pb-3 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-sm font-semibold">
            <Users className="h-4 w-4 text-muted-foreground" />
            View As — Select Member
          </DialogTitle>
        </DialogHeader>

        {/* Search */}
        <div className="px-3 pt-3 pb-2">
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 h-9">
            <Search className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <input
              autoFocus
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, role…"
              className="flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
            />
          </div>
        </div>

        {/* Member list */}
        <div className="px-3 pb-3 max-h-72 overflow-y-auto space-y-0.5">
          {loading ? (
            <div className="flex items-center justify-center py-8 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
              <span className="text-sm">Loading members…</span>
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center text-xs text-muted-foreground py-6">
              {search ? "No members match your search." : "No active members found."}
            </p>
          ) : (
            filtered.map((m) => (
              <button
                key={m.id}
                disabled={isPending}
                onClick={() => handleSelect(m.id)}
                className={cn(
                  "w-full flex items-center gap-3 px-2.5 py-2 rounded-lg text-left transition-colors",
                  "hover:bg-accent disabled:opacity-50 disabled:cursor-not-allowed",
                )}
              >
                {/* Avatar */}
                <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden ring-1 ring-border">
                  {m.profilePicUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={m.profilePicUrl} alt={m.name} className="h-full w-full object-cover" />
                  ) : (
                    <span className="text-xs font-semibold text-muted-foreground">
                      {m.name.slice(0, 2).toUpperCase()}
                    </span>
                  )}
                </div>
                {/* Info */}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium leading-tight truncate">{m.name}</p>
                  <p className="text-[11px] text-muted-foreground leading-tight truncate">
                    {[m.teamRole?.name, m.department?.name].filter(Boolean).join(" · ")}
                  </p>
                </div>
                {isPending && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground shrink-0" />}
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
