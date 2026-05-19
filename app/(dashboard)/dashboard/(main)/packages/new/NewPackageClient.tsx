"use client";

import { useRouter } from "next/navigation";
import { PackageForm } from "../components/PackageForm";

export function NewPackageClient() {
  const router = useRouter();

  function handleSuccess(result: unknown) {
    const pkg = (result as { data?: { id?: number } })?.data;
    if (pkg?.id) {
      router.push(`/dashboard/packages/${pkg.id}?tab=images`);
    }
  }

  return <PackageForm onSuccess={handleSuccess} />;
}
