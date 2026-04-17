"use server";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { db } from "@/app/lib/db";
import { createSession } from "@/app/lib/auth-dashboard";
import { z } from "zod";

const LoginSchema = z.object({
  email: z
    .string()
    .email("Invalid email address")
    .endsWith("@dreamsyatri.com", "Only company emails are allowed"),
  password: z.string().min(6, "Invalid credentials"),
});

export type LoginState = {
  error?: string;
  fieldErrors?: { email?: string[]; password?: string[] };
};

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  // 1. Validate input
  const parsed = LoginSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) {
    return { fieldErrors: parsed.error.flatten().fieldErrors };
  }

  const { email, password } = parsed.data;

  try {
    // 2. Fetch member with role and permissions
    const member = await db.teamMember.findUnique({
      where: { email },
      select: {
        id: true,
        name: true,
        email: true,
        password: true,
        isActive: true,
        departmentId: true,
        teamRole: {
          select: {
            name: true,
            permissions: true,
          },
        },
      },
    });

    // 3. Generic error — never reveal whether email exists
    if (!member || !member.password) {
      return { error: "Invalid credentials" };
    }

    // 4. Account status check
    if (!member.isActive) {
      return { error: "Your account has been deactivated. Contact your administrator." };
    }

    // 5. Password verification
    const passwordMatch = await bcrypt.compare(password, member.password);
    if (!passwordMatch) {
      return { error: "Invalid credentials" };
    }

    // 6. Update last login timestamp (non-blocking)
    await db.teamMember.update({
      where: { id: member.id },
      data: { lastLoginAt: new Date() },
    });

    // 7. Create JWT session with RBAC payload
    await createSession({
      memberId: member.id,
      email: member.email,
      name: member.name,
      role: member.teamRole?.name ?? null,
      permissions: member.teamRole?.permissions ?? [],
      departmentId: member.departmentId ?? null,
    });
  } catch (err) {
    console.error("[LOGIN_ACTION]", err);
    return { error: "Something went wrong. Please try again." };
  }

  // 8. Redirect outside try-catch (redirect() throws internally in Next.js)
  redirect("/dashboard");
}