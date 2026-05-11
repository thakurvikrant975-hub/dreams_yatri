"use client";

import { useState, useTransition } from "react";
import { Plus, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle, DialogTrigger,
} from "../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { toast } from "sonner";
import { createTeamMember } from "./actions";

type SelectOption = { id: string; name: string };

interface Props {
  departments: SelectOption[];
  roles: SelectOption[];
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

export function CreateTeamMemberDialog({ departments, roles }: Props) {
  const [open, setOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    departmentId: "",
    roleId: "",
    joiningDate: "",
    isActive: true,
  });

  const reset = () => {
    setForm({
      name: "", email: "", password: "",
      departmentId: "", roleId: "", joiningDate: "", isActive: true,
    });
    setShowPassword(false);
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = "";
    for (let i = 0; i < 14; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    setForm((f) => ({ ...f, password: pwd }));
    setShowPassword(true);
  };

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.password) {
      toast.error("Name, email, and password are required");
      return;
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }
    // ── Date guard ────────────────────────────────────────────────────────
    if (isFutureDate(form.joiningDate)) {
      toast.error("Joining date cannot be a future date");
      return;
    }

    // Replace the startTransition block in handleSubmit
    startTransition(async () => {
      let result;
      try {
        result = await createTeamMember({
          name: form.name,
          email: form.email,
          password: form.password,
          departmentId: form.departmentId || null,
          roleId: form.roleId || null,
          joiningDate: form.joiningDate || null,
          isActive: form.isActive,
        });
      } catch (err) {
        // Network/serialization failure — action itself threw
        toast.error("Action failed: " + String(err));
        return;
      }

      if (result.success) {
        toast.success(`Team member created (ID: ${result.data.id})`);
        setOpen(false);
        reset();
      } else {
        // Shows the exact error from actions.ts in the popup
        toast.error(result.error, {
          duration: 6000,          // keep it visible long enough to read
          description: "Check the form and try again",
        });
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button className="bg-dashboard-primary hover:scale-105 duration-300 transition-transform shadow-md">
          <Plus className="h-4 w-4 mr-2" />
          Add team member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>
            Create a new team member account. They'll use the email and password to log in.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="name">Full name *</Label>
            <Input
              id="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              onBlur={(e) => setForm({ ...form, name: toTitleCase(e.target.value.trim()) })}
              placeholder="Name here"
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="email">Email *</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="name@dreamsyatri.com"
            />
          </div>

          <div className="grid gap-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password">Password *</Label>
              <button
                type="button"
                onClick={generatePassword}
                className="text-xs text-primary hover:underline"
              >
                Generate
              </button>
            </div>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="Min 8 characters"
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
            <Label htmlFor="joiningDate">Joining date</Label>
            <Input
              id="joiningDate"
              type="date"
              value={form.joiningDate}
              max={todayISO()}                          // browser blocks future dates natively
              onChange={(e) => {
                if (isFutureDate(e.target.value)) {
                  toast.error("Joining date cannot be a future date");
                  return;                               // reject the value, don't update state
                }
                setForm({ ...form, joiningDate: e.target.value });
              }}
            />
          </div>

          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
              <p className="text-xs text-muted-foreground">
                Inactive users cannot log in
              </p>
            </div>
            <Switch
              id="isActive"
              checked={form.isActive}
              onCheckedChange={(c) => setForm({ ...form, isActive: c })}
            />
          </div>
        </div>

        <DialogFooter>
          <div>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create member
            </Button>
          </div>

        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
