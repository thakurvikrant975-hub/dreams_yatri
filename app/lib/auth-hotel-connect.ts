// app/lib/auth-hotel-connect.ts

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
  auth: hotelConnectAuth,
  signIn: hotelConnectSignIn,
  signOut: hotelConnectSignOut,
  handlers: hotelConnectHandlers,
} = NextAuth({
  session: {
    strategy: "jwt",
    maxAge: 24 * 60 * 60, // 24 hours
  },

  // Separate cookie — no collision with public auth or dashboard
  cookies: {
    sessionToken: {
      name: "dy.hotel-connect.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/hotel-connect",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: {
    signIn: "/hotel-connect/login",
    error: "/hotel-connect/login",
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

        let owner;
        try {
          owner = await db.hotelOwner.findUnique({
            where: { email },
            select: {
              id:           true,
              name:         true,
              email:        true,
              password:     true,
              status:       true,
              businessName: true,
            },
          });
        } catch (dbError) {
          console.error("[HotelConnect Auth] Database error during login:", dbError);
          throw new Error("DB_CONNECTION_ERROR");
        }

        if (!owner || !owner.password) {
          const err = new CredentialsSignin("No account found");
          err.code = "user_not_found";
          throw err;
        }

        if (owner.status === "SUSPENDED" || owner.status === "REJECTED") {
          const err = new CredentialsSignin("Account not active");
          err.code = "account_inactive";
          throw err;
        }

        if (owner.status === "PENDING_VERIFICATION") {
          const err = new CredentialsSignin("Account pending approval");
          err.code = "pending_approval";
          throw err;
        }

        let valid = false;
        try {
          valid = await compare(password, owner.password);
        } catch (bcryptError) {
          console.error("[HotelConnect Auth] Password comparison error:", bcryptError);
          throw new Error("PASSWORD_COMPARE_ERROR");
        }

        if (!valid) {
          const err = new CredentialsSignin("Incorrect password");
          err.code = "invalid_password";
          throw err;
        }

        db.hotelOwner.update({
          where: { id: owner.id },
          data:  { lastLoginAt: new Date() },
        }).catch(console.error);

        return {
          id:           owner.id,
          name:         owner.name,
          email:        owner.email,
          businessName: owner.businessName ?? "",
        } as any;
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id           = user.id;
        token.businessName = (user as any).businessName;
      }
      return token;
    },

    async session({ session, token }) {
      session.user.id                    = token.id as string;
      (session.user as any).businessName = token.businessName ?? null;
      return session;
    },
  },
});
