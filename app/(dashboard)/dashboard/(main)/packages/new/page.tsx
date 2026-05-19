import { NewPackageClient } from "./NewPackageClient";
import type { Metadata } from "next";

export const metadata: Metadata = {
    title: "New Package - Dashboard",
    description: "",
    robots: {
        index: false,
        follow: false,
        nocache: true,
        googleBot: { index: false, follow: false },
    },
};

export default function NewPackagePage() {
  return <NewPackageClient />;
}
