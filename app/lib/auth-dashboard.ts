import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { db } from "@/app/lib/db";

const SECRET = new TextEncoder().encode(process.env.SESSION_SECRET!);
const COOKIE_NAME = "dy_session";

export interface SessionPayload {
  memberId: string;
  email: string;
  name: string;
  role: string | null;
  permissions: string[];
  departmentId: string | null;
}

export async function createSession(payload: SessionPayload) {
  const token = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("8h") // Work day session
    .sign(SECRET);

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 8, // 8 hours
    path: "/",
  });
}

export async function getSession(): Promise<SessionPayload | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(COOKIE_NAME)?.value;
    if (!token) return null;

    const { payload } = await jwtVerify(token, SECRET);
    return payload as unknown as SessionPayload;
  } catch {
    return null;
  }
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

// RBAC utility — use this in server actions and route handlers
export function hasPermission(session: SessionPayload, permission: string): boolean {
  return session.permissions.includes(permission);
}