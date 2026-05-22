// app/(dashboard)/dashboard/(auth)/login/actions.ts

"use server";

import { dashboardSignIn } from "@/app/lib/auth-dashboard";
import { AuthError } from "next-auth";
import { z } from "zod";

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

  try {
    await dashboardSignIn("credentials", {
      email: parsed.data.email,
      password: parsed.data.password,
      redirectTo: "/dashboard",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      switch (err.type) {
        case "CredentialsSignin": {
          const code = (err as any).code;
          if (code === "user_not_found") {
            return { error: "No account found with this email address. Please check and try again." };
          }
          if (code === "account_inactive") {
            return { error: "Your account has been deactivated. Please contact your administrator." };
          }
          if (code === "invalid_password") {
            return { error: "Incorrect password. Please try again." };
          }
          return { error: "Invalid email or password. Please check your credentials." };
        }
        case "AccessDenied":
          return { error: "Access denied. Your account may not have permission to log in." };
        case "CallbackRouteError": {
          const cause = (err as any).cause;
          console.error("[Dashboard Login] Callback error:", cause);
          if (cause?.message === "DB_CONNECTION_ERROR") {
            return { error: "Unable to connect to the database. Please try again in a moment." };
          }
          return { error: "A server error occurred during login. Please try again." };
        }
        default:
          console.error("[Dashboard Login] Unexpected auth error:", err.type, err);
          return { error: "Something went wrong. Please try again or contact support." };
      }
    }
    throw err; // re-throw redirect
  }

  return {};
}