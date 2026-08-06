// app/layout.tsx
import { Providers } from "./providers";
import MobileBottomNav from "@/app/components/navigation/MobileBottomNav";
import ModalRoot from "@/app/components/modals/ModalRoot";
import { Toaster } from "sonner";
import AppToastContainer from "@/app/components/ui/AppToastContainer";


export const metadata = {
  metadataBase: new URL("https://dreamsyatri.com"),
  title: {
    default: "DreamsYatri – Explore More, Travel Better | Tours, Hotels & Holiday Deals",
    template: "%s | DreamsYatri",
  },
  description: "Book exciting holiday packages, top-rated hotels, and unique travel experiences tailored just for you. Start exploring today!",
  keywords: ["adventure travel India", "travel experiences", "hotel booking online", "trip planner India", "travel deals", "customized tours", "travel packages India"],
  openGraph: {
    type: "website",
    url: "https://dreamsyatri.com",
    title: "DreamsYatri",
    description: "Book exciting holiday packages, top-rated hotels, and unique travel experiences tailored just for you. Start exploring today!",
    images: ["/og-image.jpg"],
  },
  twitter: {
    card: "summary_large_image",
  },
};


export default function WebsiteLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Providers>
      {/* Inside data-layout so the nav can read --bottom-nav-height, which is
          scoped to the website token block. */}
      <div className="mx-auto" data-layout='website'>
        {children}
        <MobileBottomNav />
      </div>
      <ModalRoot />
      <Toaster position="top-center" richColors />
      <AppToastContainer />
    </Providers>
  );
}