import type { Metadata } from "next";
import "./globals.css";
import { Inter } from "next/font/google";
import { Poppins } from "next/font/google";
import { Dancing_Script } from "next/font/google";
import { cn } from "@/app/lib/utils";
import { GlobalProvider } from "./context/Global";
import { SITE_CONFIG } from "./lib/seo/site-config";
import SchemaScript from "./components/seo/SchemaScript";
import { organizationSchema, websiteSchema } from "./lib/seo/schema";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  weight: ["400", "500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-poppins",
  display: "swap",
});

/** Handwritten accent, used for the client's name on an itinerary cover and
 *  nothing else. Loaded properly rather than falling back to the CSS generic
 *  `cursive`, which resolves to a different face on every machine — these
 *  covers are printed to PDF and mailed out, so the one on the salesperson's
 *  screen has to be the one the client opens. */
const dancingScript = Dancing_Script({
  weight: ["600", "700"],
  subsets: ["latin"],
  variable: "--font-dancing-script",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL(SITE_CONFIG.url), // ← CRITICAL — fixes all relative URLs
  title: {
    default: SITE_CONFIG.seo.defaultTitle,
    template: SITE_CONFIG.seo.titleTemplate,
  },
  description: SITE_CONFIG.seo.defaultDescription,
  openGraph: {
    type: "website",
    locale: SITE_CONFIG.seo.locale,
    url: SITE_CONFIG.url,
    siteName: SITE_CONFIG.name,
    images: [
      {
        url: SITE_CONFIG.defaultOgImage,
        width: 1200,
        height: 630,
        alt: `${SITE_CONFIG.name} – Holiday Packages`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    site: SITE_CONFIG.seo.twitterHandle,
    creator: SITE_CONFIG.seo.twitterHandle,
  },
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
  verification: {
    google: "YOUR_GSC_VERIFICATION_TOKEN",  // Google Search Console
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={cn(inter.variable, poppins.variable, dancingScript.variable, "font-sans")}>
      <head>
        {/* Organization + Website schema on every page */}
        <SchemaScript data={[organizationSchema(), websiteSchema()]} />
      </head>
      <body className="antialiased">
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}