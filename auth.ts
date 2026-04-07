// auth.ts

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { db } from "./app/lib/db";

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
        const code  = credentials?.code  as string;

        if (!phone || !code) return null;

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

        return {
          id:                user.id,
          phone:             user.phone,
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
        token.userId            = user.id ?? "";   // ← guard undefined
        token.phone             = user.phone;
        token.isProfileComplete = user.isProfileComplete;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id               = token.userId;
      session.user.phone            = token.phone;
      session.user.isProfileComplete = token.isProfileComplete;
      return session;
    },
  },

  pages: {
    signIn: "/login",
  },
});