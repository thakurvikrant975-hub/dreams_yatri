import { Metadata } from "next";
import HomeClient from "./HomeClient";
import { SITE_CONFIG, SITE_URL } from "@/app/lib/seo/site-config";

export const metadata: Metadata = {
  title: SITE_CONFIG.seo.defaultTitle,
  description: SITE_CONFIG.seo.defaultDescription,
  alternates: { canonical: SITE_URL },
  openGraph: {
    title: SITE_CONFIG.seo.defaultTitle,
    description: SITE_CONFIG.seo.defaultDescription,
    url: SITE_URL,
    siteName: SITE_CONFIG.name,
    type: "website",
    locale: SITE_CONFIG.seo.locale,
    images: [{ url: SITE_CONFIG.defaultOgImage, width: 1200, height: 630, alt: SITE_CONFIG.name }],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_CONFIG.seo.twitterHandle,
    title: SITE_CONFIG.seo.defaultTitle,
    description: SITE_CONFIG.seo.defaultDescription,
    images: [SITE_CONFIG.defaultOgImage],
  },
};

export default function Page() {
  return <HomeClient />;
}