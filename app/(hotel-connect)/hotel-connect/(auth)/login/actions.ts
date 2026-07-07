"use server";

import { hotelConnectSignIn } from "@/app/lib/auth-hotel-connect";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { AuthError } from "next-auth";
import { z } from "zod";

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters."),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const rateKey = `ratelimit:hc-login:${parsed.data.email.toLowerCase()}`;
  const { allowed } = await checkRateLimit(rateKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!allowed) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  try {
    await hotelConnectSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/hotel-connect",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin": {
          const code = (err as any).code;
          // "No account" and "wrong password" intentionally share one message —
          // distinguishing them lets an attacker enumerate registered emails.
          if (code === "user_not_found" || code === "invalid_password") {
            return { error: "Invalid email or password. Please check your credentials." };
          }
          if (code === "account_inactive") {
            return { error: "Your account has been suspended. Please contact support." };
          }
          if (code === "pending_approval") {
            return { error: "Your account is awaiting approval from the DreamsYatri team. We'll notify you by email once it's active." };
          }
          return { error: "Invalid email or password. Please check your credentials." };
        }
        case "CallbackRouteError": {
          const cause = (err as any).cause;
          if (cause?.message === "DB_CONNECTION_ERROR") {
            return { error: "Unable to connect. Please try again in a moment." };
          }
          return { error: "A server error occurred. Please try again." };
        }
        default:
          return { error: "Something went wrong. Please try again." };
      }
    }
    throw err;
  }

  return {};
}
