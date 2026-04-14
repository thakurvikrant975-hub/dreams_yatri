'use client'

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import Modal, { ModalHeader, ModalBody, ModalFooter } from './Modal_Structure';
import { useModal } from '@/app/hooks/useModals';
import Input from '../forms/Input';
import Label from '../forms/Label';
import Button from '../ui/Button';
import { Select, Option } from '../forms/Select';
import { DatePicker } from '../forms/DatePicker';
import { SearchSelect, type SearchSelectOption } from '../forms/SearchSelect';

type GeoState = {
  countryId:   number | null;
  countryName: string;
  stateId:     number | null;
  stateName:   string;
  cityName:    string;
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
  const router = useRouter();

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
    cityName:    "",
  });

  const [status, setStatus] = useState<SaveStatus>("idle");
  const [error,  setError]  = useState("");

  // ── Form field handler ─────────────────────────────────────────────────────
  function handleChange(field: keyof FormState, value: string) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  // ── Geo cascading handlers ─────────────────────────────────────────────────
  function handleCountryChange(opt: SearchSelectOption) {
    setGeo({
      countryId:   opt.id,
      countryName: opt.name,
      stateId:     null,
      stateName:   "",
      cityName:    "",
    });
  }

  function handleStateChange(opt: SearchSelectOption) {
    setGeo(prev => ({
      ...prev,
      stateId:  opt.id,
      stateName: opt.name,
      cityName:  "",
    }));
  }

  function handleCityChange(opt: SearchSelectOption) {
    setGeo(prev => ({ ...prev, cityName: opt.name }));
  }

  // ── Submit ─────────────────────────────────────────────────────────────────
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
        name:          form.name,
        gender:        form.gender,
        maritalStatus: form.maritalStatus || undefined,
        dateOfBirth:   form.dateOfBirth,
        nationality:   geo.countryName,
        state:         geo.stateName,
        city:          geo.cityName || undefined,
      });

      router.refresh();
      closeModal();
    } catch (err: any) {
      setError(err.response?.data?.error || "Something went wrong. Please try again.");
      setStatus("error");
    } finally {
      setStatus("idle");
    }
  }

  if (!isOpen || type !== 'onboarding-modal') return null;

  return (
    <Modal
      open={isOpen}
      onClose={closeModal}
      data-layout="website"
      maxWidth="2xl"
      as='form'
    >
      <ModalHeader onClose={closeModal}>
        Complete Your Profile
      </ModalHeader>

      <ModalBody className="min-h-70 overflow-auto">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Name */}
          <div>
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              value={form.name}
              onChange={e => handleChange("name", e.target.value)}
              placeholder="Enter your full name"
            />
          </div>

          {/* Gender */}
          <div>
            <Label htmlFor="gender">Gender</Label>
            <Select
              id="gender"
              value={form.gender}
              onChange={val => handleChange("gender", val)}
              placeholder="Select your gender"
            >
              <Option value="MALE">Male</Option>
              <Option value="FEMALE">Female</Option>
              <Option value="OTHER">Other</Option>
              <Option value="PREFER_NOT_TO_SAY">Prefer not to say</Option>
            </Select>
          </div>

          {/* Marital Status */}
          <div>
            <Label htmlFor="marital-status">Marital Status</Label>
            <Select
              id="marital-status"
              value={form.maritalStatus}
              onChange={val => handleChange("maritalStatus", val)}
              placeholder="Select status"
            >
              <Option value="SINGLE">Single</Option>
              <Option value="MARRIED">Married</Option>
            </Select>
          </div>

          {/* Date of Birth */}
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

          {/* Country */}
          <div>
            <Label htmlFor="country">Country</Label>
            <SearchSelect
              value={geo.countryName}
              placeholder="Search country..."
              fetchUrl="/api/geo/countries"
              onChange={handleCountryChange}
            />
          </div>

          {/* State */}
          <div>
            <Label htmlFor="state">State</Label>
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

        {/* Error */}
        {error && (
          <p className="mt-3 text-xs text-error-500 font-medium">{error}</p>
        )}
      </ModalBody>

      <ModalFooter>
        <div className="flex items-center justify-end gap-3">
          <Button onClick={closeModal} variant="outline" size="sm">
            Skip for now
          </Button>
          <Button
            onClick={handleSave}
            variant="primary"
            size="sm"
            disabled={status === "saving"}
          >
            {status === "saving" ? "Saving..." : "Save & Continue"}
          </Button>
        </div>
      </ModalFooter>
    </Modal>
  );
}

export default OnBoardingModal;