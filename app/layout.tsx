import type { Metadata } from "next";
import "./globals.css";
import { Inter, Poppins} from "next/font/google";
import { cn } from "@/app/lib/utils";

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
  title: "Dreams Yatri",
  description: "Explore amazing travel destinations",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html  lang="en" className={cn(inter.variable, poppins.variable, "font-mono")}>
      <body className="antialiased">
        {children}
      </body>
    </html>
  );
}