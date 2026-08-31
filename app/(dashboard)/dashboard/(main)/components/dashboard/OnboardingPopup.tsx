"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Heart, Sparkles, CalendarClock, HelpCircle } from "lucide-react";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Checkbox } from "../ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "../ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "../ui/tabs";
import { ImageUpload, type UploadedImage } from "./ImageUpload";
import { completeOnboardingProfile, type ProfileFormState } from "../../profile/actions";
import type { ProfileData } from "../../profile/ProfileClient";
import { cn } from "@/app/lib/utils";

type Gender = "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
type NameTitle = "MR" | "MRS" | "LATE_MR" | "LATE_MRS";

// Which tab each server-side error key lives on — used to jump to whichever
// tab actually has the problem instead of guessing from a couple of names.
const PERSONAL_ERROR_KEYS = ["gender", "personalEmail", "personalMobile", "alternativeMobile", "officialMobile", "joiningDate"];
const FAMILY_ERROR_KEYS = ["fatherName", "fatherMobile", "motherName", "motherMobile", "aadhaarNumber", "panNumber"];

const GENDER_OPTIONS: { value: Gender; label: string; strip: string; ring: string }[] = [
  { value: "MALE", label: "Male 💙", strip: "bg-blue-500", ring: "ring-blue-400/60 bg-blue-50 dark:bg-blue-950/30" },
  { value: "FEMALE", label: "Female 💗", strip: "bg-pink-500", ring: "ring-pink-400/60 bg-pink-50 dark:bg-pink-950/30" },
  {
    value: "PREFER_NOT_TO_SAY", label: "Can't say 🫣",
    strip: "bg-gradient-to-r from-red-500 via-yellow-400 via-green-500 via-blue-500 to-purple-500",
    ring: "ring-purple-400/60 bg-gradient-to-r from-red-50 via-yellow-50 to-purple-50 dark:from-red-950/20 dark:via-yellow-950/10 dark:to-purple-950/20",
  },
];

/** Open state is controlled by the caller: the dashboard layout auto-opens it
 * the first time a required field is missing (see `needsOnboarding` there),
 * and the header's ProfileCompletionBadge opens the same instance on demand
 * so someone can review or edit these details anytime, not just when gated.
 * Dismissible either way (this isn't a hostage situation) — closing it via
 * Radix's own triggers (X, Escape, outside click) snoozes the auto-gate for
 * ten minutes without affecting the header button. */
export function OnboardingPopup({
  profile, open, onOpenChange,
}: {
  profile: ProfileData;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"personal" | "family">("personal");
  const [isPending, startTransition] = useTransition();
  const [errors, setErrors] = useState<Record<string, string[]> | undefined>();

  const [gender, setGender] = useState<Gender | null>(profile.gender);
  const [personalEmail, setPersonalEmail] = useState(profile.personalEmail ?? "");
  const [personalMobile, setPersonalMobile] = useState(profile.personalMobile ?? "");
  const [alternativeMobile, setAlternativeMobile] = useState(profile.alternativeMobile ?? "");
  const [officialMobile, setOfficialMobile] = useState(profile.officialMobile ?? "");
  const [joiningDate, setJoiningDate] = useState(
    profile.joiningDate ? new Date(profile.joiningDate).toISOString().slice(0, 10) : "",
  );
  const [joiningDateUnknown, setJoiningDateUnknown] = useState(profile.joiningDateUnknown);

  const [fatherName, setFatherName] = useState(profile.fatherName ?? "");
  const [fatherTitle, setFatherTitle] = useState(profile.fatherTitle ?? "MR");
  const [fatherMobile, setFatherMobile] = useState(profile.fatherMobile ?? "");
  const [motherName, setMotherName] = useState(profile.motherName ?? "");
  const [motherTitle, setMotherTitle] = useState(profile.motherTitle ?? "MRS");
  const [motherMobile, setMotherMobile] = useState(profile.motherMobile ?? "");
  const [aadhaarNumber, setAadhaarNumber] = useState(profile.aadhaarNumber ?? "");
  const [panNumber, setPanNumber] = useState(profile.panNumber ?? "");
  const [aadhaarFront, setAadhaarFront] = useState<UploadedImage | null>(
    profile.aadhaarFileKey ? { key: profile.aadhaarFileKey, url: profile.aadhaarFileUrl ?? "" } : null,
  );
  const [aadhaarBack, setAadhaarBack] = useState<UploadedImage | null>(
    profile.aadhaarBackFileKey ? { key: profile.aadhaarBackFileKey, url: profile.aadhaarBackFileUrl ?? "" } : null,
  );
  const [panFile, setPanFile] = useState<UploadedImage | null>(
    profile.panFileKey ? { key: profile.panFileKey, url: profile.panFileUrl ?? "" } : null,
  );

  function handleSubmit() {
    if (!gender || !personalEmail.trim() || !personalMobile.trim() || !alternativeMobile.trim()
      || (!joiningDate && !joiningDateUnknown)) {
      setTab("personal");
      toast.error("Just a little more — the required fields on this tab are still waiting for you 🥺");
      return;
    }

    startTransition(async () => {
      const fd = new FormData();
      fd.append("gender", gender);
      fd.append("personalEmail", personalEmail);
      fd.append("personalMobile", personalMobile);
      fd.append("alternativeMobile", alternativeMobile);
      if (officialMobile) fd.append("officialMobile", officialMobile);
      if (joiningDate) fd.append("joiningDate", joiningDate);
      fd.append("joiningDateUnknown", String(joiningDateUnknown));
      if (fatherName) { fd.append("fatherName", fatherName); fd.append("fatherTitle", fatherTitle); }
      if (fatherMobile) fd.append("fatherMobile", fatherMobile);
      if (motherName) { fd.append("motherName", motherName); fd.append("motherTitle", motherTitle); }
      if (motherMobile) fd.append("motherMobile", motherMobile);
      if (aadhaarNumber) fd.append("aadhaarNumber", aadhaarNumber);
      if (panNumber) fd.append("panNumber", panNumber);
      if (aadhaarFront?.key) { fd.append("aadhaarFileKey", aadhaarFront.key); fd.append("aadhaarFileUrl", aadhaarFront.url); }
      if (aadhaarBack?.key) { fd.append("aadhaarBackFileKey", aadhaarBack.key); fd.append("aadhaarBackFileUrl", aadhaarBack.url); }
      if (panFile?.key) { fd.append("panFileKey", panFile.key); fd.append("panFileUrl", panFile.url); }

      const result: ProfileFormState = await completeOnboardingProfile({ success: false, message: "" }, fd);
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        setErrors(undefined);
        router.refresh();
      } else {
        toast.error(result.message);
        setErrors(result.errors);
        const keys = Object.keys(result.errors ?? {});
        if (keys.some((k) => PERSONAL_ERROR_KEYS.includes(k))) setTab("personal");
        else if (keys.some((k) => FAMILY_ERROR_KEYS.includes(k))) setTab("family");
      }
    });
  }

  const selectedGender = GENDER_OPTIONS.find((g) => g.value === gender);

  // Only reached by Radix's own close triggers (X button, Escape, outside
  // click) — the success path above calls onOpenChange directly, not this,
  // so completing the form never sets a snooze it doesn't need. The layout
  // checks this same cookie server-side and skips auto-opening the popup
  // while it's live, so dismissing it genuinely buys ten quiet minutes
  // rather than just hiding this one render.
  function handleOpenChange(next: boolean) {
    if (!next) document.cookie = "dy_onboarding_snooze=1; max-age=600; path=/";
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            May I know you <span aria-hidden> Dear 🥰</span>
          </DialogTitle>
          <DialogDescription>
            A few details so the team can actually take care of you.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as "personal" | "family")}>
          <TabsList className="w-full">
            <TabsTrigger value="personal">Personal Details</TabsTrigger>
            <TabsTrigger value="family">Family Details</TabsTrigger>
          </TabsList>

          <TabsContent value="personal" className="space-y-4 pt-4">
            <div className="space-y-1.5">
              <Label>That&apos;s you</Label>
              <Input value={profile.name} disabled />
            </div>

            <div className="space-y-1.5">
              <Label>
                Gender <span className="text-destructive">*</span>
              </Label>
              <div className="grid grid-cols-3 gap-2">
                {GENDER_OPTIONS.map((g) => (
                  <button
                    key={g.value}
                    type="button"
                    onClick={() => setGender(g.value)}
                    className={cn(
                      "relative rounded-xl border px-2 py-2.5 text-xs font-medium transition-all cursor-pointer overflow-hidden",
                      gender === g.value
                        ? cn("border-transparent ring-2", g.ring)
                        : "border-dashboard-base-300 hover:bg-dashboard-base-200/60",
                    )}
                  >
                    {g.label}
                    {gender === g.value && (
                      <span className={cn("absolute inset-x-0 bottom-0 h-1", g.strip)} />
                    )}
                  </button>
                ))}
              </div>
              {selectedGender?.value === "PREFER_NOT_TO_SAY" && (
                <p className="flex items-center gap-1 text-[11px] text-dashboard-base-content/60">
                  <Sparkles size={11} /> All love, no labels. 🏳️‍🌈
                </p>
              )}
              {errors?.gender && <p className="text-xs text-destructive">{errors.gender[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>
                Date of Joining <span className="text-destructive">*</span>
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={joiningDate}
                  disabled={joiningDateUnknown}
                  onChange={(e) => setJoiningDate(e.target.value)}
                  className="flex-1"
                />
                <CalendarClock size={16} className="shrink-0 text-dashboard-base-content/40" />
              </div>
              <Checkbox
                checked={joiningDateUnknown}
                onChange={() => setJoiningDateUnknown((v) => !v)}
                label={
                  <span className="flex items-center gap-1 text-xs text-dashboard-base-content/70">
                    <HelpCircle size={12} /> I don&apos;t remember 🤷
                  </span>
                }
              />
              {errors?.joiningDate && <p className="text-xs text-destructive">{errors.joiningDate[0]}</p>}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>
                  Personal Mobile <span className="text-destructive">*</span>
                </Label>
                <Input value={personalMobile} onChange={(e) => setPersonalMobile(e.target.value)} placeholder="9876543210" />
                {errors?.personalMobile && <p className="text-xs text-destructive">{errors.personalMobile[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Alternate Mobile</Label>
                <Input value={alternativeMobile} onChange={(e) => setAlternativeMobile(e.target.value)} placeholder="9876543210" />
                {errors?.alternativeMobile && <p className="text-xs text-destructive">{errors.alternativeMobile[0]}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Official Mobile</Label>
              <Input value={officialMobile} onChange={(e) => setOfficialMobile(e.target.value)} placeholder="9876543210" />
              {errors?.officialMobile && <p className="text-xs text-destructive">{errors.officialMobile[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>
                Personal Email <span className="text-destructive">*</span>
              </Label>
              <Input type="email" value={personalEmail} onChange={(e) => setPersonalEmail(e.target.value)} placeholder="you@example.com" />
              {errors?.personalEmail && <p className="text-xs text-destructive">{errors.personalEmail[0]}</p>}
            </div>

            <div className="space-y-1.5">
              <Label>Professional Email (will be)</Label>
              <Input value={profile.email} disabled />
            </div>
          </TabsContent>

          <TabsContent value="family" className="space-y-4 pt-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Father&apos;s Name</Label>
                <div className="flex gap-1.5">
                  <select
                    value={fatherTitle}
                    onChange={(e) => setFatherTitle(e.target.value as NameTitle)}
                    className="h-9 w-18 shrink-0 rounded-md border border-input bg-background px-1.5 text-sm"
                  >
                    <option value="MR">Mr.</option>
                    <option value="LATE_MR">Late Mr.</option>
                  </select>
                  <Input value={fatherName} onChange={(e) => setFatherName(e.target.value)} className="flex-1" />
                </div>
                {errors?.fatherName && <p className="text-xs text-destructive">{errors.fatherName[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Father&apos;s Mobile</Label>
                <Input value={fatherMobile} onChange={(e) => setFatherMobile(e.target.value)} placeholder="9876543210" />
                {errors?.fatherMobile && <p className="text-xs text-destructive">{errors.fatherMobile[0]}</p>}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Mother&apos;s Name</Label>
                <div className="flex gap-1.5">
                  <select
                    value={motherTitle}
                    onChange={(e) => setMotherTitle(e.target.value as NameTitle)}
                    className="h-9 w-18 shrink-0 rounded-md border border-input bg-background px-1.5 text-sm"
                  >
                    <option value="MRS">Mrs.</option>
                    <option value="LATE_MRS">Late Mrs.</option>
                  </select>
                  <Input value={motherName} onChange={(e) => setMotherName(e.target.value)} className="flex-1" />
                </div>
                {errors?.motherName && <p className="text-xs text-destructive">{errors.motherName[0]}</p>}
              </div>
              <div className="space-y-1.5">
                <Label>Mother&apos;s Mobile</Label>
                <Input value={motherMobile} onChange={(e) => setMotherMobile(e.target.value)} placeholder="9876543210" />
                {errors?.motherMobile && <p className="text-xs text-destructive">{errors.motherMobile[0]}</p>}
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Aadhaar Number</Label>
              <Input
                value={aadhaarNumber}
                onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, "").slice(0, 12))}
                placeholder="123456789012"
                maxLength={12}
              />
              {errors?.aadhaarNumber && <p className="text-xs text-destructive">{errors.aadhaarNumber[0]}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <ImageUpload
                name="_aadhaar_front_unused" label="Aadhaar Front" folder="team-members"
                aspectRatio="wide" maxSizeMB={2} value={aadhaarFront} onChange={setAadhaarFront}
              />
              <ImageUpload
                name="_aadhaar_back_unused" label="Aadhaar Back" folder="team-members"
                aspectRatio="wide" maxSizeMB={2} value={aadhaarBack} onChange={setAadhaarBack}
              />
            </div>

            <div className="space-y-1.5">
              <Label>PAN Number</Label>
              <Input
                value={panNumber}
                onChange={(e) => setPanNumber(e.target.value.toUpperCase().slice(0, 10))}
                placeholder="ABCDE1234F"
                maxLength={10}
              />
              {errors?.panNumber && <p className="text-xs text-destructive">{errors.panNumber[0]}</p>}
            </div>
            <ImageUpload
              name="_pan_unused" label="Upload PAN Card" folder="team-members"
              aspectRatio="wide" maxSizeMB={2} value={panFile} onChange={setPanFile}
            />
          </TabsContent>
        </Tabs>

        <div className="flex items-center justify-between gap-3 pt-2">
          {tab === "personal" ? (
            <>
              <span className="text-[11px] text-dashboard-base-content/50">Not now? Close this and I&apos;ll leave you alone for 10 minutes 👋</span>
              <Button type="button" onClick={() => setTab("family")}>
                Next →
              </Button>
            </>
          ) : (
            <>
              <Button type="button" variant="outline" onClick={() => setTab("personal")}>
                ← Back
              </Button>
              <Button type="button" onClick={handleSubmit} disabled={isPending} className="gap-1.5">
                <Heart size={14} />
                {isPending ? "Saving…" : "All done!"}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
