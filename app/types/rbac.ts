// types/rbac.ts  — your single source of truth
export type Action = "create" | "read" | "update" | "delete";

export type FieldAccess = {
  visible:  string[];   // columns rendered in table
  editable: string[];   // fields enabled in edit form
};

export type ResourcePermission = {
  resource: string;     // "destinations" | "hotels" | "team_members" | ...
  actions:  Action[];
  fields:   FieldAccess;
};

export type PermissionSet = ResourcePermission[];