"use client";

import { useState, useTransition, useRef, useCallback } from "react";
import {
  Plus, Eye, EyeOff, Loader2, Upload, X, User,
  Briefcase, Phone, Users, FileText, Camera,
} from "lucide-react";
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
import { createTeamMember, uploadProfilePic } from "./actions";
import { WorkEmailInput } from "./Workemailinput";



type SelectOption = { id: string; name: string };
interface Props { departments: SelectOption[]; roles: SelectOption[] }

// ── Helpers ───────────────────────────────────────────────────────────────────

function toTitleCase(s: string) {
  return s.replace(/\b\w/g, (c) => c.toUpperCase());
}
function isFutureDate(d: string) {
  if (!d) return false;
  const sel = new Date(d); const today = new Date(); today.setHours(0,0,0,0); return sel > today;
}
function todayISO() { return new Date().toISOString().split("T")[0]; }

const TABS = [
  { id: "basic",   label: "Basic Info",   icon: User },
  { id: "work",    label: "Work Details", icon: Briefcase },
  { id: "contact", label: "Contact",      icon: Phone },
  { id: "family",  label: "Family",       icon: Users },
  { id: "docs",    label: "Documents",    icon: FileText },
] as const;

type TabId = typeof TABS[number]["id"];

const EMPTY_FORM = {
  name: "", email: "", password: "", personalEmail: "",
  designation: "", departmentId: "", roleId: "", joiningDate: "", isActive: true,
  personalMobile: "", alternativeMobile: "",
  fatherName: "", fatherMobile: "", motherName: "", motherMobile: "",
  aadhaarNumber: "", panNumber: "",
};

// ── Field wrapper ─────────────────────────────────────────────────────────────

function Field({ label, required, children, hint }: {
  label: string; required?: boolean; children: React.ReactNode; hint?: string;
}) {
  return (
    <div className="grid gap-1.5 rounded-md">
      <Label className="text-sm font-medium text-dashboard-base-content">
        {label}{required && <span className="text-dashboard-error ml-0.5">*</span>}
      </Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

// ── Tab content ───────────────────────────────────────────────────────────────

function BasicTab({
  form, setForm, showPassword, setShowPassword, picPreview, setPicPreview,
  picFile, setPicFile,
}: {
  form: typeof EMPTY_FORM;
  setForm: (f: typeof EMPTY_FORM) => void;
  showPassword: boolean;
  setShowPassword: (v: boolean) => void;
  picPreview: string | null;
  setPicPreview: (v: string | null) => void;
  picFile: File | null;
  setPicFile: (f: File | null) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePic = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error("Image must be under 2 MB"); return; }
    if (!["image/jpeg","image/png","image/webp"].includes(f.type)) { toast.error("Only JPEG, PNG, WebP allowed"); return; }
    setPicFile(f);
    setPicPreview(URL.createObjectURL(f));
  };

  const generatePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%";
    let pwd = ""; for (let i = 0; i < 14; i++) pwd += chars[Math.floor(Math.random() * chars.length)];
    setForm({ ...form, password: pwd }); setShowPassword(true);
  };

  return (
    <div className="space-y-4">
      {/* Avatar upload */}
      <div className="flex items-center gap-4">
        <div className="relative">
          <div className="h-20 w-20 rounded-full overflow-hidden flex items-center justify-center text-2xl font-bold text-purple-100"
            style={{ background: picPreview ? "none" : "linear-gradient(135deg,#7F77DD,#534AB7)" }}>
            {picPreview
              ? <img src={picPreview} alt="Preview" className="h-full w-full object-cover" />
              : (form.name ? form.name.charAt(0).toUpperCase() : <Camera className="h-7 w-7 opacity-60" />)
            }
          </div>
          <button type="button" onClick={() => fileRef.current?.click()}
            className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-dashboard-primary text-white flex items-center justify-center shadow-md hover:scale-110 transition-transform">
            <Upload className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="flex-1">
          <p className="text-sm font-medium text-dashboard-base-content">Profile photo</p>
          <p className="text-xs text-muted-foreground">JPEG, PNG, WebP · Max 2 MB</p>
          {picPreview && (
            <button type="button" onClick={() => { setPicPreview(null); setPicFile(null); }}
              className="mt-1 text-xs text-dashboard-error hover:underline flex items-center gap-1">
              <X className="h-3 w-3" /> Remove
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handlePic} />
      </div>

      <Field label="Full name" required>
        <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
          onBlur={(e) => setForm({ ...form, name: toTitleCase(e.target.value.trim()) })}
          placeholder="Mayank Sharma" />
      </Field>

      <WorkEmailInput
        value={form.email}
        onChange={(fullEmail) => setForm({ ...form, email: fullEmail })}
      />

      <Field label="Password" required>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Input type={showPassword ? "text" : "password"} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              placeholder="Min 8 characters" className="pr-10" />
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          <Button type="button" variant="outline" onClick={generatePassword} className="shrink-0 text-xs px-3">
            Generate
          </Button>
        </div>
      </Field>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <Label className="cursor-pointer">Active</Label>
          <p className="text-xs text-muted-foreground">Inactive users cannot log in</p>
        </div>
        <Switch checked={form.isActive} onCheckedChange={(c) => setForm({ ...form, isActive: c })} />
      </div>
    </div>
  );
}

function WorkTab({ form, setForm, departments, roles }: {
  form: typeof EMPTY_FORM; setForm: (f: typeof EMPTY_FORM) => void;
  departments: SelectOption[]; roles: SelectOption[];
}) {
  return (
    <div className="space-y-4">
      <Field label="Personal email">
        <Input type="email" value={form.personalEmail}
          onChange={(e) => setForm({ ...form, personalEmail: e.target.value })}
          placeholder="personal@gmail.com" />
      </Field>

      <Field label="Designation">
        <Input value={form.designation} onChange={(e) => setForm({ ...form, designation: e.target.value })}
          placeholder="e.g. Senior Travel Consultant" />
      </Field>

      <div className="grid grid-cols-2 gap-4">
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
          onChange={(e) => {
            if (isFutureDate(e.target.value)) { toast.error("Joining date cannot be a future date"); return; }
            setForm({ ...form, joiningDate: e.target.value });
          }} />
      </Field>
    </div>
  );
}

function ContactTab({ form, setForm }: { form: typeof EMPTY_FORM; setForm: (f: typeof EMPTY_FORM) => void }) {
  return (
    <div className="space-y-4">
      <Field label="Personal mobile" hint="10-digit Indian number (starts with 6–9)">
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
  );
}

function FamilyTab({ form, setForm }: { form: typeof EMPTY_FORM; setForm: (f: typeof EMPTY_FORM) => void }) {
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
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
      <div className="grid grid-cols-2 gap-4">
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
  );
}

function DocsTab({ form, setForm }: { form: typeof EMPTY_FORM; setForm: (f: typeof EMPTY_FORM) => void }) {
  const aadhaarRef = useRef<HTMLInputElement>(null);
  const panRef     = useRef<HTMLInputElement>(null);
  const [aadhaarFileName, setAadhaarFileName] = useState("");
  const [panFileName,     setPanFileName]     = useState("");

  return (
    <div className="space-y-4">
      <p className="text-xs text-muted-foreground bg-dashboard-base-200 rounded-lg p-3">
        Documents (Aadhaar & PAN files) can be uploaded after the member is created via their profile page.
        Enter the card numbers below now.
      </p>

      <Field label="Aadhaar card number" hint="12-digit number, no spaces">
        <Input value={form.aadhaarNumber} maxLength={12}
          onChange={(e) => setForm({ ...form, aadhaarNumber: e.target.value.replace(/\D/g, "") })}
          placeholder="123456789012" />
      </Field>

      <Field label="PAN card number" hint="Format: ABCDE1234F">
        <Input value={form.panNumber} maxLength={10}
          onChange={(e) => setForm({ ...form, panNumber: e.target.value.toUpperCase() })}
          placeholder="ABCDE1234F" />
      </Field>
    </div>
  );
}

// ── Main Dialog ───────────────────────────────────────────────────────────────

export function CreateTeamMemberDialog({ departments, roles }: Props) {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab]   = useState<TabId>("basic");
  const [showPassword, setShowPassword] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [isUploading, setIsUploading] = useState(false);
  const [picPreview, setPicPreview] = useState<string | null>(null);
  const [picFile,    setPicFile]    = useState<File | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const reset = () => {
    setForm(EMPTY_FORM); setActiveTab("basic"); setShowPassword(false);
    setPicPreview(null); setPicFile(null);
  };

  const validatePAN     = (v: string) => !v || /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(v);
  const validateAadhaar = (v: string) => !v || /^\d{12}$/.test(v);
  const validateMobile  = (v: string) => !v || /^[6-9]\d{9}$/.test(v);

  const handleSubmit = () => {
    if (!form.name || !form.email || !form.password) { toast.error("Name, email, and password are required"); setActiveTab("basic"); return; }
    if (form.password.length < 8) { toast.error("Password must be at least 8 characters"); setActiveTab("basic"); return; }
    if (isFutureDate(form.joiningDate)) { toast.error("Joining date cannot be a future date"); setActiveTab("work"); return; }
    if (!validateMobile(form.personalMobile))   { toast.error("Invalid personal mobile number"); setActiveTab("contact"); return; }
    if (!validateMobile(form.alternativeMobile)) { toast.error("Invalid alternative mobile number"); setActiveTab("contact"); return; }
    if (!validateMobile(form.fatherMobile)) { toast.error("Invalid father's mobile number"); setActiveTab("family"); return; }
    if (!validateMobile(form.motherMobile)) { toast.error("Invalid mother's mobile number"); setActiveTab("family"); return; }
    if (!validateAadhaar(form.aadhaarNumber)) { toast.error("Aadhaar must be exactly 12 digits"); setActiveTab("docs"); return; }
    if (!validatePAN(form.panNumber))         { toast.error("Invalid PAN format (e.g. ABCDE1234F)"); setActiveTab("docs"); return; }

    startTransition(async () => {
      let result;
      try {
        result = await createTeamMember({
          name:              form.name,
          email:             form.email,
          password:          form.password,
          personalEmail:     form.personalEmail   || null,
          designation:       form.designation     || null,
          departmentId:      form.departmentId    || null,
          roleId:            form.roleId          || null,
          joiningDate:       form.joiningDate     || null,
          isActive:          form.isActive,
          personalMobile:    form.personalMobile  || null,
          alternativeMobile: form.alternativeMobile || null,
          fatherName:        form.fatherName      || null,
          fatherMobile:      form.fatherMobile    || null,
          motherName:        form.motherName      || null,
          motherMobile:      form.motherMobile    || null,
          aadhaarNumber:     form.aadhaarNumber   || null,
          panNumber:         form.panNumber       || null,
        });
      } catch (err) {
        toast.error("Action failed: " + String(err)); return;
      }

      if (!result.success) { toast.error(result.error, { duration: 6000, description: "Check the form and try again" }); return; }

      // Upload profile picture if selected
      if (picFile) {
        setIsUploading(true);
        const fd = new FormData(); fd.append("file", picFile);
        const upResult = await uploadProfilePic(result.data.id, fd);
        setIsUploading(false);
        if (!upResult.success) toast.warning("Member created but photo upload failed: " + upResult.error);
      }

      toast.success(`Member created — ${result.data.employeeId}`);
      setOpen(false); reset();
    });
  };

  const loading = isPending || isUploading;

  return (
    <Dialog open={open} onOpenChange={(o) => { setOpen(o); if (!o) reset(); }}>
      <DialogTrigger asChild>
        <Button size="lg" className="rounded-md bg-dashboard-primary text-dashboard-base-100 py-2.5 px-4 hover:bg-dashboard-primary hover:scale-105 duration-300 hover:text-dashboard-base-100 border border-dashboard-primary">
          <Plus /> Add team member
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-[560px] p-0 overflow-hidden">
        <DialogHeader className="px-6 pt-6 pb-0">
          <DialogTitle>Add team member</DialogTitle>
          <DialogDescription>Create a new team member. Employee ID is auto-generated.</DialogDescription>
        </DialogHeader>

        {/* Tabs */}
        <div className="flex border-b mt-4 px-6 overflow-x-auto gap-0">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button key={tab.id} type="button" onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium border-b-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer
                  ${activeTab === tab.id
                    ? "border-dashboard-primary text-dashboard-primary"
                    : "border-transparent text-muted-foreground hover:text-dashboard-base-content"}`}>
                <Icon className="h-3.5 w-3.5" /> {tab.label}
              </button>
            );
          })}
        </div>

        <div className="px-6 py-4 max-h-[420px] overflow-y-auto">
          {activeTab === "basic"   && <BasicTab form={form} setForm={setForm} showPassword={showPassword} setShowPassword={setShowPassword} picPreview={picPreview} setPicPreview={setPicPreview} picFile={picFile} setPicFile={setPicFile} />}
          {activeTab === "work"    && <WorkTab   form={form} setForm={setForm} departments={departments} roles={roles} />}
          {activeTab === "contact" && <ContactTab form={form} setForm={setForm} />}
          {activeTab === "family"  && <FamilyTab  form={form} setForm={setForm} />}
          {activeTab === "docs"    && <DocsTab    form={form} setForm={setForm} />}
        </div>

        <DialogFooter className="px-6 py-4 border-t bg-muted/30">
          <div className="flex items-center justify-between w-full">
            <div className="flex gap-1">
              {TABS.map((tab) => (
                <div key={tab.id} className={`h-1.5 rounded-full transition-all ${activeTab === tab.id ? "w-5 bg-dashboard-primary" : "w-1.5 bg-muted-foreground/30"}`} />
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>Cancel</Button>
              <Button onClick={handleSubmit} disabled={loading} className="bg-dashboard-primary">
                {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                {isUploading ? "Uploading…" : "Create member"}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}