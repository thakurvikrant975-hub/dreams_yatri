// app/(dashboard)/layout.tsx
import { AppSidebar } from "./components/dashboard/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AvatarName from "./components/dashboard/AvatarName";
import { SalesTargetBadge } from "./components/dashboard/SalesTargetBadge";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { SalesStatusToggle } from "./components/dashboard/Salesstatustoggle";
import Image from "next/image";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const member = await getCurrentMember();
  if (!member) redirect("/dashboard/login");

  const isSales = member?.teamRole?.name?.toLowerCase() === "sales";

  return (
    <SidebarProvider>
      <AppSidebar />

      <main
        className="flex-1 overflow-y-auto min-h-screen bg-dashboard-base-200"
        data-layout="dashboard"
      >
        {/* Header */}
        <div
          className="flex justify-between items-center gap-4 px-6 py-3 sticky top-0 z-10 bg-dashboard-base-100 border-b border-dashboard-base-300">
          <SidebarTrigger />

          <div className="flex items-center gap-3 ml-auto">
            {isSales && <SalesTargetBadge memberId={member.id} />}

            <SalesStatusToggle
              memberId={member.id}
              initialActive={member.isActive}
            />

            <AvatarName
              name={session.user.name ?? "Employee"}
              email={session.user.email ?? "name@dreamsyatri.com"}
              role={session.user.role ?? "unknown"}
            />
          </div>
        </div>

        {/* Page Content */}
            <div className="relative p-6">
      {/* Web thread */}

      {/* Spider-Man PNG */}
      <Image
      width={120}
      height={120}
        src="/dashboard/spiderman.png" // 👈 replace with your image path
        alt="Spider-Man"
        className="absolute -top-2 right-4 w-20"
        style={{
          animation: "swing 4s ease-in-out infinite",
          transformOrigin: "top center",
        }}
      />

      <style>{`
        @keyframes swing {
          0%, 100% { transform: rotate(-12deg); }
          50%       { transform: rotate(12deg); }
        }
      `}</style>

      {children}
    </div>
      </main>

      <Toaster position="top-center" />
    </SidebarProvider>
  );
}