// app/(dashboard)/dashboard/policies/constants.ts

export type PolicyType =
  | "CANCELLATION"
  | "DATE_CHANGE"
  | "REFUND"
  | "TERMS_AND_CONDITIONS";

export const POLICY_TYPE_LABELS: Record<PolicyType, string> = {
  CANCELLATION:         "Cancellation Policy",
  DATE_CHANGE:          "Date Change Policy",
  REFUND:               "Refund Policy",
  TERMS_AND_CONDITIONS: "Terms & Conditions",
};

export const POLICY_TYPES = Object.keys(POLICY_TYPE_LABELS) as PolicyType[];

export const POLICY_TYPE_COLORS: Record<PolicyType, string> = {
  CANCELLATION:         "bg-red-50 text-red-700 border-red-200",
  DATE_CHANGE:          "bg-blue-50 text-blue-700 border-blue-200",
  REFUND:               "bg-green-50 text-green-700 border-green-200",
  TERMS_AND_CONDITIONS: "bg-purple-50 text-purple-700 border-purple-200",
};