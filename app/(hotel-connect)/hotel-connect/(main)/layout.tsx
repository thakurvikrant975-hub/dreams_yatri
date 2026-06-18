import { redirect } from "next/navigation";
import { hotelConnectAuth } from "@/app/lib/auth-hotel-connect";
import ConnectSidebar from "./components/ConnectSidebar";
import { Toaster } from "sonner";

export default async function HotelConnectLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await hotelConnectAuth();
  if (!session) redirect("/hotel-connect/login");

  return (
    <div className="flex min-h-screen bg-gray-50">
      <ConnectSidebar />
      <main className="flex-1 flex flex-col overflow-hidden">
        {children}
      </main>
      <Toaster position="top-center" />
    </div>
  );
}
