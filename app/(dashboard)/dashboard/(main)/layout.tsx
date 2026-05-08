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
        className="flex-1 overflow-y-auto min-h-screen"
        data-layout="dashboard"
        style={{ backgroundColor: "var(--dashboard-base-200)" }}
      >
        {/* Header */}
        <div
          className="flex justify-between items-center gap-4 px-6 py-3 sticky top-0 z-10"
          style={{
            backgroundColor: "var(--dashboard-base-100)",
            borderBottom: "1px solid var(--dashboard-base-300)",
          }}
        >
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
        <div className="p-6">{children}</div>
      </main>

      <Toaster position="top-center" />
    </SidebarProvider>
  );
}