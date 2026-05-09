import type { Metadata } from "next";
import PackageBuilderClient from "./PackageBuilderClient";

export const metadata: Metadata = {
  title: "Package Builder - Dashboard",
  description: "Package Builder page",
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
    },
  },
};

export default function Page() {
  return <PackageBuilderClient />;
}