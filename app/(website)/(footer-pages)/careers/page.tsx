// app/(website)/about/page.tsx

import { Metadata } from "next";
import { organizationSchema, breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import CareersPage from "./CareerClient";

export const metadata: Metadata = {
  title: "Careers at DreamsYatri | Join Our Team",
  description:
    "Explore exciting career opportunities at DreamsYatri. Join our growing travel company and build a rewarding career in tourism, sales, and customer experience.",
  keywords: [
    "DreamsYatri careers",
    "travel jobs India",
    "tourism jobs Shimla",
    "join travel company Shimla",
    "jobs in travel industry Shimla",
  ],
  alternates: { canonical: "/career" },
  openGraph: {
    title: "Careers at DreamsYatri",
    description:
      "Join DreamsYatri and be part of a passionate team creating unforgettable travel experiences.",
    url: "/career",
  },
};

export default function AboutPage() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Career", url: "/career" },
        ])}
      />
      <CareersPage />
    </>
  );
}