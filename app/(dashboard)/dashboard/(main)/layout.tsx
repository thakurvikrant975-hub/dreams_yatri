// app/(dashboard)/layout.tsx

import { AppSidebar } from "./components/dashboard/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AvatarName from "./components/dashboard/AvatarName";

import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
    const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");
  
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto" data-layout='dashboard'>
        <div className="flex justify-between items-center gap-4 border-b px-6 py-3">
          <SidebarTrigger />
          <AvatarName
            name={session.user.name ?? "Employee"}
            email={session.user.email ?? "name@dreamsyatri.com"}
            role={session.user.role ?? "unknown"}
          />

        </div>
        <div className="p-6">{children}</div>
      </main>
              <Toaster position="top-center" />

    </SidebarProvider>
  );
}