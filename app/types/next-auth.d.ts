// types/next-auth.d.ts

import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface Session {
    user: {
      id:                string;
      phone:             string;
      name?:             string | null;
      email?:            string | null;
      image?:            string | null;
      isProfileComplete: boolean;
    };
  }

  interface User {
    phone:             string;
    isProfileComplete: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    userId:            string;
    phone:             string;
    isProfileComplete: boolean;
  }
}