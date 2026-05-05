"use server";

import { createPackageSchema } from "@/app/validators/package.validator";
import { createPackages} from "@/app/services/package.service";
import { createPackagesTypes } from "@/app/types/package";

export async function createPackage(data: createPackagesTypes) {
  // 1. Validate input
  const parsed = createPackageSchema.safeParse(data);

  if (!parsed.success) {
    return {
      success: false,
      type: "validation",
      error: parsed.error.issues,
    };
  }

  try {
    const res = await createPackages(parsed.data);

    return {
      success: true,
      data: res,
    };
  } catch (error: any) {
    console.error("Create Package Error:", error);

    if (error.code === "P2002") {
      return {
        success: false,
        type: "conflict",
        message: "Slug already exists",
      };
    }

    return {
      success: false,
      type: "server",
      message: "Something went wrong",
    };
  }
}