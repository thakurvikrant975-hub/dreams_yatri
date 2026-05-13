import { PackageForm } from "../components/PackageForm";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "New Packages  - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

export default function NewPackagePage() {
  return (
      <PackageForm />
  );
}   