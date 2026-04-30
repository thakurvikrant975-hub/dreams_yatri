// app/(website)/contact/page.tsx

import { Metadata } from "next";
import { breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import ContactPage from "./ContactClient";

export const metadata: Metadata = {
  title: "Contact DreamsYatri | Plan Your Perfect Trip",
  description:
    "Get in touch with DreamsYatri for holiday packages, custom itineraries, hotel bookings, and travel support. Call or WhatsApp us for quick assistance.",
  keywords: [
    "contact DreamsYatri",
    "travel agency contact India",
    "book tour package India",
    "travel support DreamsYatri",
    "custom trip planning India",
  ],
  alternates: { canonical: "/contact" },
  openGraph: {
    title: "Contact DreamsYatri",
    description:
      "Connect with our travel experts for personalized holiday planning and support.",
    url: "/contact",
  },
};

export default function Contact() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Contact Us", url: "/contact" },
        ])}
      />
      <ContactPage />
    </>
  );
}