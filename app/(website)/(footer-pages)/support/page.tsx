// app/(website)/support/page.tsx

import { Metadata } from "next";
import { breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import SupportPage from "./SupportClient";

export const metadata: Metadata = {
  title: "Customer Support",
  description:
    "Need help with your trip? Get support from DreamsYatri for bookings, cancellations, itinerary changes, payments, and travel assistance.",
  keywords: [
    "DreamsYatri support",
    "travel customer support India",
    "booking help travel agency",
    "trip assistance India",
    "holiday package support",
  ],
  alternates: { canonical: "/support" },
  openGraph: {
    title: "DreamsYatri Customer Support",
    description:
      "Get quick help with bookings, cancellations, payments, and travel assistance.",
    url: "/support",
  },
};

export default function Support() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Support", url: "/support" },
        ])}
      />
      <SupportPage />
    </>
  );
}