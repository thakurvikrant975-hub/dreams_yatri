// auth.ts

import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "./app/lib/db";

export const { handlers, auth, signIn, signOut } = NextAuth({
  session: {
    strategy: "jwt",
    maxAge:   6 * 30 * 24 * 60 * 60, // 6 months
  },

  providers: [
    // ── Google ─────────────────────────────────────────────────────────────
    Google({
      clientId:     process.env.GOOGLE_CLIENT_ID!,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET!,
    }),

    // ── Phone OTP ───────────────────────────────────────────────────────────
    Credentials({
      credentials: {
        phone:             { label: "Phone",               type: "text" },
        code:              { label: "OTP",                 type: "text" },
        magicSessionToken: { label: "Magic Session Token", type: "text" },
      },

      async authorize(credentials) {

        // ── Magic Link ──────────────────────────────────────────────────────
        if (credentials?.magicSessionToken) {
          const magicToken = credentials.magicSessionToken as string;

          const magicSession = await db.magicSession.findUnique({
            where: { token: magicToken },
          });

          if (!magicSession)                          return null;
          if (magicSession.expiresAt < new Date()) {
            await db.magicSession.delete({ where: { token: magicToken } });
            return null;
          }

          await db.magicSession.delete({ where: { token: magicToken } });

          const user = await db.user.findUnique({
            where: { email: magicSession.email },
          });

          if (!user) return null;
          if (user.status === "BANNED" || user.status === "DELETED") return null;

          return {
            id:                user.id,
            email:             user.email,
            name:              user.name,
            phone:             user.phone,
            role:              user.role,
            status:            user.status,
            isProfileComplete: user.isProfileComplete,
          };
        }

        // ── Phone OTP ───────────────────────────────────────────────────────
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
          name:              user.name,
          email:             user.email,
          role:              user.role,
          status:            user.status,
          isProfileComplete: user.isProfileComplete,
        };
      },
    }),
  ],

  callbacks: {
    // ── Google — save user to DB on first login, never overwrite manual data ─
async signIn({ user, account }) {
  if (account?.provider === "google") {
    try {
      const existingUser = await db.user.findUnique({
        where:  { email: user.email! },
        select: { id: true, status: true },
      });

      if (!existingUser) {
        // First time — create with Google data
        await db.user.create({
          data: {
            email:         user.email!,
            name:          user.name  ?? null,
            image:         user.image ?? null,
            emailVerified: new Date(),
          },
        });
      } else {
        // Returning user — block banned/deleted, update ONLY emailVerified
        if (existingUser.status === "BANNED" || existingUser.status === "DELETED") {
          return false;
        }

        await db.user.update({
          where: { id: existingUser.id },      // ← use id not email
          data:  { emailVerified: new Date() }, // ← ONLY this, nothing else
        });
      }

      return true;
    } catch (error) {
      console.error("[signIn] Google error:", error);
      return false;
    }
  }
  return true;
},

async jwt({ token, user, account }) {

  // ── Step 1: On first sign in, set userId from user object ────────────
  if (user?.id) {
    token.userId = user.id;
  }

  // ── Step 2: For Google, get userId from DB using email ───────────────
  // because on Google first login, user.id is Google's ID not our DB id
  if (account?.provider === "google" && token.email) {
    const dbUser = await db.user.findUnique({
      where:  { email: token.email },
      select: { id: true },
    });
    if (dbUser) token.userId = dbUser.id;
  }

// ── Step 3 ────────────────────────────────────────────────────────────
if (token.userId) {
  const dbUser = await db.user.findUnique({
    where:  { id: token.userId },
    select: { name: true, image: true, phone: true, role: true, status: true, isProfileComplete: true },
  });

  console.log("[jwt] token.userId:", token.userId);
  console.log("[jwt] dbUser:", dbUser);
  console.log("[jwt] token.name before:", token.name);

  if (dbUser) {
    token.name              = dbUser.name;
    token.picture           = dbUser.image;
    token.phone             = dbUser.phone;
    token.role              = dbUser.role;
    token.status            = dbUser.status;
    token.isProfileComplete = dbUser.isProfileComplete;
  }

  console.log("[jwt] token.name after:", token.name);
}

  return token;
},

async session({ session, token }) {
  session.user.id               = token.userId as string;
  session.user.phone            = token.phone  as string;
  session.user.isProfileComplete = token.isProfileComplete as boolean;
  // ← remove name and image from session — always read from DB in server components
  return session;
},

  },

  pages: {
    signIn: "/login",
  },
});