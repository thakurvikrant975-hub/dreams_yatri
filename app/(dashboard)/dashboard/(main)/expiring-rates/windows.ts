// Expiry-window options shared by the server action (actions.ts), the page
// (searchParams validation), and the client table (filter dropdown). Kept in
// a plain module rather than actions.ts because that file has "use server" —
// which only permits async-function exports, not this const/type-guard pair.

export const EXPIRY_WINDOWS = [
  { value: "7d",      label: "Within 7 days" },
  { value: "15d",     label: "Within 15 days" },
  { value: "1m",      label: "Within 1 month" },
  { value: "3m",      label: "Within 3 months" },
  { value: "6m",      label: "Within 6 months" },
  { value: "1y",      label: "Within 1 year" },
  { value: "2y",      label: "Within 2 years" },
  { value: "expired", label: "Already expired" },
] as const;

export type ExpiryWindow = (typeof EXPIRY_WINDOWS)[number]["value"];
const WINDOW_VALUES = EXPIRY_WINDOWS.map((w) => w.value);
export function isExpiryWindow(v: string): v is ExpiryWindow {
  return (WINDOW_VALUES as readonly string[]).includes(v);
}
