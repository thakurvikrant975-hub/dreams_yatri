"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  MoreHorizontal, Trash2, Power, Pencil, Key,
  UsersRound, MonitorCheck, MonitorDot, Building2,
} from "lucide-react";
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
import { MemberDetailDrawer } from "./Memberdetaildrawer";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";
import { TableEmptyState } from "../components/dashboard/TableEmptyState";

type SelectOption = { id: string; name: string };

interface Props {
  paginated:   PaginatedMembers;
  totalStats:  { total: number; active: number; inactive: number; departments: number };
  departments: SelectOption[];
  roles:       SelectOption[];
  currentPage: number;
}

export function TeamMembersTable({ paginated, totalStats, departments, roles, currentPage }: Props) {
  const { members, totalPages } = paginated;
  const router       = useRouter();
  const searchParams = useSearchParams();

  const [search,     setSearch]     = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [drawerMember, setDrawerMember] = useState<TeamMember | null>(null);

  const filtered = useMemo(() => members.filter((m) => {
    const matchSearch = m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.employeeId.toLowerCase().includes(search.toLowerCase());
    const matchDept = deptFilter === "all" || m.department?.id === deptFilter;
    const matchRole = roleFilter === "all" || m.role?.id === roleFilter;
    return matchSearch && matchDept && matchRole;
  }), [members, search, deptFilter, roleFilter]);

  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    startTransition(() => router.replace(`?${params.toString()}`));
  };

  const handleDelete = (id: string, name: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteTeamMember(id);
      if (r.success) toast.success("Member deleted");
      else toast.error(r.error, { duration: 6000 });
    });
  };

  const handleToggle = (id: string, currentState: boolean, e: React.MouseEvent) => {
    e.stopPropagation();
    startTransition(async () => {
      const r = await toggleActive(id);
      if (r.success) toast.success(currentState ? "Member deactivated" : "Member activated");
      else toast.error(r.error, { duration: 6000 });
    });
  };

  const columns: ColumnDef<TeamMember>[] = [
    {
      header: "Member",
      width: "w-64",
      cell: (m) => (
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-9 w-9 rounded-full shrink-0 overflow-hidden flex items-center justify-center text-sm font-bold text-purple-100"
            style={{ background: m.profilePicUrl ? "none" : "linear-gradient(135deg,#7F77DD,#534AB7)" }}>
            {m.profilePicUrl
              ? <img src={m.profilePicUrl} alt={m.name} className="h-full w-full object-cover" />
              : m.name.charAt(0).toUpperCase()
            }
          </div>
          <div className="min-w-0">
            <p className="font-medium text-sm truncate">{m.name}</p>
            <p className="text-xs text-muted-foreground font-mono">{m.employeeId}</p>
          </div>
        </div>
      ),
    },
    {
      header: "Work Email",
      cell: (m) => <span className="text-xs text-muted-foreground truncate max-w-[160px] block">{m.email}</span>,
    },
    {
      header: "Department",
      cell: (m) => <span className="text-sm text-muted-foreground">{m.department?.name ?? "—"}</span>,
    },
    {
      header: "Designation",
      cell: (m) => <span className="text-sm text-muted-foreground">{m.designation ?? m.role?.name ?? "—"}</span>,
    },
    {
      header: "Mobile",
      cell: (m) => <span className="text-sm text-muted-foreground">{m.personalMobile ?? "—"}</span>,
    },
    {
      header: "Joined",
      cell: (m) => (
        <span className="text-xs text-muted-foreground">
          {m.joiningDate ? format(new Date(m.joiningDate), "dd MMM yyyy") : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (m) => (
        <Badge className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium border ${m.isActive ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
          <span className={`w-1.5 h-1.5 rounded-full ${m.isActive ? "bg-green-500" : "bg-red-500"}`} />
          {m.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (m) => (
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
            <Button variant="ghost" size="icon" className="h-8 w-8" disabled={isPending}>
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={(e) => { e.stopPropagation(); setDrawerMember(m); }}>
              <Pencil className="h-4 w-4 mr-2" /> Edit / View
            </DropdownMenuItem>
            <DropdownMenuItem onClick={(e) => handleToggle(m.id, m.isActive, e)}>
              <Power className="h-4 w-4 mr-2" /> {m.isActive ? "Deactivate" : "Activate"}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={(e) => handleDelete(m.id, m.name, e)}
              className="text-destructive focus:text-destructive">
              <Trash2 className="h-4 w-4 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard label="Total Members"    value={totalStats.total}       icon={UsersRound}    />
        <StatCard label="Active Members"   value={totalStats.active}      icon={MonitorCheck}  />
        <StatCard label="Inactive Members" value={totalStats.inactive}    icon={MonitorDot}    />
        <StatCard label="Departments"      value={totalStats.departments} icon={Building2}     />
      </StatGrid>

      <TableFilters
        search={search} onSearchChange={setSearch}
        searchPlaceholder="Search by name, email, or employee ID…"
        filteredCount={filtered.length} totalCount={members.length}
        filters={[
          { value: deptFilter, onChange: setDeptFilter, placeholder: "All Departments", options: departments.map((d) => ({ label: d.name, value: d.id })) },
          { value: roleFilter, onChange: setRoleFilter, placeholder: "All Roles",       options: roles.map((r) => ({ label: r.name, value: r.id })) },
        ]}
      />

      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(m) => m.id}
        onRowClick={(m) => setDrawerMember(m)}
        emptyState={<TableEmptyState title="No team members found" description="Try adjusting your filters" />}
        pagination={{ currentPage, totalPages, onPageChange: goToPage }}
      />

      {drawerMember && (
        <MemberDetailDrawer
          member={drawerMember}
          departments={departments}
          roles={roles}
          open={!!drawerMember}
          onClose={() => setDrawerMember(null)}
        />
      )}
    </div>
  );
}