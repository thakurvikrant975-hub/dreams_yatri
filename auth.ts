// auth.ts
import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./app/lib/db";
import { Role, UserStatus } from "./app/generated/prisma";

// ── Type augmentation co-located with auth config (NextAuth v5 pattern) ──
declare module "next-auth" {
  interface Session {
    user: {
      id:                string;
      phone:             string;
      role:              Role;
      status:            UserStatus;
      isProfileComplete: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    phone:             string;
    role:              Role;
    status:            UserStatus;
    isProfileComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId:            string;
    phone:             string;
    role:              Role;
    status:            UserStatus;
    isProfileComplete: boolean;
  }
}

// ── Auth config ──
export const { handlers, auth, signIn, signOut } = NextAuth({
  session: { strategy: "jwt" },

  providers: [
    Credentials({
      credentials: {
        phone: { label: "Phone", type: "text" },
        code:  { label: "OTP",   type: "text" },
      },

      async authorize(credentials) {
        const phone = credentials?.phone as string;
        const code  = parseInt(credentials?.code as string, 10);

        if (!phone || isNaN(code)) return null;

        const otp = await db.otp.findFirst({
          where: {
            phone,
            code,
            usedAt:    null,
            expiresAt: { gte: new Date() },
          },
          orderBy: { createdAt: "desc" },
        });

        if (!otp) return null;

        await db.otp.update({
          where: { id: otp.id },
          data:  { usedAt: new Date() },
        });

        const user = await db.user.upsert({
          where:  { phone },
          update: {},
          create: { phone },
        });

        if (user.status === "BANNED" || user.status === "DELETED") return null;

        return {
          id:                user.id,
          phone:             user.phone,
          role:              user.role,
          status:            user.status,
          name:              user.name,
          email:             user.email,
          isProfileComplete: user.isProfileComplete,
        };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.userId            = user.id ?? "";
        token.phone             = user.phone;
        token.role              = user.role;
        token.status            = user.status;
        token.isProfileComplete = user.isProfileComplete;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id                = token.userId;
      session.user.phone             = token.phone;
      session.user.role              = token.role;
      session.user.status            = token.status;
      session.user.isProfileComplete = token.isProfileComplete;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});