// app/lib/auth-dashboard.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/app/lib/db";

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

export const {
  auth: dashboardAuth,
  signIn: dashboardSignIn,
  signOut: dashboardSignOut,
  handlers: dashboardHandlers,
} = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 8 * 60 * 60, // 8 hours
  },

  // ── Custom cookie name — critical to avoid collision with public auth ──
  cookies: {
    sessionToken: {
      name: "dy.dashboard.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/dashboard",   // scoped to /dashboard only
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/dashboard/login",
    error: "/dashboard/login",
  },

  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
async authorize(credentials) {
  const parsed = LoginSchema.safeParse(credentials);
  if (!parsed.success) return null;

  const { email, password } = parsed.data;

  let member;
  try {
    member = await db.teamMember.findUnique({
      where: { email },
      select: {
        id:           true,
        name:         true,
        email:        true,
        password:     true,
        isActive:     true,
        departmentId: true,
        teamRole: {
          select: {
            name:        true,
            permissions: true,
            pageAccess:  true,
          },
        },
      },
    });
  } catch (dbError) {
    console.error("[Dashboard Auth] Database error during login:", dbError);
    throw new Error("DB_CONNECTION_ERROR");
  }

  if (!member || !member.password) {
    const err = new CredentialsSignin("No account found");
    err.code = "user_not_found";
    throw err;
  }

  if (!member.isActive) {
    const err = new CredentialsSignin("Account deactivated");
    err.code = "account_inactive";
    throw err;
  }

  let valid = false;
  try {
    valid = await compare(password, member.password);
  } catch (bcryptError) {
    console.error("[Dashboard Auth] Password comparison error:", bcryptError);
    throw new Error("PASSWORD_COMPARE_ERROR");
  }

  if (!valid) {
    const err = new CredentialsSignin("Incorrect password");
    err.code = "invalid_password";
    throw err;
  }

  db.teamMember.update({
    where: { id: member.id },
    data:  { lastLoginAt: new Date() },
  }).catch(console.error);

  return {
    id:           member.id,
    name:         member.name,
    email:        member.email,
    role:         member.teamRole?.name ?? "",
    permissions:  member.teamRole?.permissions ?? [],
    pageAccess:   member.teamRole?.pageAccess ?? [],
    departmentId: member.departmentId ?? null,
  } as any;
},
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
        token.pageAccess  = (user as any).pageAccess;
        token.departmentId = (user as any).departmentId;
      }
      return token;
    },

async session({ session, token }) {
  session.user.id           = token.id as string;
  (session.user as any).role         = token.role         ?? null;
  (session.user as any).permissions  = token.permissions  ?? [];
  (session.user as any).pageAccess   = token.pageAccess   ?? [];
  (session.user as any).departmentId = token.departmentId ?? null;
  return session;
},
  },
});