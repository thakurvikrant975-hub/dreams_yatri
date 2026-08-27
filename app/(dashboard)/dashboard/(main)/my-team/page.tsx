import type { Metadata } from "next";
import { Suspense } from "react";
import { UsersRound, Crown, IdCardLanyard, CalendarClock } from "lucide-react";
import {
  Breadcrumb, BreadcrumbItem, BreadcrumbLink,
  BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator,
} from "../components/ui/breadcrumb";
import { PageHeader } from "../components/dashboard/PageHeader";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { Skeleton } from "../components/ui/skeleton";
import { Badge } from "../components/ui/badge";
import { Avatar, AvatarImage, AvatarFallback, AvatarBadge } from "../components/ui/avatar";
import { getMyTeam, type MyTeamMember } from "./actions";

export const metadata: Metadata = {
  title: "My Team - Dashboard",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

function fmtDate(d: Date | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

function initials(name: string) {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
}

function MyTeamSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-7 w-12" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <Skeleton className="h-4 w-28" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberCard({ member, isLeader }: { member: MyTeamMember; isLeader: boolean }) {
  return (
    <div className="rounded-xl border bg-card p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar size="lg">
            <AvatarImage src={member.profilePicUrl ?? undefined} alt={member.name} />
            <AvatarFallback>{initials(member.name)}</AvatarFallback>
            {isLeader && (
              <AvatarBadge className="bg-amber-400 text-amber-950 ring-background">
                <Crown className="fill-current" />
              </AvatarBadge>
            )}
          </Avatar>
          <div className="min-w-0">
            <p className="font-semibold text-sm truncate">{member.name}</p>
            <p className="text-xs text-muted-foreground truncate">
              {member.designation || member.roleName || "—"}
            </p>
          </div>
        </div>
        <Badge variant={member.isActive ? "default" : "outline"} className="shrink-0">
          {member.isActive ? "Active" : "Inactive"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5 min-w-0">
          <IdCardLanyard className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{member.employeeId}</span>
        </div>
        <div className="flex items-center gap-1.5 min-w-0">
          <CalendarClock className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">Joined {fmtDate(member.joiningDate)}</span>
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {isLeader && (
          <Badge variant="secondary" className="gap-1">
            <Crown className="h-3 w-3" /> Team Leader
          </Badge>
        )}
        {member.roleName && <Badge variant="outline">{member.roleName}</Badge>}
      </div>
    </div>
  );
}

async function MyTeamData() {
  const team = await getMyTeam();

  if (!team) {
    return (
      <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-14 gap-2 text-center">
        <UsersRound className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm font-medium">You are not assigned to a team yet</p>
        <p className="text-xs text-muted-foreground">Your Sales Manager can add you to a team.</p>
      </div>
    );
  }

  const activeCount = team.members.filter((m) => m.isActive).length;

  return (
    <div className="space-y-6">
      <StatGrid cols={3}>
        <StatCard label="Team" value={team.name} icon={UsersRound} />
        <StatCard label="Members" value={team.members.length} icon={IdCardLanyard} />
        <StatCard label="Active" value={activeCount} icon={CalendarClock} />
      </StatGrid>

      <div className="flex items-center gap-1.5 text-sm">
        <Crown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        {team.leader
          ? <span>Led by <span className="font-medium">{team.leader.name}</span></span>
          : <span className="text-muted-foreground italic">No leader assigned</span>}
      </div>

      {team.members.length === 0 ? (
        <div className="rounded-xl border bg-card flex flex-col items-center justify-center py-14 gap-2 text-center">
          <UsersRound className="h-8 w-8 text-muted-foreground" />
          <p className="text-sm font-medium">No members yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...team.members]
            .sort((a, b) => (a.id === team.leader?.id ? -1 : b.id === team.leader?.id ? 1 : 0))
            .map((m) => (
              <MemberCard key={m.id} member={m} isLeader={m.id === team.leader?.id} />
            ))}
        </div>
      )}
    </div>
  );
}

export default function MyTeamPage() {
  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem><BreadcrumbLink href="/dashboard">Dashboard</BreadcrumbLink></BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem><BreadcrumbPage>My Team</BreadcrumbPage></BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <PageHeader
        title="My Team"
        description="Your sales team and its members"
        icon={UsersRound}
      />

      <Suspense fallback={<MyTeamSkeleton />}>
        <MyTeamData />
      </Suspense>
    </div>
  );
}
