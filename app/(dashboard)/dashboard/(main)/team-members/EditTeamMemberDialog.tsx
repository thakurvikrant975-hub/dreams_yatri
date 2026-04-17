// EditTeamMemberDialog.tsx
"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { updateTeamMember } from "./actions";
import type { TeamMember } from "./actions";
import { format } from "date-fns";

type SelectOption = { id: string; name: string };

interface Props {
  member: TeamMember;
  departments: SelectOption[];
  roles: SelectOption[];
  open: boolean;
  onClose: () => void;
}

// ── Utilities ─────────────────────────────────────────────────────────────────

/** Capitalizes first letter of each word */
function toTitleCase(str: string): string {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/** Returns true if date string is in the future (after today) */
function isFutureDate(dateStr: string): boolean {
  if (!dateStr) return false;
  const selected = new Date(dateStr);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return selected > today;
}

/** Today's date in yyyy-MM-dd for max attribute */
function todayISO(): string {
  return new Date().toISOString().split("T")[0];
}

export function EditTeamMemberDialog({ member, departments, roles, open, onClose }: Props) {
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    password: "",
    departmentId: member.department?.id ?? "",
    roleId: member.role?.id ?? "",
    joiningDate: member.joiningDate
      ? format(new Date(member.joiningDate), "yyyy-MM-dd")
      : "",
    isActive: member.isActive,
  });

const handleSubmit = () => {
  if (!form.name || !form.email) {
    toast.error("Name and email are required");
    return;
  }
  // Password is OPTIONAL on edit — only validate if provided
  if (form.password && form.password.length < 8) {
    toast.error("Password must be at least 8 characters");
    return;
  }
  if (isFutureDate(form.joiningDate)) {
    toast.error("Joining date cannot be a future date");
    return;
  }

  startTransition(async () => {
    const result = await updateTeamMember({
      id: member.id,
      name: form.name,
      email: form.email,
      ...(form.password ? { password: form.password } : {}),
      departmentId: form.departmentId || null,
      roleId: form.roleId || null,
      joiningDate: form.joiningDate || null,
      isActive: form.isActive,
    });

    if (result.success) {
      toast.success("Member updated successfully");
      onClose();
    } else {
      toast.error(result.error, { duration: 6000 });
    }
  });
};

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Edit team member</DialogTitle>
          <DialogDescription>
            Update details for {member.name}. Leave password blank to keep existing.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label>Full name *</Label>
            <Input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>Email *</Label>
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </div>

          <div className="grid gap-2">
            <Label>New password <span className="text-muted-foreground text-xs">(optional)</span></Label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Leave blank to keep current"
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label>Department</Label>
              <Select
                value={form.departmentId}
                onValueChange={(v) => setForm({ ...form, departmentId: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {departments.map((d) => (
                    <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label>Role</Label>
              <Select
                value={form.roleId}
                onValueChange={(v) => setForm({ ...form, roleId: v })}
              >
                <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                <SelectContent>
                  {roles.map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-2">
            <Label>Joining date</Label>
            <Input
              type="date"
              value={form.joiningDate}
              onChange={(e) => setForm({ ...form, joiningDate: e.target.value })}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label className="cursor-pointer">Active</Label>
              <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
            </div>
            <Switch
              checked={form.isActive}
              onCheckedChange={(c) => setForm({ ...form, isActive: c })}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
            Save changes
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}