// Filter option lists for the "Rate Status" and "Data Issues" filters on
// /dashboard/hotel-approvals. Kept in a plain module (not actions.ts, which
// is "use server" and only permits async-function exports) so both the
// server action and the client table's filter dropdowns share one source.

export const RATE_WINDOWS = [
  { value: "expired", label: "Already expired" },
  { value: "15d",      label: "Expiring within 15 days" },
  { value: "1m",       label: "Expiring within 1 month" },
  { value: "2m",       label: "Expiring within 2 months" },
  { value: "3m",       label: "Expiring within 3 months" },
  { value: "6m",       label: "Expiring within 6 months" },
] as const;
export type RateWindow = (typeof RATE_WINDOWS)[number]["value"] | "all";
const RATE_WINDOW_VALUES = RATE_WINDOWS.map((w) => w.value);
export function isRateWindow(v: string): v is Exclude<RateWindow, "all"> {
  return (RATE_WINDOW_VALUES as readonly string[]).includes(v);
}

export const DATA_ISSUES = [
  { value: "no_room",     label: "No rooms added" },
  { value: "no_location", label: "No location, city or state" },
  { value: "no_images",   label: "No images uploaded" },
  { value: "no_pricing",  label: "Has rooms, but none priced" },
] as const;
export type DataIssue = (typeof DATA_ISSUES)[number]["value"] | "all";
const DATA_ISSUE_VALUES = DATA_ISSUES.map((d) => d.value);
export function isDataIssue(v: string): v is Exclude<DataIssue, "all"> {
  return (DATA_ISSUE_VALUES as readonly string[]).includes(v);
}
