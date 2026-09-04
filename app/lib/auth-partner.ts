// app/lib/auth-partner.ts

import NextAuth, { CredentialsSignin } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { z } from "zod";
import { db } from "@/app/lib/db";

/**
 * The partner portal's own sign-in.
 *
 * A partner agency is an ordinary TeamMember carrying a role flagged
 * isPartnerAgency — that is what lets leads reach them through the same
 * `assignedTo` column, the same assign action and the same reports our own
 * executives use. What it must not give them is a staff session, so they sign
 * in here instead, against a cookie scoped to /partner. A partner session is
 * not merely unprivileged on /dashboard; it is never sent there.
 *
 * The staff login refuses these accounts outright (auth-dashboard.ts), so the
 * two doors stay separate in both directions.
 */

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const {
  auth: partnerAuth,
  signIn: partnerSignIn,
  signOut: partnerSignOut,
  handlers: partnerHandlers,
} = NextAuth({
  session: { strategy: "jwt", maxAge: 24 * 60 * 60 },

  cookies: {
    sessionToken: {
      name: "dy.partner.session-token",
      options: {
        httpOnly: true,
        sameSite: "strict",
        path: "/partner",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },

  pages: { signIn: "/partner/login", error: "/partner/login" },

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
            where: { email: email.toLowerCase() },
            select: {
              id: true, name: true, email: true, password: true, isActive: true,
              teamRole: { select: { isPartnerAgency: true } },
            },
          });
        } catch (dbError) {
          console.error("[Partner Auth] Database error during login:", dbError);
          throw new Error("DB_CONNECTION_ERROR");
        }

        /*
         * One answer for "no such account", "wrong password" and "that is a
         * staff account, not an agency". This page is reachable by anyone on
         * the internet, and distinguishing them would turn it into a way to
         * discover who our staff and partners are.
         */
        const reject = () => {
          const err = new CredentialsSignin("Incorrect email or password");
          err.code = "invalid_credentials";
          return err;
        };

        if (!member || !member.password) throw reject();
        if (!member.teamRole?.isPartnerAgency) throw reject();

        if (!member.isActive) {
          const err = new CredentialsSignin("Account deactivated");
          err.code = "account_inactive";
          throw err;
        }

        let valid = false;
        try {
          valid = await compare(password, member.password);
        } catch (bcryptError) {
          console.error("[Partner Auth] Password comparison error:", bcryptError);
          throw new Error("PASSWORD_COMPARE_ERROR");
        }
        if (!valid) throw reject();

        return { id: member.id, name: member.name, email: member.email };
      },
    }),
  ],

  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.agencyName = user.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id as string;
      (session.user as { agencyName?: string | null }).agencyName =
        (token.agencyName as string | undefined) ?? null;
      return session;
    },
  },
});

/**
 * The signed-in agency, or null.
 *
 * Every partner-facing query scopes on the id this returns and never on
 * anything the browser sent — one agency asking for another's leads must not
 * be able to get them by changing a parameter. Read through to the row rather
 * than trusting the token alone, so deactivating an account or moving it off
 * the agency role takes effect on the next request instead of whenever its
 * 24-hour token happens to lapse.
 */
export async function getCurrentAgency(): Promise<{ id: string; name: string } | null> {
  const session = await partnerAuth();
  const id = session?.user?.id;
  if (!id) return null;

  const member = await db.teamMember.findUnique({
    where: { id },
    select: { id: true, name: true, isActive: true, teamRole: { select: { isPartnerAgency: true } } },
  });
  if (!member || !member.isActive || !member.teamRole?.isPartnerAgency) return null;

  return { id: member.id, name: member.name };
}
