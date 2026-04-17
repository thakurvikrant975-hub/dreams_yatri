"use client";

import { useState, useMemo, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Users, MoreHorizontal, Trash2, Power, Pencil, Mail,
  Clipboard, Copy, Check, RefreshCw, Eye, EyeOff,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
  DialogDescription, DialogFooter,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { toast } from "sonner";
import {
  deleteTeamMember, toggleActive,
  resetMemberPassword, updateMemberPassword,
} from "./actions";
import type { PaginatedMembers, TeamMember } from "./actions";
import { format } from "date-fns";
import { EditTeamMemberDialog } from "./EditTeamMemberDialog";
import { CreateTeamMemberDialog } from "./TeamMemberDialog";
import { Stats } from "../components/dashboard/Stats";
import { DataTable, type ColumnDef } from "../components/dashboard/Datatable";
import { TableFilters } from "../components/dashboard/Tablefilters";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────────────────

type SelectOption = { id: string; name: string };

interface Props {
  paginated: PaginatedMembers;
  totalStats: { total: number; active: number; inactive: number; departments: number };
  departments: SelectOption[];
  roles: SelectOption[];
  currentPage: number;
}

type PasswordDialogState = {
  open: boolean;
  memberId: string;
  memberName: string;
  initialPassword?: string;
};

// ─────────────────────────────────────────────────────────────────────────────
// PasswordDialog — receives password as prop, no async logic inside
// ─────────────────────────────────────────────────────────────────────────────

function PasswordDialog({
  open,
  onClose,
  memberId,
  memberName,
  initialPassword,
}: {
  open: boolean;
  onClose: () => void;
  memberId: string;
  memberName: string;
  initialPassword: string; // always provided — reset happens BEFORE dialog opens
}) {
  const [password, setPassword] = useState(initialPassword);
  const [newPassword, setNewPassword] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [copied, setCopied] = useState(false);
  const [isResetting, startReset] = useTransition();
  const [isUpdating, startUpdate] = useTransition();
const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState | null>(null);
const [passwordLoadingId, setPasswordLoadingId] = useState<string | null>(null); // ← add this line
  // Manual reset inside dialog — confirms first
  const handleReset = () => {
    if (!confirm(`Reset password for ${memberName}? Their current password will stop working.`)) return;
    startReset(async () => {
      const r = await resetMemberPassword(memberId);
      if (r.success) {
        setPassword(r.data.plainPassword);
        setNewPassword("");
        toast.success("Password reset successfully");
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  };

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Clipboard unavailable — copy it manually");
    }
  };

  const handleUpdate = () => {
    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    startUpdate(async () => {
      const r = await updateMemberPassword(memberId, newPassword);
      if (r.success) {
        setPassword(newPassword);
        setNewPassword("");
        toast.success("Password updated successfully");
      } else {
        toast.error(r.error, { duration: 6000 });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Password — {memberName}</DialogTitle>
          <DialogDescription>
            Copy this password and share it securely with the employee.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Current password */}
          <div className="grid gap-2">
            <Label>Current Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={isResetting ? "" : password}
                  readOnly
                  placeholder={isResetting ? "Generating..." : ""}
                  className="pr-10 font-mono bg-muted"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <Button
                variant="outline"
                size="icon"
                onClick={() => handleCopy(password)}
                disabled={isResetting || !password}
                className="shrink-0"
              >
                {copied
                  ? <Check className="h-4 w-4 text-green-500" />
                  : <Copy className="h-4 w-4" />}
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={handleReset}
                disabled={isResetting}
                className="shrink-0"
                title="Generate new password"
              >
                <RefreshCw className={`h-4 w-4 ${isResetting ? "animate-spin" : ""}`} />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Click <RefreshCw className="h-3 w-3 inline" /> to generate a new random password.
            </p>
          </div>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t" />
            </div>
            <div className="relative flex justify-center">
              <span className="bg-background px-2 text-xs text-muted-foreground">
                or set a custom password
              </span>
            </div>
          </div>

          {/* Custom password */}
          <div className="grid gap-2">
            <Label>New Custom Password</Label>
            <div className="flex gap-2">
              <div className="relative flex-1">
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
              <Button
                onClick={handleUpdate}
                disabled={isUpdating || newPassword.length < 8}
                className="shrink-0"
              >
                {isUpdating ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Update"}
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TeamMembersTable
// ─────────────────────────────────────────────────────────────────────────────

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
  const [passwordDialog, setPasswordDialog] = useState<PasswordDialogState | null>(null);
  const [passwordLoadingId, setPasswordLoadingId] = useState<string | null>(null);

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

  // Resets password FIRST, then opens dialog with plain password ready
const handlePasswordDialog = async (id: string, name: string) => {
  setPasswordLoadingId(id);
  try {
    const r = await resetMemberPassword(id);
    if (r.success) {
      setPasswordDialog({
        open: true,
        memberId: id,
        memberName: name,
        initialPassword: r.data.plainPassword,
      });
    } else {
      toast.error(r.error, { duration: 6000 });
    }
  } finally {
    setPasswordLoadingId(null);
  }
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

  // ── Columns ───────────────────────────────────────────────────────────────
  const columns: ColumnDef<TeamMember>[] = [
    {
      header: "Member",
      width: "w-64",
      cell: (m) => (
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
        <Badge variant={m.isActive ? "default" : "secondary"}>
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
            <DropdownMenuItem
              onClick={() => handlePasswordDialog(m.id, m.name)}
              disabled={passwordLoadingId === m.id}
            >
              {passwordLoadingId === m.id
                ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                : <Clipboard className="h-4 w-4 mr-2" />
              }
              {passwordLoadingId === m.id ? "Loading..." : "Reset & View Password"}
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

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">

      {/* Create button */}
      <div className="flex justify-end">
        <CreateTeamMemberDialog
          departments={departments}
          roles={roles}
          onCreated={(id, name, pwd) =>
            setPasswordDialog({ open: true, memberId: id, memberName: name, initialPassword: pwd })
          }
        />
      </div>

      {/* Stats */}
      <Stats
        rows={[
          { label: "Total Members", value: totalStats.total },
          { label: "Active", value: totalStats.active },
          { label: "Inactive", value: totalStats.inactive, muted: true },
          { label: "Departments", value: totalStats.departments },
        ]}
      />

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
        pagination={{ currentPage, totalPages, onPageChange: goToPage }}
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

      {/* Password dialog — only mounts when initialPassword is ready */}
{passwordDialog && passwordDialog.initialPassword && (
        <PasswordDialog
          open={passwordDialog.open}
          onClose={() => setPasswordDialog(null)}
          memberId={passwordDialog.memberId}
          memberName={passwordDialog.memberName}
          initialPassword={passwordDialog.initialPassword}
        />
      )}

    </div>
  );
}