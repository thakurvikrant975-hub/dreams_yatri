// constants.ts — no "use server" directive


export type PolicyFormState = {
  success: boolean;
  message: string;
  errors?: Record<string, string[]>;
};

export type Policy = {
  id:         number;
  type:       PolicyType;
  title:      string;
  content:    string;
  is_active:  boolean;
  created_at: Date;
  updated_at: Date;
  _count:     { packages: number };
};


export type PolicyWithPackage = {
  id:         number;
  package_id: number;
  type:       PolicyType;
  title:      string | null;
  content:    string;
  is_active:  boolean;
  sort_order: number;
  created_at: Date;
  updated_at: Date;
  package:    { id: number; title: string; slug: string };
};


export type PolicyType =
  | "CANCELLATION"
  | "DATE_CHANGE"
  | "REFUND"
  | "TERMS_AND_CONDITIONS";
