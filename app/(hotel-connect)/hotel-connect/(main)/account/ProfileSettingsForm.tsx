"use client";

import { useState } from "react";
import { sendMobileOtp, verifyMobileOtp } from "../properties/[id]/edit/tabs/verification-actions";
import { updateOwnerPhone } from "./actions";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { SearchSelect } from "../components/ui/search-select";
import { Card } from "@/app/components/ui/Card";
import { CheckCircleIcon, LockSimpleIcon } from "@phosphor-icons/react/dist/ssr";

const COUNTRY_CODES = [
  { value: "+91",  label: "India +91" },
  { value: "+1",   label: "USA / Canada +1" },
  { value: "+44",  label: "United Kingdom +44" },
  { value: "+61",  label: "Australia +61" },
  { value: "+971", label: "UAE +971" },
  { value: "+65",  label: "Singapore +65" },
  { value: "+94",  label: "Sri Lanka +94" },
  { value: "+977", label: "Nepal +977" },
  { value: "+880", label: "Bangladesh +880" },
];

type VerifyStep = "idle" | "otp_sent" | "verified";

function isValidMobile(cc: string, v: string) {
  if (!v.trim()) return false;
  if (cc === "+91") return /^\d{10}$/.test(v.trim());
  return /^\d{5,15}$/.test(v.trim());
}

export default function ProfileSettingsForm({
  name,
  email,
  emailVerified,
  phone,
  phoneCc,
}: {
  name: string;
  email: string;
  emailVerified: boolean;
  phone: string | null;
  phoneCc: string | null;
}) {
  const [cc, setCc] = useState(phoneCc ?? "+91");
  const [phoneInput, setPhoneInput] = useState(phone ?? "");
  const [verifiedPhone, setVerifiedPhone] = useState(phone);
  const [step, setStep] = useState<VerifyStep>("idle");
  const [otp, setOtp] = useState("");
  const [token, setToken] = useState("");
  const [devOtp, setDevOtp] = useState("");
  const [otpErr, setOtpErr] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);

  function reset() {
    setStep("idle"); setOtp(""); setToken(""); setDevOtp(""); setOtpErr(""); setSaved(false);
  }

  function onPhoneChange(v: string) {
    setPhoneInput(v);
    if (v !== verifiedPhone) setSaved(false);
    if (step !== "idle") reset();
  }

  async function handleSendOtp() {
    setLoading(true); setOtpErr("");
    const res = await sendMobileOtp(cc, phoneInput);
    setLoading(false);
    if (!res.ok) { setOtpErr(res.error ?? "Failed to send OTP"); return; }
    setToken(res.token!); setStep("otp_sent");
    if (res.devOtp) { setDevOtp(res.devOtp); setOtp(res.devOtp); }
  }

  async function handleVerifyOtp() {
    setLoading(true); setOtpErr("");
    const verifyRes = await verifyMobileOtp(cc, phoneInput, otp, token);
    if (!verifyRes.ok) {
      setLoading(false);
      setOtpErr(verifyRes.error ?? "Verification failed");
      return;
    }
    const saveRes = await updateOwnerPhone(cc, phoneInput);
    setLoading(false);
    if (!saveRes.ok) { setOtpErr(saveRes.error ?? "Couldn't save phone number"); return; }
    setStep("verified"); setDevOtp(""); setSaved(true); setVerifiedPhone(phoneInput);
  }

  const canSend = isValidMobile(cc, phoneInput) && phoneInput !== verifiedPhone && step !== "otp_sent";
  const isCurrentAndVerified = step !== "otp_sent" && phoneInput === verifiedPhone && !!verifiedPhone;

  return (
    <Card variant="elevated" radius="md" className="p-5 space-y-5">
      <div>
        <h2 className="text-sm font-semibold text-neutral-800">Profile</h2>
        <p className="text-xs text-neutral-500 mt-0.5">Your name and contact details for this account</p>
      </div>

      <div>
        <Label className="mb-1.5 flex items-center gap-1.5">
          <LockSimpleIcon size={12} className="text-neutral-400" />
          Name
        </Label>
        <Input value={name} disabled className="bg-neutral-50 text-neutral-500" />
        <p className="text-[11px] text-neutral-400 mt-1">Name can't be changed. Contact support if this is incorrect.</p>
      </div>

      <div>
        <Label className="mb-1.5 flex items-center gap-1.5">
          <LockSimpleIcon size={12} className="text-neutral-400" />
          Email
        </Label>
        <div className="relative">
          <Input value={email} disabled className="bg-neutral-50 text-neutral-500 pr-24" />
          {emailVerified && (
            <span className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircleIcon size={13} weight="fill" />
              Verified
            </span>
          )}
        </div>
        <p className="text-[11px] text-neutral-400 mt-1">Email can't be changed. Contact support if this is incorrect.</p>
      </div>

      <div>
        <div className="flex items-center justify-between mb-1.5">
          <Label>Phone Number</Label>
          {isCurrentAndVerified ? (
            <span className="flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <CheckCircleIcon size={13} weight="fill" />
              Verified
            </span>
          ) : (
            <button
              type="button"
              disabled={!canSend || loading}
              onClick={handleSendOtp}
              className="text-xs font-semibold text-primary-500 hover:text-primary-600 disabled:text-neutral-300 disabled:cursor-not-allowed transition-colors"
            >
              {loading && step !== "otp_sent" ? "Sending…" : step === "otp_sent" ? "Resend" : "Verify"}
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <SearchSelect
            options={COUNTRY_CODES}
            value={cc}
            onChange={(v) => { setCc(v); reset(); }}
            showSearch={false}
            disabled={step === "otp_sent"}
            className="w-32 shrink-0"
          />
          <Input
            type="tel"
            maxLength={15}
            value={phoneInput}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, ""))}
            placeholder="Enter number"
            disabled={step === "otp_sent"}
            className="flex-1"
          />
        </div>

        {step === "otp_sent" && (
          <div className="mt-2 space-y-1.5">
            {devOtp && (
              <p className="text-xs text-amber-600 font-medium bg-amber-50 border border-amber-200 rounded px-2 py-1">
                Dev — OTP: <span className="font-mono">{devOtp}</span>
              </p>
            )}
            <div className="flex gap-2 items-center">
              <Input
                type="text" inputMode="numeric" maxLength={6} value={otp}
                onChange={(e) => { setOtp(e.target.value.replace(/\D/g, "")); setOtpErr(""); }}
                placeholder="6-digit OTP" aria-label="One-time passcode" className="max-w-37.5 font-mono tracking-widest"
              />
              <button
                type="button" disabled={otp.length !== 6 || loading} onClick={handleVerifyOtp}
                className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-primary-500 hover:bg-primary-600 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? "Verifying…" : "Confirm"}
              </button>
            </div>
          </div>
        )}
        {step !== "otp_sent" && otpErr && <p className="text-xs text-red-500 mt-1">{otpErr}</p>}
        {saved && step === "verified" && (
          <p className="text-xs text-emerald-600 mt-1.5">Phone number updated.</p>
        )}
      </div>
    </Card>
  );
}
