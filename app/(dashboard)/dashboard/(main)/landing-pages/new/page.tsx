import type { Metadata } from "next";
import { LandingPageEditorClient } from "../LandingPageEditorClient";

export const metadata: Metadata = {
  title: "New Landing Page - Dashboard",
  description: "",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
};

export default function Page() {
  return <LandingPageEditorClient initial={null} />;
}
