// app/layout.tsx
import { Providers } from "./providers";
import ModalRoot from "@/app/components/modals/ModalRoot";
import { Toaster } from "sonner";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


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
      <div className="mx-auto" data-layout='website'>
        {children}
      </div>
      <ModalRoot />
      <Toaster position="top-center" richColors />
      <ToastContainer
        position="top-center"
        autoClose={3500}
        newestOnTop
        closeOnClick
        pauseOnHover
        theme="light"
        limit={3}
        toastClassName="!min-h-0 !rounded-xl !border !border-neutral-200 !bg-white !p-3 !text-sm !font-medium !text-neutral-800 !shadow-lg !shadow-black/10"
        progressClassName="!bg-primary-500"
      />
    </Providers>
  );
}