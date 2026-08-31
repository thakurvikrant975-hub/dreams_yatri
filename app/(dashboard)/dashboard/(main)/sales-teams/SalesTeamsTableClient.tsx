"use client";

import { useState } from "react";
import { Crown, Users, Settings2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { CreateSalesTeamDialog } from "./CreateSalesTeamDialog";
import { ManageSalesTeamDrawer } from "./ManageSalesTeamDrawer";
import type { SalesTeamOverview, EligibleMember } from "./actions";

interface Props {
  teams: SalesTeamOverview[];
  eligibleMembers: EligibleMember[];
}

export function SalesTeamsTableClient({ teams, eligibleMembers }: Props) {
  const [managingId, setManagingId] = useState<string | null>(null);
  const managingTeam = teams.find((t) => t.id === managingId) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <CreateSalesTeamDialog />
      </div>

      {teams.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-14 gap-2 text-center">
          <Users className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No sales teams yet</p>
          <p className="text-xs text-muted-foreground">Create a team to start assigning a leader and sales executives.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {teams.map((team) => (
            <div key={team.id} className="rounded-xl border bg-card p-4 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <p className="font-semibold text-sm truncate">{team.name}</p>
                <Button size="sm" variant="outline" onClick={() => setManagingId(team.id)}>
                  <Settings2 className="h-3.5 w-3.5" /> Manage
                </Button>
              </div>

              <div className="flex items-center gap-1.5 text-sm">
                <Crown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                {team.leader
                  ? <span className="truncate">{team.leader.name}</span>
                  : <span className="text-muted-foreground italic">No leader assigned</span>}
              </div>

              <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                <Users className="h-3.5 w-3.5 shrink-0" />
                {team.memberCount} member{team.memberCount !== 1 ? "s" : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <ManageSalesTeamDrawer
        key={managingId ?? "none"}
        team={managingTeam}
        eligibleMembers={eligibleMembers}
        open={managingId !== null}
        onOpenChange={(o) => { if (!o) setManagingId(null); }}
      />
    </div>
  );
}
