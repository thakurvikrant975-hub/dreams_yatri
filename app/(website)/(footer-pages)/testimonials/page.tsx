// app/(website)/testimonials/page.tsx

import { Metadata } from "next";
import { breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import TestimonialsPage from "./TestimonialClient";

export const metadata: Metadata = {
  title: "Customer Reviews & Testimonials",
  description:
    "Read real customer reviews and testimonials of DreamsYatri. See how travelers experienced our holiday packages, services, and unforgettable journeys.",
  keywords: [
    "DreamsYatri reviews",
    "travel testimonials India",
    "customer reviews travel agency",
    "holiday package reviews",
    "DreamsYatri feedback",
  ],
  alternates: { canonical: "/testimonials" },
  openGraph: {
    title: "DreamsYatri Reviews & Testimonials",
    description:
      "Explore real experiences from our happy travelers and see why they trust DreamsYatri.",
    url: "/testimonials",
  },
};

export default function Testimonials() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Testimonials", url: "/testimonials" },
        ])}
      />
      <TestimonialsPage />
    </>
  );
}