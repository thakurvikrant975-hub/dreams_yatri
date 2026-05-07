// app/(website)/faq/page.tsx

import { Metadata } from "next";
import { breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import FAQPage from "./FaqClient";

export const metadata: Metadata = {
  title: "Travel FAQs",
  description:
    "Find answers to common questions about DreamsYatri holiday packages, bookings, cancellations, payments, itineraries, and travel assistance.",
  keywords: [
    "DreamsYatri FAQ",
    "travel booking questions",
    "holiday package FAQs",
    "trip cancellation policy",
    "travel support India",
  ],
  alternates: { canonical: "/faq" },
  openGraph: {
    title: "DreamsYatri FAQs",
    description:
      "Get quick answers about bookings, payments, cancellations, and travel planning with DreamsYatri.",
    url: "/faq",
  },
};

export default function FAQ() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "FAQ", url: "/faq" },
        ])}
      />
      <FAQPage />
    </>
  );
}