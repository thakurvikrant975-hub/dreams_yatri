import { Metadata } from "next";
import AboutClient from "./AboutClient";
import { organizationSchema, breadcrumbSchema } from "@/app/lib/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";

export const metadata: Metadata = {
  title: "About Us",
  description:
    "Learn about DreamsYatri – a trusted travel company in India offering customized tour packages, expert planning, and unforgettable travel experiences.",
  keywords: [
    "about DreamsYatri",
    "travel company India",
    "tour agency India",
  ],
  openGraph: {
    title: "About Us",
    description: "Learn about DreamsYatri – a trusted travel company in India offering customized tour packages, expert planning, and unforgettable travel experiences.",
    images: ["/about-og.jpg"],
  },
};

export default function AboutPage() {
  return (
    <>
    <SchemaScript data={organizationSchema()} />
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "About", url: "/about" },
        ])}
      />
      <AboutClient />;
    </>
  );
}