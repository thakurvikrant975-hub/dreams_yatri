// app/lib/rbac/permissions.ts
import { PermissionSet, Action } from "@/types/rbac";

export function getResourcePermission(permissions: PermissionSet, resource: string) {
  return permissions.find(p => p.resource === resource) ?? null;
}

export function can(permissions: PermissionSet, resource: string, action: Action): boolean {
  const perm = getResourcePermission(permissions, resource);
  return perm?.actions.includes(action) ?? false;
}

export function visibleFields(permissions: PermissionSet, resource: string): string[] {
  return getResourcePermission(permissions, resource)?.fields.visible ?? [];
}

export function editableFields(permissions: PermissionSet, resource: string): string[] {
  return getResourcePermission(permissions, resource)?.fields.editable ?? [];
}

// Use this in Server Actions to strip fields before returning data
export function filterDataFields<T extends Record<string, unknown>>(
  data: T[],
  resource: string,
  permissions: PermissionSet
): Partial<T>[] {
  const allowed = visibleFields(permissions, resource);
  if (!allowed.length) return data; // no restriction = full access

  return data.map(row =>
    allowed.reduce((acc, field) => {
      if (field in row) (acc as Record<string, unknown>)[field] = row[field];
      return acc;
    }, {} as Partial<T>)
  );
}