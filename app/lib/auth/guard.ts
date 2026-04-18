// app/lib/rbac/guard.ts
import { auth } from "@/auth";
import { can, PermissionSet } from "./permissions";
import { Action } from "@/types/rbac";

export async function requirePermission(resource: string, action: Action) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthenticated");

  const permissions = session.user.permissions as PermissionSet;
  if (!can(permissions, resource, action)) {
    throw new Error(`Forbidden: ${action} on ${resource}`);
  }

  return permissions; // return so caller can also use for field filtering
}