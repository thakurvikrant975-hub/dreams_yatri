'use client'

import { useState }      from "react";
import { useRouter }     from "next/navigation";
import { Section }       from "./Section";
import { EditableField } from "./EditableField";
import Button            from "@/app/components/ui/Button";

interface UserBasicInfo {
  name:                   string | null;
  email:                  string | null;
  phone:                  string | null;
  country_code:           string;
  dateOfBirth:            Date | string | null;
  city:                   string | null;
  state:                  string | null;
  gender:                 string | null;
  nationality:            string | null;
  maritalStatus:          string | null;
  anniversary:            Date | string | null;
  passportNumber:         string | null;
  passportExpiryDate:     Date | string | null;
  passportIssuingCountry: string | null;
  panNumber:              string | null;
}

type SaveStatus = "idle" | "success" | "error";

function toDateString(val: Date | string | null): string {
  if (!val) return "";
  return new Date(val).toISOString().split("T")[0];
}

export function PersonalInfoPanel({ userBasicInfo }: { userBasicInfo: UserBasicInfo }) {
  const router = useRouter();

  const [form, setForm] = useState({
    name:                   userBasicInfo.name                   ?? "",
    email:                  userBasicInfo.email                  ?? "",
    phone:                  userBasicInfo.phone                  ?? "",
    country_code:           userBasicInfo.country_code           ?? "+91",
    dateOfBirth:            toDateString(userBasicInfo.dateOfBirth),
    city:                   userBasicInfo.city                   ?? "",
    state:                  userBasicInfo.state                  ?? "",
    gender:                 userBasicInfo.gender                 ?? "",
    nationality:            userBasicInfo.nationality            ?? "",
    maritalStatus:          userBasicInfo.maritalStatus          ?? "",
    anniversary:            toDateString(userBasicInfo.anniversary),
    passportNumber:         userBasicInfo.passportNumber         ?? "",
    passportExpiryDate:     toDateString(userBasicInfo.passportExpiryDate),
    passportIssuingCountry: userBasicInfo.passportIssuingCountry ?? "",
    panNumber:              userBasicInfo.panNumber              ?? "",
  });

  // ── Separate state per section ─────────────────────────────────────────────
  const [basicSaving,     setBasicSaving]     = useState(false);
  const [basicStatus,     setBasicStatus]     = useState<SaveStatus>("idle");
  const [basicError,      setBasicError]      = useState("");

  const [docSaving,       setDocSaving]       = useState(false);
  const [docStatus,       setDocStatus]       = useState<SaveStatus>("idle");
  const [docError,        setDocError]        = useState("");

  function handleChange(field: keyof typeof form, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  async function handleSaveBasic() {
    setBasicSaving(true);
    setBasicStatus("idle");
    setBasicError("");

    try {
      const res = await fetch("/api/user/profile", {
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          name:          form.name          || undefined,
          email:         form.email         || undefined,
          gender:        form.gender        || undefined,
          dateOfBirth:   form.dateOfBirth   || undefined,
          nationality:   form.nationality   || undefined,
          state:         form.state         || undefined,
          city:          form.city          || undefined,
          maritalStatus: form.maritalStatus || undefined,
          anniversary:   form.anniversary   || undefined,
          country_code:  form.country_code  || undefined,
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
        method:  "PATCH",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          passportNumber:         form.passportNumber         || undefined,
          passportExpiryDate:     form.passportExpiryDate     || undefined,
          passportIssuingCountry: form.passportIssuingCountry || undefined,
          panNumber:              form.panNumber              || undefined,
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
          <EditableField label="Full Name"      value={form.name}          onChange={v => handleChange("name", v)}          placeholder="Enter full name" />
          <EditableField label="Email Address"  value={form.email}         onChange={v => handleChange("email", v)}         type="email" />
          <EditableField label="Phone Number"   value={form.phone}         onChange={v => handleChange("phone", v)}         type="tel" />
          <EditableField label="Country Code"   value={form.country_code}  onChange={v => handleChange("country_code", v)} placeholder="+91" />
          <EditableField label="Date of Birth"  value={form.dateOfBirth}   onChange={v => handleChange("dateOfBirth", v)}   type="date" />
          <EditableField label="Gender"         value={form.gender}        onChange={v => handleChange("gender", v)}        placeholder="MALE / FEMALE / OTHER" />
          <EditableField label="Nationality"    value={form.nationality}   onChange={v => handleChange("nationality", v)}   placeholder="Indian" />
          <EditableField label="State"          value={form.state}         onChange={v => handleChange("state", v)}         placeholder="Himachal Pradesh" />
          <EditableField label="City"           value={form.city}          onChange={v => handleChange("city", v)}          placeholder="Shimla" />
          <EditableField label="Marital Status" value={form.maritalStatus} onChange={v => handleChange("maritalStatus", v)} placeholder="SINGLE / MARRIED" />
          <EditableField label="Anniversary"    value={form.anniversary}   onChange={v => handleChange("anniversary", v)}   type="date" />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3 mt-4">
          {basicStatus === "success" && <span className="text-xs text-green-600 font-medium">Changes saved</span>}
          {basicStatus === "error"   && <span className="text-xs text-red-500 font-medium">{basicError}</span>}
          <Button size="sm" onClick={handleSaveBasic} disabled={basicSaving}>
            {basicSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Section>

      {/* ── Travel Documents ───────────────────────────────────────────── */}
      <Section title="Travel Documents" subtitle="Passport and PAN details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <EditableField label="Passport Number"          value={form.passportNumber}         onChange={v => handleChange("passportNumber", v)}         placeholder="A1234567" />
          <EditableField label="Passport Expiry Date"     value={form.passportExpiryDate}     onChange={v => handleChange("passportExpiryDate", v)}     type="date" />
          <EditableField label="Passport Issuing Country" value={form.passportIssuingCountry} onChange={v => handleChange("passportIssuingCountry", v)} placeholder="India" />
          <EditableField label="PAN Number"               value={form.panNumber}              onChange={v => handleChange("panNumber", v)}              placeholder="ABCDE1234F" />
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3 mt-4">
          {docStatus === "success" && <span className="text-xs text-green-600 font-medium">Changes saved</span>}
          {docStatus === "error"   && <span className="text-xs text-red-500 font-medium">{docError}</span>}
          <Button size="sm" onClick={handleSaveDocuments} disabled={docSaving}>
            {docSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Section>

    </div>
  );
}