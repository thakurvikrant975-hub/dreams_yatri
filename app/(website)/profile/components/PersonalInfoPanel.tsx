'use client'

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Section } from "./Section";
import Button from "@/app/components/ui/Button";
import Label from "@/app/components/forms/Label";
import Input from "@/app/components/forms/Input";
import { Select, Option } from "@/app/components/forms/Select";
import { SearchSelect, type SearchSelectOption } from "@/app/components/forms/SearchSelect";
import { DatePicker } from "@/app/components/forms/DatePicker";

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

type GeoState = {
  countryId: number | null;
  countryName: string;
  stateId: number | null;
  stateName: string;
  cityName: string;
};

function toDateString(val: Date | string | null): string {
  if (!val) return "";
  return new Date(val).toISOString().split("T")[0];
}

function buildForm(info: UserBasicInfo) {
  return {
    name:                   info.name                ?? "",
    email:                  info.email               ?? "",
    phone:                  info.phone               ?? "",
    country_code:           info.country_code        ?? "+91",
    dateOfBirth:            toDateString(info.dateOfBirth),
    city:                   info.city                ?? "",
    state:                  info.state               ?? "",
    gender:                 info.gender              ?? "",
    nationality:            info.nationality         ?? "",
    maritalStatus:          info.maritalStatus       ?? "",
    anniversary:            toDateString(info.anniversary),
    passportNumber:         info.passportNumber      ?? "",
    passportExpiryDate:     toDateString(info.passportExpiryDate),
    passportIssuingCountry: info.passportIssuingCountry ?? "",
    panNumber:              info.panNumber           ?? "",
  };
}

function buildGeo(info: UserBasicInfo): GeoState {
  return {
    countryId:   null,
    countryName: info.nationality ?? "",
    stateId:     null,
    stateName:   info.state       ?? "",
    cityName:    info.city        ?? "",
  };
}

export function PersonalInfoPanel({ userBasicInfo }: { userBasicInfo: UserBasicInfo }) {
  const router = useRouter();

  const [form, setForm] = useState(() => buildForm(userBasicInfo));
  const [geo,  setGeo]  = useState(() => buildGeo(userBasicInfo));

  // Sync form + geo when server re-fetches data after save (router.refresh)
  const prevInfoRef = useRef(userBasicInfo);
  useEffect(() => {
    if (prevInfoRef.current !== userBasicInfo) {
      prevInfoRef.current = userBasicInfo;
      setForm(buildForm(userBasicInfo));
      setGeo(buildGeo(userBasicInfo));
    }
  }, [userBasicInfo]);

  // ── Separate state per section ─────────────────────────────────────────────
  const [basicSaving, setBasicSaving] = useState(false);
  const [basicStatus, setBasicStatus] = useState<SaveStatus>("idle");
  const [basicError, setBasicError] = useState("");

  const [contactSaving, setContactSaving] = useState(false);
  const [contactStatus, setContactStatus] = useState<SaveStatus>("idle");
  const [contactError, setContactError] = useState("");

  const [docSaving, setDocSaving] = useState(false);
  const [docStatus, setDocStatus] = useState<SaveStatus>("idle");
  const [docError, setDocError] = useState("");

  function handleCountryChange(opt: SearchSelectOption) {
    setGeo({
      countryId: opt.id,
      countryName: opt.name,
      stateId: null,   // ← reset downstream
      stateName: "",
      cityName: "",
    });
  }

  function handleStateChange(opt: SearchSelectOption) {
    setGeo(prev => ({
      ...prev,
      stateId: opt.id,
      stateName: opt.name,
      cityName: "",       // ← reset downstream
    }));
  }

  function handleCityChange(opt: SearchSelectOption) {
    setGeo(prev => ({
      ...prev,
      cityName: opt.name, // id -1 = custom, still stored as name
    }));
  }

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
          name:         form.name         || undefined,
          email:        form.email        || undefined,
          gender:       form.gender       || undefined,
          dateOfBirth:  form.dateOfBirth  || undefined,
          maritalStatus: form.maritalStatus || undefined,
          anniversary:  form.anniversary  || undefined,
          country_code: form.country_code || undefined,
          nationality:  geo.countryName   || form.nationality || undefined,
          state:        geo.stateName     || form.state       || undefined,
          city:         geo.cityName      || form.city        || undefined,
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

  async function handleSaveContact() {
    setContactSaving(true);
    setContactStatus("idle");
    setContactError("");

    try {
      const res = await fetch("/api/user/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: form.email || undefined,
        }),
      });

      const json = await res.json();
      if (!res.ok) { setContactError(json.error ?? "Update failed."); setContactStatus("error"); return; }
      setContactStatus("success");
      router.refresh();
    } catch {
      setContactError("Network error. Please try again.");
      setContactStatus("error");
    } finally {
      setContactSaving(false);
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
            <Label htmlFor="full-name" required>Full Name</Label>
            <Input
              id="full-name"
              value={form.name}
              onChange={e => handleChange("name", e.target.value)}
              placeholder="Enter full name" autoFocus />
          </div>

          <div>
            <Label htmlFor="date-of-birth">Date of Birth</Label>
            <DatePicker
              id="date-of-birth"
              value={form.dateOfBirth}
              onChange={val => handleChange("dateOfBirth", val)}
              placeholder="Select date of birth"
              maxDate={new Date().toISOString().split("T")[0]}
            />
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
              <Option value="MALE">Male</Option>
              <Option value="FEMALE">Female</Option>
              <Option value="OTHER">Other</Option>
              <Option value="">Prefer not to say</Option>
            </Select>
          </div>

          <div>
            <Label htmlFor="country">Country</Label>
            <SearchSelect
              value={geo.countryName}
              placeholder="Search country..."
              fetchUrl="/api/geo/countries"
              onChange={handleCountryChange}
            />
          </div>

          {/* State — disabled until country selected */}
          <div>
            <Label htmlFor="state">State</Label>
            <SearchSelect
              value={geo.stateName}
              placeholder={geo.countryId ? "Search state..." : "Search state..."}
              fetchUrl="/api/geo/states"
              extraParams={geo.countryId ? { countryId: geo.countryId } : {}}
              onChange={handleStateChange}
              disabled={!geo.countryId && !geo.countryName}
            />
          </div>

          {/* City — disabled until state selected, allows custom */}
          <div>
            <Label htmlFor="city">City</Label>
            <SearchSelect
              value={geo.cityName}
              placeholder="Search city..."
              fetchUrl="/api/geo/cities"
              extraParams={geo.stateId ? { stateId: geo.stateId } : {}}
              onChange={handleCityChange}
              disabled={!geo.stateId && !geo.stateName}
              allowCustom={true}
            />
          </div>

          <div>
            <Label htmlFor="marital-status">
              Marital Status
            </Label>
            <Select
              id="marital-status"
              value={form.maritalStatus}
              onChange={val => handleChange("maritalStatus", val)}
              placeholder="Your Marital Status  "
              className="h-11"
            >
              <Option value="SINGLE">Single</Option>
              <Option value="MARRIED">Married</Option>
            </Select>
          </div>

          <div>
            <Label htmlFor="anniversary">
              Anniversary
            </Label>
            <DatePicker
              id="anniversary"
              value={form.anniversary}
              onChange={val => handleChange("anniversary", val)}
              placeholder="Select anniversary"
            />
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
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 ">
          <div>
            <Label htmlFor="phone-number">Phone Number</Label>
            <div className="flex flex-row items-stretch gap-2">
              <div className="min-w-18 h-11 flex items-center justify-center px-3 rounded-lg border border-neutral-200 bg-neutral-50 text-sm font-medium text-neutral-500 select-none">
                {form.country_code || '+91'}
              </div>
              <Input
                id="phone-number"
                value={
                  form.country_code && form.phone.startsWith(form.country_code)
                    ? form.phone.slice(form.country_code.length)
                    : form.phone
                }
                readOnly
                disabled
                placeholder="Phone number"
                wrapperClassName="flex-1"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="email">Email Address</Label>
            <Input
              id="email"
              value={form.email}
              onChange={e => handleChange("email", e.target.value)}
              placeholder="you@example.com" />
          </div>

        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[--border] pt-3 mt-4">
          {contactStatus === "success" && <span className="text-xs text-green-600 font-medium">Changes saved</span>}
          {contactStatus === "error" && <span className="text-xs text-red-500 font-medium">{contactError}</span>}
          <Button size="sm" onClick={handleSaveContact} disabled={contactSaving}>
            {contactSaving ? "Saving…" : "Save Changes"}
          </Button>
        </div>
      </Section>

      {/* ── Travel Documents ───────────────────────────────────────────── */}
      <Section title="Travel Documents" subtitle="Passport and PAN details">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="email">Passport Number</Label>
            <Input
              id="text"
              value={form.passportNumber}
              onChange={e => handleChange("passportNumber", e.target.value)}
              placeholder="A1234567" />
          </div>
          <div>
            <Label htmlFor="passport-issuing-country">Passport Issuing Country</Label>
            <SearchSelect
              value={geo.countryName}
              placeholder="Search country..."
              fetchUrl="/api/geo/countries"
              onChange={handleCountryChange}
            />
          </div>
          <div>
            <Label htmlFor="passport-expiry-date">Passport Expiry Date</Label>
          <DatePicker
              id="passport-expiry-date"
              value={form.passportExpiryDate}
              onChange={val => handleChange("passportExpiryDate", val)}
              placeholder="Select passport expiry date"
              minDate={new Date().toISOString().split("T")[0]}
            />
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