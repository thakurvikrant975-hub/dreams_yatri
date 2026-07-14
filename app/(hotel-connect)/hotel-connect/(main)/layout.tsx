import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import ConnectSidebar from "./components/ConnectSidebar";
import MobileBottomNav from "./components/MobileBottomNav";
import { MobileNavProvider } from "./components/MobileNavContext";
import BetaFeedbackBar from "./components/BetaFeedbackBar";
import { Toaster } from "sonner";

export default async function HotelConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  return (
    <div
      className="flex flex-col h-screen bg-slate-100"
      style={{
        "--border-default": "var(--color-neutral-200, #e5e7eb)",
        "--border-muted": "var(--color-neutral-200, #e5e7eb)",
      } as React.CSSProperties}
    >
      <BetaFeedbackBar />
      <MobileNavProvider>
        <div className="flex flex-1 min-h-0">
          <ConnectSidebar />
          <main className="flex-1 flex flex-col overflow-y-auto min-w-0 pb-16 lg:pb-0">
            {children}
          </main>
          <MobileBottomNav />
        </div>
      </MobileNavProvider>
      <Toaster position="top-center" />
    </div>
  );
}
