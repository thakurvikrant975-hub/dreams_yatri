import "server-only";
import { auth } from "@/app/lib/auth";
import { db } from "@/app/lib/db";

export async function getAuthenticatedUser() {
  const session = await auth();
  if (!session?.user?.id) return null;

  // Block deleted or banned users on every request
  const user = await db.user.findUnique({
    where:  { id: session.user.id },
    select: { id: true, status: true },
  });

  if (!user || user.status !== "ACTIVE") return null;

  return session.user;
}