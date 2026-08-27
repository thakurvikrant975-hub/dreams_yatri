"use client";

import { useState, useTransition } from "react";
import { Loader2, Trash2, Crown } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter,
} from "../components/ui/sheet";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Checkbox } from "../components/ui/checkbox";
import { Badge } from "../components/ui/badge";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "../components/ui/alert-dialog";
import { toast } from "sonner";
import type { SalesTeamOverview, EligibleMember } from "./actions";
import { renameSalesTeam, setTeamLeader, setTeamMembers, deleteSalesTeam } from "./actions";

interface Props {
  team: SalesTeamOverview | null;
  eligibleMembers: EligibleMember[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ManageSalesTeamDrawer({ team, eligibleMembers, open, onOpenChange }: Props) {
  const [name, setName] = useState(team?.name ?? "");
  const [leaderId, setLeaderId] = useState<string>(team?.leader?.id ?? "");
  const [memberIds, setMemberIds] = useState<string[]>(() => team?.members.map((m) => m.id) ?? []);
  const [isPending, startTransition] = useTransition();

  if (!team) return null;

  // The pool offered for adding is Sales Executives not already on another
  // team — a member already on this team stays visible regardless of role
  // (e.g. a promoted leader) so they remain manageable/removable here.
  const memberCandidates = eligibleMembers.filter((m) => {
    if (m.currentTeam?.id === team.id) return true;
    return (m.roleName ?? "").toLowerCase() === "sales executive" && !m.currentTeam;
  });

  // Same idea for the leader picker: only Team Leaders not already leading
  // (or on) another team — the current leader always stays visible here too,
  // otherwise picking a team whose leader doesn't meet these rules (set
  // before this filter existed) would blank the field out entirely.
  const leaderCandidates = eligibleMembers.filter((m) => {
    if (m.id === team.leader?.id) return true;
    const isTeamLeaderRole = (m.roleName ?? "").toLowerCase() === "team leader";
    const notAssignedElsewhere = !m.currentTeam || m.currentTeam.id === team.id;
    return isTeamLeaderRole && notAssignedElsewhere;
  });

  const toggleMember = (id: string) => {
    setMemberIds((cur) => cur.includes(id) ? cur.filter((m) => m !== id) : [...cur, id]);
  };

  const handleRename = () => {
    if (!team || name.trim() === team.name) return;
    startTransition(async () => {
      const result = await renameSalesTeam({ id: team.id, name: name.trim() });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Team renamed");
    });
  };

  const handleSetLeader = (newLeaderId: string) => {
    if (!team) return;
    const resolved = newLeaderId === "__none__" ? null : newLeaderId;
    startTransition(async () => {
      const result = await setTeamLeader({ teamId: team.id, leaderId: resolved });
      if (!result.success) { toast.error(result.error); return; }
      setLeaderId(resolved ?? "");
      if (resolved && !memberIds.includes(resolved)) setMemberIds((cur) => [...cur, resolved]);
      toast.success("Leader updated");
    });
  };

  const handleSaveMembers = () => {
    if (!team) return;
    startTransition(async () => {
      const result = await setTeamMembers({ teamId: team.id, memberIds });
      if (!result.success) { toast.error(result.error); return; }
      toast.success("Team members updated");
    });
  };

  const handleDelete = () => {
    if (!team) return;
    startTransition(async () => {
      const result = await deleteSalesTeam(team.id);
      if (!result.success) { toast.error(result.error); return; }
      toast.success(`Team "${team.name}" deleted`);
      onOpenChange(false);
    });
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex flex-col">
        <SheetHeader>
          <SheetTitle>Manage {team.name}</SheetTitle>
          <SheetDescription>Rename the team, set a leader, and choose members.</SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto px-4 space-y-6">
          {/* Rename */}
          <div className="grid gap-1.5">
            <Label>Team name / nickname</Label>
            <div className="flex gap-2">
              <Input value={name} onChange={(e) => setName(e.target.value)} />
              <Button variant="outline" onClick={handleRename} disabled={isPending || name.trim() === team.name}>
                Save
              </Button>
            </div>
          </div>

          {/* Leader */}
          <div className="grid gap-1.5">
            <Label className="flex items-center gap-1.5"><Crown className="h-3.5 w-3.5" /> Team leader</Label>
            <Select value={leaderId || "__none__"} onValueChange={handleSetLeader} disabled={isPending}>
              <SelectTrigger><SelectValue placeholder="No leader assigned" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">No leader</SelectItem>
                {leaderCandidates.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}{m.currentTeam && m.currentTeam.id !== team.id ? ` (on ${m.currentTeam.name})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs text-muted-foreground">
              The leader keeps their normal role and is automatically included as a team member.
            </p>
          </div>

          {/* Members */}
          <div className="grid gap-1.5">
            <div className="flex items-center justify-between">
              <Label>Members ({memberIds.length})</Label>
              <Button size="sm" variant="outline" onClick={handleSaveMembers} disabled={isPending}>
                {isPending && <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" />}
                Save members
              </Button>
            </div>
            <div className="rounded-lg border divide-y max-h-72 overflow-y-auto">
              {memberCandidates.map((m) => {
                const isLeader = m.id === leaderId;
                const onOtherTeam = m.currentTeam && m.currentTeam.id !== team.id;
                return (
                  <div key={m.id} className="flex items-center justify-between gap-2 px-3 py-2">
                    <Checkbox
                      checked={memberIds.includes(m.id)}
                      onChange={() => { if (!isLeader) toggleMember(m.id); }}
                      disabled={isLeader}
                      label={
                        <span className="flex items-center gap-1.5">
                          {m.name}
                          {isLeader && <Badge variant="secondary" className="text-[10px]">Leader</Badge>}
                          {m.roleName && <span className="text-xs text-muted-foreground">· {m.roleName}</span>}
                        </span>
                      }
                    />
                    {onOtherTeam && (
                      <span className="text-xs text-muted-foreground shrink-0">on {m.currentTeam!.name}</span>
                    )}
                  </div>
                );
              })}
              {memberCandidates.length === 0 && (
                <p className="px-3 py-4 text-sm text-muted-foreground text-center">No available Sales Executives found.</p>
              )}
            </div>
          </div>
        </div>

        <SheetFooter className="border-t">
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" className="text-destructive hover:text-destructive w-full" disabled={isPending}>
                <Trash2 className="h-4 w-4" /> Delete team
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete &ldquo;{team.name}&rdquo;?</AlertDialogTitle>
                <AlertDialogDescription>
                  Members will be released back to unassigned — they will not be deleted. This cannot be undone.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                  Delete
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
