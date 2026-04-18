"use server";

import { db } from "@/app/lib/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { PermissionSet } from "@/app/types/rbac";

const RoleSchema = z.object({
    name:        z.string().min(1, "Name is required").max(100),
    description: z.string().max(500).optional(),
});

export type RoleFormState = {
    success: boolean;
    message: string;
    errors?: Record<string, string[]>;
};

const REVALIDATE_PATH = "/dashboard/roles-and-permissions";

// ── Read ──────────────────────────────────────────────────────────────────────

export async function getRoles() {
    return db.teamRole.findMany({
        orderBy: { createdAt: "desc" },
        include: { _count: { select: { members: true } } },
    });
}

export async function getRoleById(id: string) {
    return db.teamRole.findUnique({
        where: { id },
        include: { _count: { select: { members: true } } },
    });
}

// ── Create ────────────────────────────────────────────────────────────────────

export async function createRole(
    _prev: RoleFormState,
    formData: FormData,
): Promise<RoleFormState> {
    const raw = {
        name:        formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
    };

    const parsed = RoleSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
    }

    try {
        const existing = await db.teamRole.findUnique({ where: { name: parsed.data.name } });
        if (existing) {
            return { success: false, message: "Role name already exists", errors: { name: ["This role name is already taken"] } };
        }

        await db.teamRole.create({
            data: { ...parsed.data, permissions: [] },
        });

        revalidatePath(REVALIDATE_PATH);
        return { success: true, message: "Role created successfully" };
    } catch (e) {
        console.error("[createRole]", e);
        return { success: false, message: `DB error: ${(e as Error).message}` };
    }
}

// ── Update ────────────────────────────────────────────────────────────────────
// Plain async fn — called via startTransition, NOT useActionState

export async function updateRole(
    id: string,
    formData: FormData,
): Promise<RoleFormState> {
    const raw = {
        name:        formData.get("name") as string,
        description: (formData.get("description") as string) || undefined,
    };

    const parsed = RoleSchema.safeParse(raw);
    if (!parsed.success) {
        return { success: false, message: "Validation failed", errors: parsed.error.flatten().fieldErrors };
    }

    try {
        const conflict = await db.teamRole.findFirst({
            where: { name: parsed.data.name, NOT: { id } },
        });
        if (conflict) {
            return { success: false, message: "Role name taken", errors: { name: ["This role name is already taken"] } };
        }

        await db.teamRole.update({
            where: { id },
            data:  { name: parsed.data.name, description: parsed.data.description ?? null },
        });

        revalidatePath(REVALIDATE_PATH);
        return { success: true, message: "Role updated successfully" };
    } catch (e) {
        console.error("[updateRole]", e);
        return { success: false, message: `DB error: ${(e as Error).message}` };
    }
}

// ── Update Permissions ────────────────────────────────────────────────────────

export async function updateRolePermissions(
    id: string,
    permissions: PermissionSet,
): Promise<RoleFormState> {
    try {
        const role = await db.teamRole.findUnique({ where: { id } });
        if (!role) return { success: false, message: "Role not found" };

        await db.teamRole.update({
            where: { id },
            data:  { permissions: permissions as unknown as never },
        });

        revalidatePath(REVALIDATE_PATH);
        return { success: true, message: "Permissions saved successfully" };
    } catch (e) {
        console.error("[updateRolePermissions]", e);
        return { success: false, message: `DB error: ${(e as Error).message}` };
    }
}

// ── Delete ────────────────────────────────────────────────────────────────────

export async function deleteRole(id: string): Promise<RoleFormState> {
    try {
        const role = await db.teamRole.findUnique({
            where:   { id },
            include: { _count: { select: { members: true } } },
        });

        if (!role) return { success: false, message: "Role not found" };

        if (role._count.members > 0) {
            return {
                success: false,
                message: `Cannot delete — ${role._count.members} member(s) assigned. Reassign first.`,
            };
        }

        await db.teamRole.delete({ where: { id } });
        revalidatePath(REVALIDATE_PATH);
        return { success: true, message: "Role deleted successfully" };
    } catch (e) {
        console.error("[deleteRole]", e);
        return { success: false, message: `DB error: ${(e as Error).message}` };
    }
}