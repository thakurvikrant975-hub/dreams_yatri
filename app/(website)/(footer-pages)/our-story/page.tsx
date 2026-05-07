// app/(website)/our-story/page.tsx

import { Metadata } from "next";
import { breadcrumbSchema } from "@/app/lib/seo/schema";
import SchemaScript from "@/app/components/seo/SchemaScript";
import OurStoryPage from "./OutStoryClient";

export const metadata: Metadata = {
  title: "Our Story",
  description:
    "Discover the story behind DreamsYatri – how we started, our mission, and our passion for creating unforgettable travel experiences across India.",
  keywords: [
    "DreamsYatri story",
    "about DreamsYatri",
    "travel company journey India",
    "tour agency mission vision",
    "DreamsYatri history",
  ],
  alternates: { canonical: "/our-story" },
  openGraph: {
    title: "Our Story - DreamsYatri",
    description:
      "Learn how DreamsYatri began its journey to become a trusted travel partner for unforgettable trips.",
    url: "/our-story",
  },
};

export default function OurStory() {
  return (
    <>
      <SchemaScript
        data={breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Our Story", url: "/our-story" },
        ])}
      />
      <OurStoryPage />
    </>
  );
}