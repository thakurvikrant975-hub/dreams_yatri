// app/(website)/about/page.tsx

import { Metadata } from "next";
import AboutClient from "./AboutClient";
import { organizationSchema, breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";

export const metadata: Metadata = {
  title: "About Us",  // Renders as "About Us | DreamsYatri" via root template
  description:
    "DreamsYatri is a Shimla-based travel agency offering customized tour packages across Himachal Pradesh, Kashmir, Rajasthan, Goa, and international destinations.",
  alternates: {
    canonical: "/about",
  },
  openGraph: {
    title: "About Us | DreamsYatri",
    description:
      "DreamsYatri is a Shimla-based travel agency offering customized tour packages across Himachal Pradesh, Kashmir, Rajasthan, Goa, and international destinations.",
    url: "/about",
    images: [
      {
        url: "/og/about.jpg",   // Use a page-specific OG image, not a generic one
        width: 1200,
        height: 630,
        alt: "About DreamsYatri – Travel Agency in Shimla",
      },
    ],
  },
  twitter: {
    title: "About Us | DreamsYatri",
    description:
      "DreamsYatri is a Shimla-based travel agency offering customized tour packages across India and abroad.",
    images: ["/og/about.jpg"],
  },
};

export default function AboutPage() {
  return (
    <>
      <SchemaScript
        data={[
          organizationSchema(),
          breadcrumbSchema([
            { name: "Home", url: "/" },
            { name: "About Us", url: "/about" },
          ]),
        ]}
      />
      <AboutClient />
    </>
  );
}