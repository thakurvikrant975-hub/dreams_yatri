"use server";

import { hash } from "bcryptjs";
import { z } from "zod";
import { AuthError } from "next-auth";
import { db } from "@/app/lib/db";
import { hotelConnectSignIn } from "@/app/lib/auth-hotel-connect";

const SignupSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters."),
  email: z.string().email("Please enter a valid email address."),
  phone: z
    .string()
    .regex(/^\d{10}$/, "Enter a valid 10-digit mobile number."),
  businessName: z.string().min(2, "Business / property name is required."),
  password: z.string().min(8, "Password must be at least 8 characters."),
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

  // Check for duplicate email
  const existing = await db.hotelOwner.findUnique({
    where: { email },
    select: { id: true },
  });

  if (existing) {
    return { fieldErrors: { email: ["An account with this email already exists."] } };
  }

  const hashed = await hash(password, 12);

  await db.hotelOwner.create({
    data: {
      name,
      email,
      phone,
      businessName,
      password: hashed,
      status: "ACTIVE", // account live immediately; listing goes for review after tab 7
    },
  });

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
