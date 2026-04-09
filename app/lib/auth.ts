// auth.ts

import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/app/lib/db";
import { Role, UserStatus } from "../generated/prisma";


import type { User } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      phone: string | null;
      role: Role;
      status: UserStatus;
      isProfileComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    phone: string | null;
    role: Role;
    status: UserStatus;
    isProfileComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId: string;
    phone: string | null;
    role: Role;
    status: UserStatus;
    isProfileComplete: boolean;
  }
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 6 * 30 * 24 * 60 * 60, // 6 months
  },

  jwt: {
    maxAge: 6 * 30 * 24 * 60 * 60, // 6 months
  },


  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        code: { label: "OTP", type: "text" },
        magicSessionToken: { label: "Magic Session Token", type: "text" }, // ← added
      },

      async authorize(credentials): Promise<User | null> {

        // ── Magic Link Login ────────────────────────────────────────
        if (credentials?.magicSessionToken) {
          const magicToken = credentials.magicSessionToken as string;
          console.log("[authorize] magicToken received:", magicToken);

          const magicSession = await db.magicSession.findUnique({
            where: { token: magicToken },
          });

          console.log("[authorize] magicSession:", magicSession);

          if (!magicSession) {
            console.log("[authorize] token not found or already used");
            return null;
          }

          if (magicSession.expiresAt < new Date()) {
            console.log("[authorize] token expired");
            await db.magicSession.delete({ where: { token: magicToken } });
            return null;
          }

          // Consume token — one time use
          await db.magicSession.delete({ where: { token: magicToken } });

          const user = await db.user.findUnique({
            where: { email: magicSession.email },
          });

          console.log("[authorize] user found:", user?.id);

          if (!user) return null;
          if (user.status === "BANNED" || user.status === "DELETED") return null;

          return {
            id: user.id,
            email: user.email,
            name: user.name,
            phone: user.phone,
            role: user.role,
            status: user.status,
            isProfileComplete: user.isProfileComplete,
          } as User;
        }

        // ── Phone OTP Login ─────────────────────────────────────────
        const phone = credentials?.phone as string;
        const code = parseInt(credentials?.code as string, 10);

        if (!phone || isNaN(code)) return null;

        const otp = await db.otp.findFirst({
          where: {
            phone,
            code,
            usedAt: null,
            expiresAt: { gte: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otp) return null;

        await db.otp.update({
          where: { id: otp.id },
          data: { usedAt: new Date() },
        });

        const user = await db.user.upsert({
          where: { phone },
          update: {},
          create: { phone },
        });

        if (user.status === "BANNED" || user.status === "DELETED") return null;

        return {
          id: user.id,
          phone: user.phone,
          role: user.role,
          status: user.status,
          name: user.name,
          email: user.email,
          isProfileComplete: user.isProfileComplete,
        } as User;
      },
    }),
  ],

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google") {
        try {
          const existingUser = await db.user.findUnique({
            where: { email: user.email! },
          });

          if (!existingUser) {
            await db.user.create({
              data: {
                email: user.email!,
                name: user.name ?? null,
                image: user.image ?? null,
                emailVerified: new Date(),
              },
            });
          } else {
            if (existingUser.status === "BANNED" || existingUser.status === "DELETED") {
              return false;
            }
            await db.user.update({
              where: { email: user.email! },
              data: {
                name: user.name ?? existingUser.name,
                image: user.image ?? existingUser.image,
                emailVerified: existingUser.emailVerified ?? new Date(),
              },
            });
          }
          return true;
        } catch (error) {
          console.error("[signIn] Google user save failed:", error);
          return false;
        }
      }
      return true;
    },

    async jwt({ token, user, account }) {
      if (user) {
        token.userId = user.id ?? "";
        token.phone = user.phone ?? null;
        token.role = user.role;
        token.status = user.status;
        token.isProfileComplete = user.isProfileComplete;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email },
          select: {
            id: true,
            phone: true,
            role: true,
            status: true,
            isProfileComplete: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.phone = dbUser.phone;
          token.role = dbUser.role;
          token.status = dbUser.status;
          token.isProfileComplete = dbUser.isProfileComplete;
        }
      }

      return token;
    },

    async session({ session, token }) {
      session.user.id = token.userId;
      session.user.phone = token.phone;
      session.user.role = token.role;
      session.user.status = token.status;
      session.user.isProfileComplete = token.isProfileComplete;
      return session;
    },
  },

  pages: {
    signIn: '/',
  },

  secret: process.env.AUTH_SECRET,

});