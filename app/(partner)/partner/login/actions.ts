"use server";

import { AuthError } from "next-auth";
import { z } from "zod";
import { partnerSignIn } from "@/app/lib/auth-partner";
import { checkRateLimit } from "@/app/lib/rate-limit";

const LOGIN_ATTEMPT_LIMIT = 8;
const LOGIN_WINDOW_SECONDS = 15 * 60;

const LoginSchema = z.object({
  email: z.string().email("Please enter a valid email address."),
  password: z.string().min(1, "Please enter your password."),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

export async function partnerLoginAction(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });
  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const rateKey = `ratelimit:partner-login:${parsed.data.email.toLowerCase()}`;
  const { allowed } = await checkRateLimit(rateKey, LOGIN_ATTEMPT_LIMIT, LOGIN_WINDOW_SECONDS);
  if (!allowed) {
    return { error: "Too many login attempts. Please wait a few minutes and try again." };
  }

  try {
    await partnerSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/partner/leads",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin": {
          const code = (err as { code?: string }).code;
          if (code === "account_inactive") {
            return { error: "This account has been deactivated. Please contact Dreams Yatri." };
          }
          // Everything else answers the same way — a wrong password and an
          // unknown email are indistinguishable on purpose, so this page
          // cannot be used to find out who our partners are.
          return { error: "Incorrect email or password." };
        }
        case "CallbackRouteError":
          return { error: "Unable to connect. Please try again in a moment." };
        default:
          return { error: "Something went wrong. Please try again." };
      }
    }
    throw err;
  }

  return {};
}
