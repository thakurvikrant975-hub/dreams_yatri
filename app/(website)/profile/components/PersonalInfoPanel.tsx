'use client'

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Section } from "./Section";
import { EditableField } from "./EditableField";
import Button from "@/app/components/ui/Button";
import Label from "@/app/components/forms/Label";
import Input from "@/app/components/forms/Input";
import { Select, Option } from "@/app/components/forms/Select";

interface UserBasicInfo {
  name: string | null;
  email: string | null;
  phone: string | null;
  country_code: string;
  dateOfBirth: Date | string | null;
  city: string | null;
  state: string | null;
  gender: string | null;
  nationality: string | null;
  maritalStatus: string | null;
  anniversary: Date | string | null;
  passportNumber: string | null;
  passportExpiryDate: Date | string | null;
  passportIssuingCountry: string | null;
  panNumber: string | null;
}

type SaveStatus = "idle" | "success" | "error";

function toDateString(val: Date | string | null): string {
  if (!val) return "";
  return new Date(val).toISOString().split("T")[0];
}

export function PersonalInfoPanel({ userBasicInfo }: { userBasicInfo: UserBasicInfo }) {
  const router = useRouter();

  const [form, setForm] = useState({
    name: userBasicInfo.name ?? "",
    email: userBasicInfo.email ?? "",
    phone: userBasicInfo.phone ?? "",
    country_code: userBasicInfo.country_code ?? "+91",
    dateOfBirth: toDateString(userBasicInfo.dateOfBirth),
    city: userBasicInfo.city ?? "",
    state: userBasicInfo.state ?? "",
    gender: userBasicInfo.gender ?? "",
    nationality: userBasicInfo.nationality ?? "",
    maritalStatus: userBasicInfo.maritalStatus ?? "",
    anniversary: toDateString(userBasicInfo.anniversary),
    passportNumber: userBasicInfo.passportNumber ?? "",
    passportExpiryDate: toDateString(userBasicInfo.passportExpiryDate),
    passportIssuingCountry: userBasicInfo.passportIssuingCountry ?? "",
    panNumber: userBasicInfo.panNumber ?? "",
  });

  // ── Separate state per section ─────────────────────────────────────────────
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicStatus, setBasicStatus] = useState<SaveStatus>("idle");
  const [basicError, setBasicError] = useState("");

  const [docSaving, setDocSaving] = useState(false);
  const [docStatus, setDocStatus] = useState<SaveStatus>("idle");
  const [docError, setDocError] = useState("");

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSaveBasic() {
    setBasicSaving(true);
    setBasicStatus("idle");
    setBasicError("");

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name || undefined,
          email: form.email || undefined,
          gender: form.gender || undefined,
          dateOfBirth: form.dateOfBirth || undefined,
          nationality: form.nationality || undefined,
          state: form.state || undefined,
          city: form.city || undefined,
          maritalStatus: form.maritalStatus || undefined,
          anniversary: form.anniversary || undefined,
          country_code: form.country_code || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setBasicError(json.error ?? "Update failed."); setBasicStatus("error"); return; }
      setBasicStatus("success");
      router.refresh();
    } catch {
      setBasicError("Network error. Please try again.");
      setBasicStatus("error");
    } finally {
      setBasicSaving(false);
    }
  }

  async function handleSaveDocuments() {
    setDocSaving(true);
    setDocStatus("idle");
    setDocError("");

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          passportNumber: form.passportNumber || undefined,
          passportExpiryDate: form.passportExpiryDate || undefined,
          passportIssuingCountry: form.passportIssuingCountry || undefined,
          panNumber: form.panNumber || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setDocError(json.error ?? "Update failed."); setDocStatus("error"); return; }
      setDocStatus("success");
      router.refresh();
    } catch {
      setDocError("Network error. Please try again.");
      setDocStatus("error");
    } finally {
      setDocSaving(false);
    }
  }

  return (
    <div className="space-y-5">

      {/* ── Basic Details ──────────────────────────────────────────────── */}
      <Section title="Basic Details" subtitle="Your name and contact information">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="full-name">Full Name</Label>
            <Input
              id="full-name"
              value={form.name}
              onChange={e => handleChange("name", e.target.value)}
              placeholder="Enter full name" autoFocus />
          </div>

          <div>
            <Label htmlFor="date-of-birth">Date of Birth</Label>
            <Input
              id="date-of-birth"
              value={form.dateOfBirth}
              onChange={e => handleChange("dateOfBirth", e.target.value)}
              type="date" />
          </div>

          <div >
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              value={form.gender}
              onChange={val => handleChange("gender", val)}
              placeholder="Your Gender"
              className="h-11"
            >
              <Option value="Male">Male</Option>
              <Option value="Female">Female</Option>
              <Option value="Other">Other</Option>
              <Option value="">Prefer not to say</Option>
            </Select>
          </div>

          <div>
            <Label htmlFor="nationality">
              Nationality
            </Label>
            <Input
              id="nationality"
              value={form.nationality}
              onChange={e => handleChange("nationality", e.target.value)}
              placeholder="Indian" />
          </div>

          <div>
            <Label htmlFor="state">
              State
            </Label>
            <Input
              id="state"
              value={form.state}
              onChange={e => handleChange("state", e.target.value)}
              placeholder="Himachal Pradesh" />
          </div>

          <div>
            <Label htmlFor="city">
              City
            </Label>
            <Input
              id="city"
              value={form.city}
              onChange={e => handleChange("city", e.target.value)}
              placeholder="Shimla" />
          </div>

          <div>
            <Label htmlFor="marital-status">
              Marital Status
            </Label>
            <Input
              id="marital-status"
              value={form.maritalStatus}
              onChange={e => handleChange("maritalStatus", e.target.value)}
              placeholder="SINGLE / MARRIED" />
          </div>

          <div>
            <Label htmlFor="anniversary">
              Anniversary
            </Label>
            <Input
              id="anniversary"
              value={form.anniversary}
              onChange={e => handleChange("anniversary", e.target.value)}
              type="date" />
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3 mt-4">
          {basicStatus === "success" && <span className="text-xs text-green-600 font-medium">Changes saved</span>}
          {basicStatus === "error" && <span className="text-xs text-red-500 font-medium">{basicError}</span>}
          <Button size="sm" onClick={handleSaveBasic} disabled={basicSaving}>
            {basicSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Section>

      <Section title="Contact Details" subtitle="Your preferred contact information for discounts and offers">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              value={form.email}
              onChange={e => handleChange("email", e.target.value)}
              placeholder="you@example.com" />
          </div>
          <div>
            <Label htmlFor="country-code">Country Code</Label>
            <Input
              id="country-code"
              value={form.country_code}
              onChange={e => handleChange("country_code", e.target.value)}
              placeholder="+91" />
          </div>
          <div>
            <Label htmlFor="phone-number">Phone Number</Label>
            <Input
              id="phone-number"
              value={form.phone}
              onChange={e => handleChange("phone", e.target.value)}
              placeholder="+91" />
          </div>
        </div>
      </Section>

      {/* ── Travel Documents ───────────────────────────────────────────── */}
      <Section title="Travel Documents" subtitle="Passport and PAN details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Passport Number</Label>
            <Input
              id="email"
              value={form.passportNumber}
              onChange={e => handleChange("passportNumber", e.target.value)}
              placeholder="A1234567" />
          </div>
          <div>
            <Label htmlFor="passport-issuing-country">Passport Issuing Country</Label>
            <Input
              id="passport-issuing-country"
              value={form.passportIssuingCountry}
              onChange={e => handleChange("passportIssuingCountry", e.target.value)}
              placeholder="India" />
          </div>
          <div>
            <Label htmlFor="passport-expiry-date">Passport Expiry Date</Label>
            <Input
              id="passport-expiry-date"
              value={form.passportExpiryDate}
              onChange={e => handleChange("passportExpiryDate", e.target.value)}
              type="date" />
          </div>
          <div>
            <Label htmlFor="pan-number">PAN Number</Label>
            <Input
              id="pan-number"
              value={form.panNumber}
              onChange={e => handleChange("panNumber", e.target.value)}
              placeholder="ABCDE1234F" />
          </div>
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3 mt-4">
          {docStatus === "success" && <span className="text-xs text-green-600 font-medium">Changes saved</span>}
          {docStatus === "error" && <span className="text-xs text-red-500 font-medium">{docError}</span>}
          <Button size="sm" onClick={handleSaveDocuments} disabled={docSaving}>
            {docSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Section>

    </div>
  );
}