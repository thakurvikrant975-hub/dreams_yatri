// types/rbac.ts
export type Action = "create" | "read" | "update" | "delete";

export type FieldAccess = {
  visible:  string[];
  editable: string[];
};

export type ResourcePermission = {
  resource: string;
  actions:  Action[];
  fields:   FieldAccess;
};

export type PermissionSet = ResourcePermission[];

// ── Helper ────────────────────────────────────────────────────────────────────
export function can(
  permissions: PermissionSet,
  resource: string,
  action: Action
): boolean {
  const perm = permissions.find(p => p.resource === resource);
  return perm ? perm.actions.includes(action) : false;
}