"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Checkbox } from "../../components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogTrigger,
} from "../../components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "../../components/ui/select";
import {
  computeEffectiveWizardStep, totalTabsFor, wizardCompletenessPct,
} from "@/app/(hotel-connect)/hotel-connect/(main)/properties/[id]/edit/wizard-progress";
import { getHotelMigrationPreview, migrateHotelToHotelConnect, type MigrationPreview } from "../actions";

type PropertyCategoryValue = "HOTEL" | "HOMESTAY_VILLA";

const PROPERTY_CATEGORIES: { value: PropertyCategoryValue; label: string }[] = [
  { value: "HOTEL", label: "Hotel" },
  { value: "HOMESTAY_VILLA", label: "Homestay / Villa" },
];

const PROPERTY_SUB_TYPES = [
  "HOTEL", "RESORT", "GUEST_HOUSE", "HOUSEBOAT", "VILLA", "HOMESTAY", "APARTMENT", "LODGE",
  "PALACE", "MOTEL", "COTTAGE", "APART_HOTEL", "HOSTEL", "BED_AND_BREAKFAST", "FARMHOUSE",
  "CAMP", "BEACH_HUT", "TREEHOUSE", "DHARAMSHALA", "ASHRAM", "HOLIDAY_HOME", "RV", "LUXURY_CAMPS",
] as const;

function prettify(v: string): string {
  // Sub-type values are ALL_CAPS Prisma enum members (e.g. "GUEST_HOUSE") —
  // lowercase first, or only the leading letter of each word gets fixed up
  // and the rest stays shouting-case ("GUEST HOUSE" instead of "Guest House").
  return v.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function MigrateToHotelConnectDialog({ hotelId }: { hotelId: number }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<MigrationPreview | null>(null);
  const [ownerEmail, setOwnerEmail] = useState("");
  const [ownerName, setOwnerName] = useState("");
  const [propertyCategory, setPropertyCategory] = useState<PropertyCategoryValue>("HOTEL");
  const [propertySubType, setPropertySubType] = useState<string>("HOTEL");
  const [applyLatLng, setApplyLatLng] = useState(false);
  const [isPending, startTransition] = useTransition();

  async function handleOpenChange(next: boolean) {
    setOpen(next);
    if (!next || preview) return;

    setLoading(true);
    const data = await getHotelMigrationPreview(hotelId);
    setLoading(false);
    if (!data) {
      toast.error("Could not load migration preview.");
      setOpen(false);
      return;
    }
    setPreview(data);
    setOwnerEmail(data.ownerEmail);
    setOwnerName(data.suggestedOwnerName);
    setPropertyCategory(data.propertyCategory);
    setPropertySubType(data.propertySubType);
    setApplyLatLng(!data.hasOwnLatLng && data.fallbackLatitude != null);
  }

  function handleConfirm() {
    startTransition(async () => {
      const result = await migrateHotelToHotelConnect(hotelId, {
        ownerEmail,
        ownerName,
        propertyCategory,
        propertySubType: propertySubType as (typeof PROPERTY_SUB_TYPES)[number],
        applyLatLngFallback:
          applyLatLng && preview?.fallbackLatitude != null && preview?.fallbackLongitude != null
            ? { latitude: preview.fallbackLatitude, longitude: preview.fallbackLongitude }
            : undefined,
      });
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        setPreview(null); // force a fresh preview if the dialog is reopened (shouldn't happen — hotel is now linked)
      } else {
        toast.error(result.message);
      }
    });
  }

  // Recomputed live from the raw ingredients the server returned, using the
  // same pure function the wizard itself uses — never a server-baked number,
  // so it stays correct as ops changes the category/sub-type/checkbox.
  const reachedStep = preview
    ? computeEffectiveWizardStep({
        property_category: propertyCategory,
        ...preview.wizardInput,
        latitude: preview.hasOwnLatLng ? 0 : applyLatLng ? preview.fallbackLatitude : null,
      })
    : 0;
  const totalTabs = preview ? totalTabsFor(propertyCategory) : 0;
  const pct = preview ? wizardCompletenessPct(reachedStep, totalTabs) : 0;

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">Migrate to Hotel Connect</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Migrate to Hotel Connect</DialogTitle>
          <DialogDescription>
            Link this property to a real owner account so they can self-manage it from Hotel Connect.
            It stays in Draft — the owner must review its details and submit it before it goes live.
          </DialogDescription>
        </DialogHeader>

        {loading && (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-5 w-5 animate-spin text-dashboard-base-content/50" />
          </div>
        )}

        {preview && !loading && (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="migrate-owner-email">Owner email</Label>
              <Input
                id="migrate-owner-email"
                type="email"
                value={ownerEmail}
                onChange={(e) => setOwnerEmail(e.target.value)}
              />
              <p className="text-xs text-dashboard-base-content/60">
                {preview.ownerExists
                  ? `An existing Hotel Connect account (${preview.existingOwnerName}) will be linked — no new account is created.`
                  : "No account found for this email — a new Hotel Connect account will be created and the owner emailed a link to set their password."}
              </p>
            </div>

            {!preview.ownerExists && (
              <div className="space-y-1.5">
                <Label htmlFor="migrate-owner-name">Owner / business name</Label>
                <Input
                  id="migrate-owner-name"
                  value={ownerName}
                  onChange={(e) => setOwnerName(e.target.value)}
                />
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Property category</Label>
                <Select value={propertyCategory} onValueChange={(v) => setPropertyCategory(v as PropertyCategoryValue)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_CATEGORIES.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Sub-type</Label>
                <Select value={propertySubType} onValueChange={setPropertySubType}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROPERTY_SUB_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>{prettify(t)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!preview.hasOwnLatLng && preview.fallbackLatitude != null && preview.fallbackLongitude != null && (
              <Checkbox
                checked={applyLatLng}
                onChange={() => setApplyLatLng((v) => !v)}
                label={`Copy coordinates from the linked destination/location (${preview.fallbackLatitude.toFixed(4)}, ${preview.fallbackLongitude.toFixed(4)})`}
              />
            )}

            <div className="rounded-lg border border-dashboard-base-300 p-3 text-sm">
              <p className="font-medium text-dashboard-base-content">
                Will land on tab {reachedStep} of {totalTabs} ({pct}% complete) in the Hotel Connect wizard.
              </p>
              {pct < 100 && (
                <p className="text-xs text-dashboard-base-content/60 mt-1">
                  This property isn&apos;t fully wizard-complete yet — the owner will land partway through and can finish the remaining tabs themselves.
                </p>
              )}
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>Cancel</Button>
          <Button onClick={handleConfirm} disabled={isPending || loading || !preview}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Confirm Migration
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
