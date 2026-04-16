// TeamMembersTable.tsx
"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Search, MoreHorizontal, Trash2, Power, Mail, Pencil, ChevronLeft, ChevronRight } from "lucide-react";
import { Input } from "../components/ui/input";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { toast } from "sonner";
import { deleteTeamMember, toggleActive } from "./actions";
import type { PaginatedMembers, TeamMember } from "./actions";
import { format } from "date-fns";
import { EditTeamMemberDialog } from "./EditTeamMemberDialog";

type SelectOption = { id: string; name: string };

interface Props {
  paginated: PaginatedMembers;
  departments: SelectOption[];
  roles: SelectOption[];
  currentPage: number;
}

export function TeamMembersTable({ paginated, departments, roles, currentPage }: Props) {
  const { members, total, totalPages } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState<string>("all");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [isPending, startTransition] = useTransition();
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const filtered = useMemo(() => {
    return members.filter((m) => {
      const matchSearch =
        m.name.toLowerCase().includes(search.toLowerCase()) ||
        m.email.toLowerCase().includes(search.toLowerCase());
      const matchDept = deptFilter === "all" || m.department?.id === deptFilter;
      const matchRole = roleFilter === "all" || m.role?.id === roleFilter;
      return matchSearch && matchDept && matchRole;
    });
  }, [members, search, deptFilter, roleFilter]);

  const stats = useMemo(() => ({
    total,
    active: members.filter((m) => m.isActive).length,
    inactive: members.filter((m) => !m.isActive).length,
    departments: new Set(members.map((m) => m.department?.id).filter(Boolean)).size,
  }), [members, total]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteTeamMember(id);
      r.success ? toast.success("Member deleted") : toast.error(r.error);
    });
  };

  const handleToggle = (id: string) => {
    startTransition(async () => {
      const r = await toggleActive(id);
      r.success ? toast.success("Status updated") : toast.error(r.error);
    });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Total", value: total },
          { label: "Active (this page)", value: stats.active },
          { label: "Inactive (this page)", value: stats.inactive },
          { label: "Departments (this page)", value: stats.departments },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border bg-card p-4">
            <p className="text-xs text-muted-foreground">{s.label}</p>
            <p className="text-2xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email"
            className="pl-9"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All departments</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="h-9 rounded-md border bg-background px-3 text-sm"
        >
          <option value="all">All roles</option>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </div>

      {/* Table */}
      <div className="rounded-xl border bg-card overflow-hidden">
        <div className="bg-muted/50 px-4 py-3 grid grid-cols-7 gap-4 text-xs font-medium text-muted-foreground uppercase tracking-wide">
          <div>Member</div>
          <div>Department</div>
          <div>Role</div>
          <div>Joined</div>
          <div>Status</div>
          <div>Created</div>
          <div className="text-right">Actions</div>
        </div>

        {filtered.length === 0 ? (
          <div className="py-16 text-center text-sm text-muted-foreground">
            No team members found
          </div>
        ) : (
          filtered.map((m) => (
            <div key={m.id} className="px-4 py-3 grid grid-cols-7 gap-4 border-t items-center text-sm hover:bg-muted/30 transition-colors">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-8 w-8 rounded-full bg-primary/10 text-primary flex items-center justify-center text-xs font-semibold shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="font-medium truncate">{m.name}</p>
                  <p className="text-xs text-muted-foreground truncate flex items-center gap-1">
                    <Mail className="h-3 w-3 shrink-0" />
                    {m.email}
                  </p>
                </div>
              </div>
              <div className="text-muted-foreground truncate">{m.department?.name || "—"}</div>
              <div className="text-muted-foreground truncate">{m.role?.name || "—"}</div>
              <div className="text-muted-foreground text-xs">
                {m.joiningDate ? format(new Date(m.joiningDate), "dd MMM yyyy") : "—"}
              </div>
              <div>
                <Badge variant={m.isActive ? "default" : "secondary"}>
                  {m.isActive ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div className="text-muted-foreground text-xs">
                {format(new Date(m.createdAt), "dd MMM yyyy")}
              </div>
              <div className="flex justify-end">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => setEditingMember(m)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => handleToggle(m.id)}>
                      <Power className="h-4 w-4 mr-2" />
                      {m.isActive ? "Deactivate" : "Activate"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => handleDelete(m.id, m.name)}
                      className="text-destructive focus:text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <p className="text-muted-foreground">
            Page {currentPage} of {totalPages} · {total} total members
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(currentPage - 1)}
              disabled={currentPage <= 1}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter((p) => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "..." ? (
                  <span key={`ellipsis-${i}`} className="px-2 text-muted-foreground">…</span>
                ) : (
                  <Button
                    key={p}
                    variant={p === currentPage ? "default" : "outline"}
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => goToPage(p as number)}
                  >
                    {p}
                  </Button>
                )
              )}
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              onClick={() => goToPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Edit Dialog */}
      {editingMember && (
        <EditTeamMemberDialog
          member={editingMember}
          departments={departments}
          roles={roles}
          open={!!editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
    </div>
  );
}