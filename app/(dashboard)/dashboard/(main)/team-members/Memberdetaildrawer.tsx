"use client";

import { useState, useTransition, useRef } from "react";
import {
  X, Upload, Camera, Eye, EyeOff, Loader2, RefreshCw, Save,
  User, Briefcase, Phone, Users, FileText, Shield, Mail,
  Calendar, Building2, BadgeCheck, AlertCircle, Check,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Badge } from "../components/ui/badge";
import { Switch } from "../components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import {
  updateTeamMember, updateMemberPassword, resetMemberPassword,
  uploadProfilePic, uploadAadhaarFile, uploadPanFile,
} from "./actions";
import type { TeamMember } from "./actions";
import { WorkEmailInput } from "./Workemailinput";


type SelectOption = { id: string; name: string };

interface Props {
  member: TeamMember;
  departments: SelectOption[];
  roles: SelectOption[];
  open: boolean;
  onClose: () => void;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(s: string) { return s.replace(/\b\w/g, (c) => c.toUpperCase()); }
function isFutureDate(d: string) {
  if (!d) return false;
  const sel = new Date(d); const today = new Date(); today.setHours(0, 0, 0, 0); return sel > today;
}
function todayISO() { return new Date().toISOString().split("T")[0]; }

// ── Section wrapper ───────────────────────────────────────────────────────────

function Section({ title, icon: Icon, children }: { title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b">
        <div className="h-6 w-6 rounded-md bg-dashboard-primary/10 flex items-center justify-center">
          <Icon className="h-3.5 w-3.5 text-dashboard-primary" />
        </div>
        <h3 className="text-sm font-semibold text-dashboard-base-content">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1.5">
      <Label className="text-xs text-muted-foreground uppercase tracking-wide">{label}</Label>
      {children}
    </div>
  );
}

// ── File uploader ─────────────────────────────────────────────────────────────

function FileUploadRow({
  label, currentUrl, onUpload, accept = "image/jpeg,image/png,application/pdf",
}: {
  label: string; currentUrl: string | null;
  onUpload: (fd: FormData) => Promise<void>; accept?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    setUploading(true);
    const fd = new FormData(); fd.append("file", f);
    await onUpload(fd);
    setUploading(false);
    if (ref.current) ref.current.value = "";
  };

  return (
    <div className="flex items-center justify-between rounded-lg border p-3 gap-3">
      <div className="min-w-0">
        <p className="text-sm font-medium">{label}</p>
        {currentUrl
          ? <a href={currentUrl} target="_blank" rel="noreferrer" className="text-xs text-dashboard-primary hover:underline truncate block">View uploaded file ↗</a>
          : <p className="text-xs text-muted-foreground">No file uploaded</p>
        }
      </div>
      <Button type="button" variant="outline" size="sm" onClick={() => ref.current?.click()} disabled={uploading} className="shrink-0">
        {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
        <span className="ml-1.5 text-xs">{currentUrl ? "Replace" : "Upload"}</span>
      </Button>
      <input ref={ref} type="file" accept={accept} className="hidden" onChange={handleChange} />
    </div>
  );
}

// ── Password panel ────────────────────────────────────────────────────────────

function PasswordSection({ memberId }: { memberId: string }) {
  const [newPwd, setNewPwd] = useState("");
  const [show, setShow] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isPending, startTransition] = useTransition();

  const handleUpdate = () => {
    if (newPwd.length < 8) { toast.error("Password must be at least 8 characters"); return; }
    startTransition(async () => {
      const r = await updateMemberPassword(memberId, newPwd);
      if (r.success) { toast.success("Password updated"); setNewPwd(""); }
      else toast.error(r.error);
    });
  };

  const handleReset = () => {
    startTransition(async () => {
      const r = await resetMemberPassword(memberId);
      if (r.success) { setResetResult(r.data.plainPassword); toast.success("Password reset — copy it now!"); }
      else toast.error(r.error);
    });
  };

  const copyPwd = () => {
    if (!resetResult) return;
    navigator.clipboard.writeText(resetResult);
    setCopied(true); setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Section title="Password Management" icon={Shield}>
      <div className="space-y-3">
        <div className="relative">
          <Input type={show ? "text" : "password"} value={newPwd}
            onChange={(e) => setNewPwd(e.target.value)} placeholder="New password (min 8 chars)" className="pr-10" />
          <button type="button" onClick={() => setShow(!show)}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleUpdate} disabled={isPending || newPwd.length < 8} size="sm" className="flex-1 bg-dashboard-primary">
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null} Set password
          </Button>
          <Button onClick={handleReset} disabled={isPending} variant="outline" size="sm" className="flex-1">
            <RefreshCw className="h-3.5 w-3.5 mr-1" /> Auto-generate
          </Button>
        </div>

        {resetResult && (
          <div className="flex items-center justify-between rounded-lg bg-dashboard-warning/10 border border-dashboard-warning/30 px-3 py-2">
            <div>
              <p className="text-xs font-medium text-dashboard-warning-content">Generated password — copy now!</p>
              <p className="font-mono text-sm font-bold tracking-wider mt-0.5">{resetResult}</p>
            </div>
            <button onClick={copyPwd}
              className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-dashboard-warning/20 transition-colors">
              {copied ? <Check className="h-4 w-4 text-dashboard-success" /> : <BadgeCheck className="h-4 w-4" />}
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}

// ── Main Drawer ───────────────────────────────────────────────────────────────

export function MemberDetailDrawer({ member, departments, roles, open, onClose }: Props) {
  const [isPending, startTransition] = useTransition();
  const [picPreview, setPicPreview] = useState<string | null>(member.profilePicUrl);
  const [aadhaarUrl, setAadhaarUrl] = useState<string | null>(member.aadhaarFileUrl);
  const [panUrl, setPanUrl] = useState<string | null>(member.panFileUrl);
  const picRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    name: member.name,
    email: member.email,
    personalEmail: member.personalEmail ?? "",
    designation: member.designation ?? "",
    departmentId: member.department?.id ?? "",
    roleId: member.role?.id ?? "",
    joiningDate: member.joiningDate ? format(new Date(member.joiningDate), "yyyy-MM-dd") : "",
    isActive: member.isActive,
    personalMobile: member.personalMobile ?? "",
    alternativeMobile: member.alternativeMobile ?? "",
    fatherName: member.fatherName ?? "",
    fatherMobile: member.fatherMobile ?? "",
    motherName: member.motherName ?? "",
    motherMobile: member.motherMobile ?? "",
    aadhaarNumber: member.aadhaarNumber ?? "",
    panNumber: member.panNumber ?? "",
  });

  const handlePicUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]; if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    const fd = new FormData(); fd.append("file", f);
    const r = await uploadProfilePic(member.id, fd);
    if (r.success) { setPicPreview(r.data.url); toast.success("Photo updated"); }
    else toast.error(r.error);
    if (picRef.current) picRef.current.value = "";
  };

  const handleSave = () => {
    if (isFutureDate(form.joiningDate)) { toast.error("Joining date cannot be a future date"); return; }
    if (form.aadhaarNumber && !/^\d{12}$/.test(form.aadhaarNumber)) { toast.error("Aadhaar must be 12 digits"); return; }
    if (form.panNumber && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.panNumber)) { toast.error("Invalid PAN format"); return; }
    const mobileRE = /^[6-9]\d{9}$/;
    for (const [k, v] of Object.entries({ personalMobile: form.personalMobile, alternativeMobile: form.alternativeMobile, fatherMobile: form.fatherMobile, motherMobile: form.motherMobile })) {
      if (v && !mobileRE.test(v)) { toast.error(`Invalid ${k.replace(/([A-Z])/g, " $1").toLowerCase()}`); return; }
    }

    startTransition(async () => {
      const r = await updateTeamMember({
        id: member.id,
        name: form.name,
        email: form.email,
        personalEmail: form.personalEmail || null,
        designation: form.designation || null,
        departmentId: form.departmentId || null,
        roleId: form.roleId || null,
        joiningDate: form.joiningDate || null,
        isActive: form.isActive,
        personalMobile: form.personalMobile || null,
        alternativeMobile: form.alternativeMobile || null,
        fatherName: form.fatherName || null,
        fatherMobile: form.fatherMobile || null,
        motherName: form.motherName || null,
        motherMobile: form.motherMobile || null,
        aadhaarNumber: form.aadhaarNumber || null,
        panNumber: form.panNumber || null,
      });
      if (r.success) { toast.success("Member updated successfully"); onClose(); }
      else toast.error(r.error);
    });
  };

  if (!open) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={onClose} />

      {/* Drawer */}
      <div className="fixed right-0 top-0 h-full w-full max-w-[600px] bg-background z-50 shadow-2xl flex flex-col animate-in slide-in-from-right duration-300">

        {/* Header */}
        <div className="flex items-start gap-4 px-6 py-5 border-b bg-gradient-to-r from-dashboard-primary/5 to-transparent">
          <div className="relative shrink-0">
            <div className="h-16 w-16 rounded-xl overflow-hidden flex items-center justify-center text-xl font-bold text-purple-100"
              style={{ background: picPreview ? "none" : "linear-gradient(135deg,#7F77DD,#534AB7)" }}>
              {picPreview
                ? <img src={picPreview} alt={member.name} className="h-full w-full object-cover" />
                : member.name.charAt(0).toUpperCase()
              }
            </div>
            <button onClick={() => picRef.current?.click()}
              className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full bg-dashboard-primary text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform">
              <Camera className="h-3 w-3" />
            </button>
            <input ref={picRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePicUpload} />
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-lg font-bold text-dashboard-base-content truncate">{member.name}</h2>
              <Badge className={`text-xs rounded-full px-2 py-0.5 font-medium border ${member.isActive ? "bg-green-50 text-green-800 border-green-200" : "bg-red-50 text-red-800 border-red-200"}`}>
                <span className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${member.isActive ? "bg-green-500" : "bg-red-500"}`} />
                {member.isActive ? "Active" : "Inactive"}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground mt-0.5 font-mono">{member.employeeId}</p>
            {member.designation && <p className="text-sm text-dashboard-base-content/70 mt-0.5">{member.designation}</p>}
          </div>

          <button onClick={onClose} className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-muted transition-colors shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-8">

          {/* Basic Info */}
          <Section title="Basic Information" icon={User}>
            <div className="grid gap-4">
              <Field label="Full name">
                <Input value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  onBlur={(e) => setForm({ ...form, name: toTitleCase(e.target.value.trim()) })} />
              </Field>
              <div className="flex items-center justify-between rounded-lg border p-3">
                <div>
                  <p className="text-sm font-medium">Active status</p>
                  <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
                </div>
                <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} />
              </div>
            </div>
          </Section>

          {/* Work Details */}
          <Section title="Work Details" icon={Briefcase}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Employee ID">
                  <Input value={member.employeeId} disabled className="bg-muted font-mono text-sm" />
                </Field>
                <Field label="Designation">
                  <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })} placeholder="e.g. Travel Consultant" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Department">
                  <Select value={form.departmentId} onValueChange={(v) => setForm({ ...form, departmentId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {departments.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Role">
                  <Select value={form.roleId} onValueChange={(v) => setForm({ ...form, roleId: v })}>
                    <SelectTrigger><SelectValue placeholder="Select" /></SelectTrigger>
                    <SelectContent>
                      {roles.map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </Field>
              </div>
              <Field label="Date of joining">
                <Input type="date" value={form.joiningDate} max={todayISO()}
                  onChange={(e) => { if (isFutureDate(e.target.value)) { toast.error("Future dates not allowed"); return; } setForm({ ...form, joiningDate: e.target.value }); }} />
              </Field>
            </div>
          </Section>

          {/* Contact */}
          <Section title="Contact Information" icon={Mail}>
            <div className="grid gap-4">
              <div className="grid">
                <WorkEmailInput
                  value={form.email}
                  onChange={(fullEmail) => setForm({ ...form, email: fullEmail })}
                  excludeId={member.id}   // ← skips the current member so their own email shows Available
                />


                <Field label="Personal email">
                  <Input type="email" value={form.personalEmail} onChange={(e) => setForm({ ...form, personalEmail: e.target.value })} placeholder="personal@gmail.com" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Personal mobile">
                  <Input type="tel" value={form.personalMobile} maxLength={10}
                    onChange={(e) => setForm({ ...form, personalMobile: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210" />
                </Field>
                <Field label="Alternative mobile">
                  <Input type="tel" value={form.alternativeMobile} maxLength={10}
                    onChange={(e) => setForm({ ...form, alternativeMobile: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210" />
                </Field>
              </div>
            </div>
          </Section>

          {/* Family */}
          <Section title="Family Information" icon={Users}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Father's name">
                  <Input value={form.fatherName}
                    onChange={(e) => setForm({ ...form, fatherName: e.target.value })}
                    onBlur={(e) => setForm({ ...form, fatherName: toTitleCase(e.target.value.trim()) })}
                    placeholder="Ram Sharma" />
                </Field>
                <Field label="Father's mobile">
                  <Input type="tel" value={form.fatherMobile} maxLength={10}
                    onChange={(e) => setForm({ ...form, fatherMobile: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210" />
                </Field>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Mother's name">
                  <Input value={form.motherName}
                    onChange={(e) => setForm({ ...form, motherName: e.target.value })}
                    onBlur={(e) => setForm({ ...form, motherName: toTitleCase(e.target.value.trim()) })}
                    placeholder="Sita Sharma" />
                </Field>
                <Field label="Mother's mobile">
                  <Input type="tel" value={form.motherMobile} maxLength={10}
                    onChange={(e) => setForm({ ...form, motherMobile: e.target.value.replace(/\D/g, "") })}
                    placeholder="9876543210" />
                </Field>
              </div>
            </div>
          </Section>

          {/* Documents */}
          <Section title="Identity Documents" icon={FileText}>
            <div className="grid gap-4">
              <div className="grid grid-cols-2 gap-3">
                <Field label="Aadhaar number">
                  <Input value={form.aadhaarNumber} maxLength={12}
                    onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/\D/g, "") })}
                    placeholder="123456789012" />
                </Field>
                <Field label="PAN number">
                  <Input value={form.panNumber} maxLength={10}
                    onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
                    placeholder="ABCDE1234F" />
                </Field>
              </div>

              <FileUploadRow label="Aadhaar card file" currentUrl={aadhaarUrl}
                onUpload={async (fd) => {
                  const r = await uploadAadhaarFile(member.id, fd);
                  if (r.success) { setAadhaarUrl(r.data.url); toast.success("Aadhaar file uploaded"); }
                  else toast.error(r.error);
                }} />

              <FileUploadRow label="PAN card file" currentUrl={panUrl}
                onUpload={async (fd) => {
                  const r = await uploadPanFile(member.id, fd);
                  if (r.success) { setPanUrl(r.data.url); toast.success("PAN file uploaded"); }
                  else toast.error(r.error);
                }} />
            </div>
          </Section>

          {/* Password */}
          <PasswordSection memberId={member.id} />

          {/* Meta */}
          <div className="rounded-lg bg-muted/40 p-4 text-xs text-muted-foreground space-y-1">
            <p>Created: {format(new Date(member.createdAt), "dd MMM yyyy, h:mm a")}</p>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-3 bg-background">
          <Button variant="outline" onClick={onClose} disabled={isPending} className="flex-1">Cancel</Button>
          <Button onClick={handleSave} disabled={isPending} className="flex-1 bg-dashboard-primary">
            {isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Save className="h-4 w-4 mr-2" />}
            Save changes
          </Button>
        </div>
      </div>
    </>
  );
}