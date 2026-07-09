"use client";

import { useState, useTransition } from "react";
import { Users, Building2, Loader2 } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger,
} from "../../components/ui/sheet";
import { Avatar, AvatarFallback } from "../../components/ui/avatar";
import { cn } from "@/app/lib/utils";
import { getHotelTeamBreakdown, type HotelTeamMemberStat } from "../actions";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function HotelTeamSheet({ totalHotels }: { totalHotels: number }) {
  const [open, setOpen] = useState(false);
  const [data, setData] = useState<HotelTeamMemberStat[] | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleOpen(o: boolean) {
    setOpen(o);
    if (o && !data) {
      startTransition(async () => {
        setData(await getHotelTeamBreakdown());
      });
    }
  }

  const contributors = data?.filter((m) => m.hotelCount > 0) ?? [];
  const maxCount = contributors[0]?.hotelCount ?? 0;

  return (
    <Sheet open={open} onOpenChange={handleOpen}>
      <SheetTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
        >
          <Users className="h-3.5 w-3.5" />
          Team
        </button>
      </SheetTrigger>

      <SheetContent side="right" className="w-full sm:max-w-md flex flex-col gap-0 p-0">
        <SheetHeader className="shrink-0 border-b border-border px-6 py-4 gap-1">
          <SheetTitle className="flex items-center gap-2 text-base">
            <Users className="h-4 w-4 text-muted-foreground" />
            Team Contributions
          </SheetTitle>
          <p className="text-xs text-muted-foreground">
            {totalHotels} hotel{totalHotels !== 1 ? "s" : ""} across {data?.length ?? "…"} team member{(data?.length ?? 0) !== 1 ? "s" : ""}
          </p>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {isPending || !data ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
              <Loader2 className="h-6 w-6 animate-spin" />
              <p className="text-sm">Loading team data…</p>
            </div>
          ) : (
            <div className="space-y-1.5">
              {data.map((m) => {
                const hasContributed = m.hotelCount > 0;
                const barWidth = maxCount > 0 ? Math.max(6, (m.hotelCount / maxCount) * 100) : 0;
                return (
                  <div
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-2.5 py-2 transition-colors",
                      hasContributed ? "bg-muted/30" : "opacity-60",
                    )}
                  >
                    <Avatar className="h-8 w-8 shrink-0">
                      <AvatarFallback className={cn(
                        "text-xs font-semibold",
                        hasContributed ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground",
                      )}>
                        {initials(m.name)}
                      </AvatarFallback>
                    </Avatar>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-medium truncate">{m.name}</p>
                        <span className={cn(
                          "shrink-0 text-xs font-semibold tabular-nums",
                          hasContributed ? "text-foreground" : "text-muted-foreground/60",
                        )}>
                          {m.hotelCount}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate">
                        {m.role}
                        {m.lastAddedAt && (
                          <> · last added {formatDistanceToNow(new Date(m.lastAddedAt), { addSuffix: true })}</>
                        )}
                        {!hasContributed && " · no hotels added yet"}
                      </p>
                      {hasContributed && (
                        <div className="h-1 rounded-full bg-muted mt-1.5 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-primary/60"
                            style={{ width: `${barWidth}%` }}
                          />
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {data.length === 0 && (
                <div className="flex flex-col items-center justify-center py-16 gap-3 text-muted-foreground">
                  <Building2 className="h-8 w-8 opacity-30" />
                  <p className="text-sm">No active team members found</p>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
