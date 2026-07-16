import { WIZARD_TABS, HOMESTAY_WIZARD_TABS } from "./wizard-tab-config";

export type WizardProgressInput = {
  property_category: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  pincode: string | null;
  latitude: unknown;
  wizard_step: number;
  roomCount: number;
  imageCount: number;
};

/** How far the wizard is ACTUALLY complete based on saved DB data — shared by the edit wizard and the properties list card. */
export function computeEffectiveWizardStep(h: WizardProgressInput): number {
  if (!h.property_category) return 0;
  if (!h.address || !h.city || !h.state || !h.country || !h.pincode || h.latitude == null) return 1;

  const isHomestay = h.property_category === "HOMESTAY_VILLA";
  if (isHomestay) {
    // wizard_step < 4 means Rooms & Spaces (tab 4) not yet saved
    if (h.wizard_step < 4) return Math.min(h.wizard_step, 3);
    if (h.imageCount === 0) return 4; // Photos = tab 5; no images → tabs 1-4 complete
    return Math.max(h.wizard_step, 5);
  }
  // Hotels: tab 4 = Rooms, tab 5 = Photos
  if (h.roomCount === 0) return 3;
  if (h.imageCount === 0) return 4;
  return Math.max(h.wizard_step, 5);
}

export function totalTabsFor(propertyCategory: string | null): number {
  const tabs = propertyCategory === "HOMESTAY_VILLA" ? HOMESTAY_WIZARD_TABS : WIZARD_TABS;
  return tabs[tabs.length - 1].index;
}

export function wizardCompletenessPct(reachedStep: number, totalTabs: number): number {
  return Math.round((Math.min(Math.max(reachedStep, 0), totalTabs) / totalTabs) * 100);
}
