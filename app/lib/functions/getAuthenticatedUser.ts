// app/lib/functions/getAuthenticatedUser.ts

import "server-only";
import { auth } from "@/app/lib/auth";  // ← this is the actual auth file
import { db } from "@/app/lib/db";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") return null;

  return session.user;
}