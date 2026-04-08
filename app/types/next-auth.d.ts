import "next-auth";
import "next-auth/jwt";
import { Role } from "@prisma/client";

declare module "next-auth" {
  interface Session {
    user: {
      id:                string;
      phone:             string;
      role:              Role;
      name?:             string | null;
      email?:            string | null;
      image?:            string | null;
      isProfileComplete: boolean;
    };
  }

  interface User {
    phone:             string;
    role:              Role;
    isProfileComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId:            string;
    phone:             string;
    role:              Role;
    isProfileComplete: boolean;
  }
}