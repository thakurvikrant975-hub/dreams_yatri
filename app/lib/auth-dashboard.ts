// app/lib/auth-dashboard.ts

import NextAuth from "next-auth";
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

  const member = await db.teamMember.findUnique({
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
        },
      },
    },
  });

  if (!member || !member.password) return null;
  if (!member.isActive) return null;

  const valid = await compare(password, member.password);
  if (!valid) return null;

  db.teamMember.update({
    where: { id: member.id },
    data:  { lastLoginAt: new Date() },
  }).catch(console.error);

  return {
    id:           member.id,
    name:         member.name,
    email:        member.email,
    role:         member.teamRole?.name ?? "",   // ← null → "" to satisfy NextAuth User type
    permissions:  member.teamRole?.permissions ?? [],
    departmentId: member.departmentId ?? null,
  } as any;  // ← cast to any so custom fields don't conflict with NextAuth's User
},
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as any).role;
        token.permissions = (user as any).permissions;
        token.departmentId = (user as any).departmentId;
      }
      return token;
    },

async session({ session, token }) {
  session.user.id           = token.id as string;
  (session.user as any).role         = token.role         ?? null;
  (session.user as any).permissions  = token.permissions  ?? [];
  (session.user as any).departmentId = token.departmentId ?? null;
  return session;
},
  },
});