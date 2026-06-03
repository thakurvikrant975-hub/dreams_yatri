'use client'

import { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import axios from 'axios';
import Image from 'next/image';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal_Structure';
import { useModal } from '@/app/hooks/useModals';
import Input from '../forms/Input';
import Label from '../forms/Label';
import Button from '../ui/Button';
import { Select, Option } from '../forms/Select';
import { DatePicker } from '../forms/DatePicker';
import { SearchSelect, type SearchSelectOption } from '../forms/SearchSelect';
import { CameraIcon } from '@heroicons/react/24/solid';
import { cn } from '@/app/lib/utils';

type GeoState = {
  countryId:   number | null;
  countryName: string;
  stateId:     number | null;
  stateName:   string;
};

type FormState = {
  name:          string;
  gender:        string;
  maritalStatus: string;
  dateOfBirth:   string;
};

type SaveStatus = "idle" | "saving" | "error";

function OnBoardingModal() {
  const { isOpen, type, closeModal } = useModal();
  const router               = useRouter();
  const fileRef              = useRef<HTMLInputElement>(null);
  const { data: session }    = useSession();

  const [form, setForm] = useState<FormState>({
    name:          "",
    gender:        "",
    maritalStatus: "SINGLE",
    dateOfBirth:   "",
  });

  const [geo, setGeo] = useState<GeoState>({
    countryId:   null,
    countryName: "",
    stateId:     null,
    stateName:   "",
  });

  const [avatarPreview,   setAvatarPreview]   = useState<string | null>(null);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarError,     setAvatarError]     = useState<string | null>(null);

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error,  setError]  = useState("");

  function handleChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleCountryChange(opt: SearchSelectOption) {
    setGeo({ countryId: opt.id, countryName: opt.name, stateId: null, stateName: "" });
  }

  function handleStateChange(opt: SearchSelectOption) {
    setGeo(prev => ({ ...prev, stateId: opt.id, stateName: opt.name }));
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarError(null);
    setAvatarPreview(URL.createObjectURL(file));
    setAvatarUploading(true);

    try {
      const fd = new FormData();
      fd.append("image", file);
      const res  = await fetch("/api/user/avatar", { method: "POST", body: fd });
      const json = await res.json();
      if (!res.ok) {
        setAvatarError(json.error ?? "Upload failed.");
        setAvatarPreview(null);
      }
    } catch {
      setAvatarError("Upload failed. Please try again.");
      setAvatarPreview(null);
    } finally {
      setAvatarUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  async function handleSave() {
    if (!form.name.trim()) { setError("Full name is required."); return; }
    if (!form.gender)       { setError("Please select your gender."); return; }
    if (!form.dateOfBirth)  { setError("Date of birth is required."); return; }
    if (!geo.countryName)   { setError("Please select your country."); return; }
    if (!geo.stateName)     { setError("Please select your state."); return; }

    setStatus("saving");
    setError("");

    try {
      await axios.patch("/api/user/profile", {
        name:          form.name.trim(),
        gender:        form.gender,
        maritalStatus: form.maritalStatus || undefined,
        dateOfBirth:   form.dateOfBirth,
        nationality:   geo.countryName,
        state:         geo.stateName,
      });

      router.refresh();
      closeModal();
    } catch (err: any) {
      const msg = err.response?.data?.error || err.response?.data?.message || "Something went wrong. Please try again.";
      setError(msg);
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  }

  if (!isOpen || type !== 'onboarding-modal') return null;

  return (
    <Modal open={isOpen} onClose={closeModal} data-layout="website" maxWidth="2xl" as="form">
      <ModalHeader onClose={closeModal}>Complete Your Profile</ModalHeader>

      <ModalBody className="overflow-auto">
        <div className="flex flex-col items-center mb-6">
          <div className="relative group inline-block">
            <div className="size-20 rounded-2xl overflow-hidden ring-4 ring-white shadow-lg bg-linear-to-br from-primary-300 to-primary-600 flex items-center justify-center">
              {(avatarPreview ?? session?.user?.image) ? (
                <Image
                  src={(avatarPreview ?? session?.user?.image)!}
                  alt="Profile photo"
                  width={80}
                  height={80}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-2xl font-bold text-white select-none">
                  {form.name.trim() ? form.name.trim()[0].toUpperCase() : '?'}
                </span>
              )}
              {avatarUploading && (
                <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                  <svg className="size-5 animate-spin text-white" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                  </svg>
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={avatarUploading}
              className={cn(
                'absolute -bottom-1.5 -right-1.5 size-7 rounded-lg cursor-pointer',
                'bg-white border border-neutral-200 shadow-md',
                'flex items-center justify-center',
                'hover:bg-primary-50 hover:border-primary/30 transition-all',
                'group-hover:scale-110 disabled:opacity-50'
              )}
              aria-label="Upload profile photo"
            >
              <CameraIcon className="size-3.5 text-primary" />
            </button>

            <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={handleAvatarChange} />
          </div>

          {avatarError && <p className="mt-1.5 text-[11px] text-red-500">{avatarError}</p>}
          <p className="mt-2 text-xs text-neutral-400">Upload a profile photo (optional)</p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name */}
          <div>
            <Label htmlFor="ob-name">Full Name</Label>
            <Input id="ob-name" value={form.name} onChange={e => handleChange("name", e.target.value)} placeholder="Full name" />
          </div>

          {/* Gender */}
          <div>
            <Label htmlFor="ob-gender">Gender</Label>
            <Select id="ob-gender" value={form.gender} onChange={val => handleChange("gender", val)} placeholder="Select your gender">
              <Option value="MALE">Male</Option>
              <Option value="FEMALE">Female</Option>
              <Option value="OTHER">Other</Option>
            </Select>
          </div>

          {/* Marital Status */}
          <div>
            <Label htmlFor="ob-marital">Marital Status</Label>
            <Select id="ob-marital" value={form.maritalStatus} onChange={val => handleChange("maritalStatus", val)} placeholder="Select status">
              <Option value="SINGLE">Single</Option>
              <Option value="MARRIED">Married</Option>
            </Select>
          </div>

          {/* Date of Birth */}
          <div>
            <Label htmlFor="ob-dob">Date of Birth</Label>
            <DatePicker
              id="ob-dob"
              value={form.dateOfBirth}
              onChange={val => handleChange("dateOfBirth", val)}
              placeholder="Select date of birth"
              maxDate={new Date().toISOString().split("T")[0]}
            />
          </div>

          {/* Country */}
          <div>
            <Label htmlFor="ob-country">Country</Label>
            <SearchSelect
              value={geo.countryName}
              placeholder="Search country..."
              fetchUrl="/api/geo/countries"
              onChange={handleCountryChange}
            />
          </div>

          {/* State */}
          <div>
            <Label htmlFor="ob-state">State</Label>
            <SearchSelect
              value={geo.stateName}
              placeholder={geo.countryId ? "Search state..." : "Select country first"}
              fetchUrl="/api/geo/states"
              extraParams={geo.countryId ? { countryId: geo.countryId } : {}}
              onChange={handleStateChange}
              disabled={!geo.countryId}
            />
          </div>

        </div>

        {error && <p className="mt-3 text-xs text-error-500 font-medium">{error}</p>}
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-end gap-3">
          <Button onClick={closeModal} variant="outline" size="sm">Skip for now</Button>
          <Button onClick={handleSave} variant="primary" size="sm" disabled={status === "saving"}>
            {status === "saving" ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

export default OnBoardingModal;
