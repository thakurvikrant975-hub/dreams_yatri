// types/next-auth.d.ts

import "next-auth";
import "next-auth/jwt";
import { Role, UserStatus } from "@/app/generated/prisma"; // ← import from generated, not @prisma/client

declare module "next-auth" {
  interface Session {
    user: {
      id:                string;
      phone:             string | null;
      role:              Role;
      status:            UserStatus;
      isProfileComplete: boolean;
      name?:             string | null;
      image?:            string | null;
    };
  }

  interface User {
    phone:             string | null;
    role:              Role;
    status:            UserStatus;
    isProfileComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId:            string;
    phone:             string | null;
    role:              Role;
    status:            UserStatus;
    isProfileComplete: boolean;
    picture?:          string | null;
  }
}