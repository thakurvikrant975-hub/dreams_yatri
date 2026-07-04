"use server";

import { deleteFromR2 } from "@/app/lib/r2/r2delete";

export async function deleteR2Keys(keys: string[]): Promise<void> {
    await Promise.all(keys.filter(Boolean).map(k => deleteFromR2(k).catch(console.error)));
}
