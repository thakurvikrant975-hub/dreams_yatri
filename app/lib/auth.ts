// auth.ts

import NextAuth, { DefaultSession } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";
import { db } from "@/app/lib/db";
import { Role, UserStatus } from "../generated/prisma";


import type { User } from "next-auth";

function verifyMsg91Jwt(token: string): boolean {
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return false;
    const payload = JSON.parse(Buffer.from(parts[1], "base64url").toString("utf8"));
    // Verify the token belongs to our MSG91 account
    return String(payload.companyId) === process.env.MSG91_COMPANY_ID!;
  } catch {
    return false;
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
        phone:             { label: "Phone",               type: "text" },
        code:              { label: "OTP",                 type: "text" },
        magicSessionToken: { label: "Magic Session Token", type: "text" },
        msg91Token:        { label: "MSG91 Widget Token",  type: "text" },
      },

      async authorize(credentials): Promise<User | null> {

        // ── MSG91 Widget Token Login ─────────────────────────────────
        if (credentials?.msg91Token && credentials?.phone) {
          const isValid = verifyMsg91Jwt(credentials.msg91Token as string);
          if (!isValid) return null;

          const phone = credentials.phone as string;

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
            image:             user.image,
            isProfileComplete: user.isProfileComplete,
          } as User;
        }

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
            id:                user.id,
            email:             user.email,
            name:              user.name,
            phone:             user.phone,
            role:              user.role,
            status:            user.status,
            image:             user.image,
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
          id:                user.id,
          phone:             user.phone,
          role:              user.role,
          status:            user.status,
          name:              user.name,
          email:             user.email,
          image:             user.image,
          isProfileComplete: user.isProfileComplete,
        } as User;
      },
    }),
  ],

  callbacks: {
// app/lib/auth.ts — signIn callback only

async signIn({ user, account }) {
  if (account?.provider === "google") {
    try {
      const existingUser = await db.user.findUnique({
        where:  { email: user.email! },
        select: { id: true, status: true }, // ← only need id and status
      });

      if (!existingUser) {
        // First login — create with Google data
        await db.user.create({
          data: {
            email:         user.email!,
            name:          user.name  ?? null,
            image:         user.image ?? null,
            emailVerified: new Date(),
          },
        });
      } else {
        if (existingUser.status === "BANNED" || existingUser.status === "DELETED") {
          return false;
        }

        // Returning user — ONLY update emailVerified, never touch name or image
        await db.user.update({
          where: { id: existingUser.id },
          data:  { emailVerified: new Date() },
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

    async jwt({ token, user, account, trigger }) {
      if (user) {
        token.userId  = user.id ?? "";
        token.phone   = user.phone ?? null;
        token.role    = user.role;
        token.status  = user.status;
        token.isProfileComplete = user.isProfileComplete;
        if (user.name)  token.name    = user.name;
        if (user.image) token.picture = user.image;
      }

      if (account?.provider === "google" && token.email) {
        const dbUser = await db.user.findUnique({
          where: { email: token.email },
          select: {
            id: true, phone: true, role: true, status: true,
            name: true, image: true, isProfileComplete: true,
          },
        });

        if (dbUser) {
          token.userId = dbUser.id;
          token.phone  = dbUser.phone;
          token.role   = dbUser.role;
          token.status = dbUser.status;
          token.isProfileComplete = dbUser.isProfileComplete;
          if (dbUser.name)  token.name    = dbUser.name;
          if (dbUser.image) token.picture = dbUser.image;
        }
      }

      // Refresh mutable profile fields from DB when explicitly triggered
      // (called from client via useSession().update() after profile saves)
      if (trigger === "update" && token.userId) {
        const fresh = await db.user.findUnique({
          where:  { id: token.userId as string },
          select: { name: true, image: true, isProfileComplete: true },
        });
        if (fresh) {
          if (fresh.name)  token.name    = fresh.name;
          if (fresh.image) token.picture = fresh.image;
          token.isProfileComplete = fresh.isProfileComplete;
        }
      }

      return token;
    },

async session({ session, token }) {
  session.user.id                = token.userId ?? "";
  session.user.phone             = token.phone;
  session.user.role              = token.role;
  session.user.status            = token.status;
  session.user.isProfileComplete = token.isProfileComplete;
  // Explicitly carry name and image so profile updates via update() are reflected
  if (token.name)    session.user.name  = token.name as string;
  if (token.picture) session.user.image = token.picture as string;
  return session;
},
  },

  pages: {
    signIn: '/',
  },

  secret: process.env.AUTH_SECRET,

});