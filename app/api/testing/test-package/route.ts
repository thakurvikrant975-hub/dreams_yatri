import { NextResponse } from "next/server";
import { createPackages } from "@/app/services/package.service";

export async function GET() {
  const res = await createPackages({
    title: "Test Package",
    slug: "test-package",
    destination_id: 1,
    thumbnail: "test-thumbnail.jpg",
    description: "This is a test package.",
    inclusions: ["test inclusion"],
    exclusions: ["test exclusion"],
    tags: [],
    category: ["Adventure"],
  });

  return NextResponse.json(res);
}

// working fine