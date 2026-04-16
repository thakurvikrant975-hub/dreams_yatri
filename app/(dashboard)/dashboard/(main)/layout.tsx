// app/(dashboard)/layout.tsx

import { AppSidebar } from "./components/dashboard/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <AppSidebar />
      <main className="flex-1 overflow-y-auto" data-layout='dashboard'>
        <div className="flex items-center gap-4 border-b px-6 py-3">
          <SidebarTrigger />
        </div>
        <div className="p-6">{children}</div>
      </main>
    </SidebarProvider>
  );
}