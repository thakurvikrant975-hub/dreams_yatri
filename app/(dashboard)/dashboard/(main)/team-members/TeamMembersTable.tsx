"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Users, MoreHorizontal, Trash2, Power, Pencil, Mail, Clipboard, Key, UsersRound, MonitorCheck, MonitorDot, Building, Building2 } from "lucide-react";
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

// ── Shared components ─────────────────────────────────────────────────────────
import { Stats } from "../components/dashboard/Stats";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";
// ── Password Dialog ───────────────────────────────────────────────────────────
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Copy, Check, RefreshCw, Eye, EyeOff } from "lucide-react";
import { resetMemberPassword, updateMemberPassword } from "./actions";
import { StatCard, StatGrid } from "../components/dashboard/Statcard";



type SelectOption = { id: string; name: string };

interface Props {
  paginated: PaginatedMembers;
  // total counts across ALL pages for stats (pass from page.tsx)
  totalStats: { total: number; active: number; inactive: number; departments: number };
  departments: SelectOption[];
  roles: SelectOption[];
  currentPage: number;
}
function PasswordDialog({
  open,
  onClose,
  memberId,
  memberName,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
}) {
  const [newPassword, setNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [isUpdating, startUpdate] = useTransition();

  const handleUpdate = () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    startUpdate(async () => {
      const r = await updateMemberPassword(memberId, newPassword);
      if (r.success) {
        setNewPassword("");
        toast.success("Password updated successfully");
        onClose();
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[400px]">
        <DialogHeader>
          <DialogTitle>Update Password — {memberName}</DialogTitle>
          <DialogDescription>
            Set a new password for this team member.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-2 py-2">
          <Label>New Password</Label>
          <div className="relative">
            <Input
              type={showNewPassword ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 8 characters"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowNewPassword(!showNewPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button
            onClick={handleUpdate}
            disabled={isUpdating || newPassword.length < 8}
          >
            {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin mr-2" /> : null}
            Update Password
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}


export function TeamMembersTable({
  paginated,
  totalStats,
  departments,
  roles,
  currentPage,
}: Props) {
  const { members, totalPages } = paginated;
  const router = useRouter();
  const searchParams = useSearchParams();

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [isPending, startTransition] = useTransition();
  const [editingMember, setEditingMember] = useState<TeamMember | null>(null);

  const [passwordDialog, setPasswordDialog] = useState<{
    open: boolean;
    memberId: string;
    memberName: string;
  } | null>(null);


  // ── Client-side filter (within current page) ──────────────────────────────
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

  // ── Handlers ──────────────────────────────────────────────────────────────
  const goToPage = (p: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", String(p));
    router.push(`?${params.toString()}`);
  };

  const handlePasswordDialog = (id: string, name: string) => {
    setPasswordDialog({ open: true, memberId: id, memberName: name, });
  };


  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete ${name}? This cannot be undone.`)) return;
    startTransition(async () => {
      const r = await deleteTeamMember(id);
      if (r.success) {
        toast.success("Member deleted successfully");
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  };

  const handleToggle = (id: string, currentState: boolean) => {
    startTransition(async () => {
      const r = await toggleActive(id);
      if (r.success) {
        toast.success(currentState ? "Member deactivated" : "Member activated");
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  };

  // ── Column definitions ────────────────────────────────────────────────────
  const columns: ColumnDef<TeamMember>[] = [
    {
      header: "Member",
      width: "w-64",
      cell: (m) => (
        <div className="flex items-center gap-2 min-w-0">
          <div className="h-[34px] w-[34px] rounded-full shrink-0 flex items-center justify-center text-[13px] font-semibold text-purple-100"
            style={{ background: "linear-gradient(135deg, #7F77DD, #534AB7)" }}>
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
      ),
    },
    {
      header: "Department",
      cell: (m) => (
        <span className="text-muted-foreground">{m.department?.name ?? "—"}</span>
      ),
    },
    {
      header: "Role",
      cell: (m) => (
        <span className="text-muted-foreground">{m.role?.name ?? "—"}</span>
      ),
    },
    {
      header: "Joined",
      cell: (m) => (
        <span className="text-muted-foreground text-xs">
          {m.joiningDate ? format(new Date(m.joiningDate), "dd MMM yyyy") : "—"}
        </span>
      ),
    },
    {
      header: "Status",
      cell: (m) => (
        <Badge className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-medium border ${m.isActive
            ? "bg-green-50 text-green-800 border-green-200"
            : "bg-red-50 text-red-800 border-red-200"
          }`}>
          <span className={`w-2 h-2 rounded-full ${m.isActive ? "bg-green-600" : "bg-red-500"}`} />
          {m.isActive ? "Active" : "Inactive"}
        </Badge>
      ),
    },
    {
      header: "Created",
      cell: (m) => (
        <span className="text-muted-foreground text-xs">
          {format(new Date(m.createdAt), "dd MMM yyyy")}
        </span>
      ),
    },
    {
      header: "Actions",
      align: "right",
      cell: (m) => (
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

            <DropdownMenuItem onClick={() => handlePasswordDialog(m.id, m.name)}>
              <Clipboard className="h-4 w-4 mr-2" />
              Password
            </DropdownMenuItem>

            <DropdownMenuItem onClick={() => handleToggle(m.id, m.isActive)}>
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
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <StatGrid cols={4}>
        <StatCard
          label="Total Members"
          value={totalStats.total}
          icon={UsersRound}
        />
        <StatCard
          label="Active Members"
          value={totalStats.active}
          icon={MonitorCheck}
        />
        <StatCard
          label="Inactive Members"
          value={totalStats.inactive}
          icon={MonitorDot}
        />
        <StatCard
          label="Departments"
          value={totalStats.departments}
          icon={Building2}
        />
      </StatGrid>

      {/* Filters */}
      <TableFilters
        search={search}
        onSearchChange={setSearch}
        searchPlaceholder="Search by name or email..."
        filteredCount={filtered.length}
        totalCount={members.length}
        filters={[
          {
            value: deptFilter,
            onChange: setDeptFilter,
            placeholder: "All Departments",
            options: departments.map((d) => ({ label: d.name, value: d.id })),
          },
          {
            value: roleFilter,
            onChange: setRoleFilter,
            placeholder: "All Roles",
            options: roles.map((r) => ({ label: r.name, value: r.id })),
          },
        ]}
      />

      {/* Table */}
      <DataTable
        data={filtered}
        columns={columns}
        rowKey={(m) => m.id}
        emptyState={
          <div className="flex flex-col items-center gap-2">
            <Users className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm font-medium text-muted-foreground">No team members found</p>
            <p className="text-xs text-muted-foreground">Try adjusting your filters</p>
          </div>
        }
        pagination={{
          currentPage,
          totalPages,
          onPageChange: goToPage,
        }}
      />

      {/* Edit dialog */}
      {editingMember && (
        <EditTeamMemberDialog
          member={editingMember}
          departments={departments}
          roles={roles}
          open={!!editingMember}
          onClose={() => setEditingMember(null)}
        />
      )}
      {/* ← THIS WAS MISSING */}
      {passwordDialog && (
        <PasswordDialog
          open={passwordDialog.open}
          onClose={() => setPasswordDialog(null)}
          memberId={passwordDialog.memberId}
          memberName={passwordDialog.memberName}
        />
      )}
    </div>
  );
}