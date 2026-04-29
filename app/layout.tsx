import type { Metadata } from "next";
import "./globals.css";
import { Inter, Poppins} from "next/font/google";
import { cn } from "@/app/lib/utils";
import { GlobalProvider } from "./context/Global";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-poppins",
  display: "swap",
});


export const metadata: Metadata = {
  metadataBase: new URL("https://dreamsyatri.com"),
  title: {
    default: "DreamsYatri – Trusted Travel Agency in India",
    template: "%s | DreamsYatri",
  },
  description: "DreamsYatri offers customized tour packages across India and abroad.",
  openGraph: {
    siteName: "DreamsYatri",
    type: "website",
    locale: "en_IN",
  },
  twitter: {
    card: "summary_large_image",
    site: "@dreamsyatri",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html  lang="en" className={cn(inter.variable, poppins.variable, "font-mono")}>
      <body className="antialiased">
        <GlobalProvider>{children}</GlobalProvider>
      </body>
    </html>
  );
}