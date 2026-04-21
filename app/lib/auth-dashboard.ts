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

      // async authorize(credentials) {
      //   const parsed = LoginSchema.safeParse(credentials);
      //   if (!parsed.success) return null;

      //   const { email, password } = parsed.data;

      //   const member = await db.teamMember.findUnique({
      //     where: { email },
      //     select: {
      //       id: true,
      //       name: true,
      //       email: true,
      //       password: true,
      //       isActive: true,
      //       departmentId: true,
      //       teamRole: {
      //         select: {
      //           name: true,
      //           permissions: true,
      //         },
      //       },
      //     },
      //   });

      //   if (!member || !member.password) return null;
      //   if (!member.isActive) return null;

      //   const valid = await compare(password, member.password);
      //   if (!valid) return null;

      //   db.teamMember.update({
      //     where: { id: member.id },
      //     data: { lastLoginAt: new Date() },
      //   }).catch(console.error);

      //   return {
      //     id: member.id,
      //     name: member.name,
      //     email: member.email,
      //     role: member.teamRole?.name ?? null,
      //     permissions: member.teamRole?.permissions ?? [],
      //     departmentId: member.departmentId ?? null,
      //   };
      // },

      async authorize(credentials, _request) {
  const parsed = LoginSchema.safeParse(credentials);
  if (!parsed.success) {
    console.log("❌ Zod parse failed", parsed.error);
    return null;
  }

  const { email, password } = parsed.data;

  const member = await db.teamMember.findUnique({
    where: { email },
    select: {
      id: true,
      name: true,
      email: true,
      password: true,
      isActive: true,
      departmentId: true,
      teamRole: { select: { name: true, permissions: true } },
    },
  });

  console.log("Member found:", !!member);
  console.log("Has password:", !!member?.password);
  console.log("isActive:", member?.isActive);

  if (!member || !member.password) return null;
  if (!member.isActive) return null;

  const valid = await compare(password, member.password);
  console.log("Password valid:", valid);

  if (!valid) return null;
}
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
      session.user.id = token.id as string;
      session.user.role = token.role as string | null;
      session.user.permissions = token.permissions as string[];
      session.user.departmentId = token.departmentId as string | null;
      return session;
    },
  },
});