"use server";

import crypto from "crypto";
import { hash } from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { Prisma } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";
import { hotelConnectSignIn } from "@/app/lib/auth-hotel-connect";
import { checkRateLimit } from "@/app/lib/rate-limit";
import { sendEmail } from "@/app/lib/functions/sendEmail";
import { hotelOwnerVerificationEmailTemplate } from "@/app/lib/functions/emailTemplates";

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit mobile number."),
  businessName: z.string().min(2, "Business / property name is required."),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters.")
    .regex(/[a-zA-Z]/, "Password must include at least one letter.")
    .regex(/[0-9]/, "Password must include at least one number."),
  confirmPassword: z.string(),
}).refine((d) => d.password === d.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
});

export type SignupState = {
  error?: string;
  fieldErrors?: {
    name?: string[];
    email?: string[];
    phone?: string[];
    businessName?: string[];
    password?: string[];
    confirmPassword?: string[];
  };
};

const SIGNUP_ATTEMPT_LIMIT = 5;
const SIGNUP_WINDOW_SECONDS = 60 * 60;

export async function signupAction(
  _prev: SignupState,
  formData: FormData
): Promise<SignupState> {
  const parsed = SignupSchema.safeParse({
    name:            formData.get("name"),
    email:           formData.get("email"),
    phone:           formData.get("phone"),
    businessName:    formData.get("businessName"),
    password:        formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { name, email, phone, businessName, password } = parsed.data;

  const rateKey = `ratelimit:hc-signup:${email.toLowerCase()}`;
  const { allowed } = await checkRateLimit(rateKey, SIGNUP_ATTEMPT_LIMIT, SIGNUP_WINDOW_SECONDS);
  if (!allowed) {
    return { error: "Too many signup attempts. Please wait a while and try again." };
  }

  // Check for duplicate email up front for a friendly field error in the
  // common case — the create below is still guarded against the race where
  // two signups for the same email land at almost the same instant.
  const existing = await db.hotelOwner.findUnique({
    where: { email },
    select: { id: true },
  });
  if (existing) {
    return { fieldErrors: { email: ["An account with this email already exists."] } };
  }

  const hashed = await hash(password, 12);
  const verificationToken = crypto.randomBytes(32).toString("hex");
  const verificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  try {
    await db.hotelOwner.create({
      data: {
        name,
        email,
        phone,
        businessName,
        password: hashed,
        status: "ACTIVE", // account live immediately; listing goes for review after tab 7
        email_verified: false,
        email_verification_token: verificationToken,
        email_verification_expires: verificationExpires,
      },
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
      return { fieldErrors: { email: ["An account with this email already exists."] } };
    }
    console.error("[signupAction] create failed:", err);
    return { error: "Something went wrong creating your account. Please try again." };
  }

  const verifyUrl = `${process.env.NEXT_PUBLIC_BASE_URL}/hotel-connect/verify-email?token=${verificationToken}`;
  sendEmail({
    to: email,
    subject: "Verify your Dreams Yatri Hotel Connect account",
    html: hotelOwnerVerificationEmailTemplate(name, verifyUrl),
  }).catch((err) => console.error("[signupAction] verification email failed:", err));

  // Auto sign-in and drop straight into the property listing wizard
  try {
    await hotelConnectSignIn("credentials", {
      email,
      password,
      redirectTo: "/hotel-connect/properties/new",
    });
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: "Account created but sign-in failed. Please log in manually." };
    }
    throw err; // re-throw the Next.js redirect
  }

  return {};
}
