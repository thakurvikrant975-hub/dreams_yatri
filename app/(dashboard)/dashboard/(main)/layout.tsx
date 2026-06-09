// app/(dashboard)/layout.tsx
import { Suspense } from "react";
import { AppSidebarLoader } from "./components/dashboard/AppSidebarLoader";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AvatarName from "./components/dashboard/AvatarName";
import { SalesTargetBadge } from "./components/dashboard/SalesTargetBadge";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { SalesStatusToggle } from "./components/dashboard/Salesstatustoggle";
import { Skeleton } from "./components/ui/skeleton";

function AppSidebarSkeleton() {
  return (
    <div className="w-[--sidebar-width] shrink-0 bg-dashboard-base-100 border-r border-dashboard-base-300 flex flex-col gap-3 p-4">
      <Skeleton className="h-8 w-28 mb-2" />
      {Array.from({ length: 8 }).map((_, i) => (
        <Skeleton key={i} className="h-7 w-full rounded-md" />
      ))}
    </div>
  );
}

// Async user section — wrapped in Suspense so the layout shell renders immediately
async function HeaderUserSection() {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const member = await getCurrentMember(session);
  if (!member) redirect("/dashboard/login");

  const isSales = member?.teamRole?.name?.toLowerCase() === "sales";

  return (
    <>
      {isSales && <SalesTargetBadge memberId={member.id} />}

      <SalesStatusToggle
        memberId={member.id}
        initialActive={member.isActive}
      />

      <AvatarName
        name={session.user.name ?? "Employee"}
        email={session.user.email ?? "name@dreamsyatri.com"}
        role={member.teamRole?.name ?? ""}
        avatarSrc={member.profilePicUrl ?? undefined}
      />
    </>
  );
}

function HeaderSkeleton() {
  return (
    <div className="flex items-center gap-3">
      <Skeleton className="h-8 w-20 rounded-full" />
      <Skeleton className="h-8 w-8 rounded-full" />
    </div>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SidebarProvider>
      <Suspense fallback={<AppSidebarSkeleton />}>
        <AppSidebarLoader />
      </Suspense>

      <main
        className="flex-1 overflow-y-auto min-h-screen bg-dashboard-base-200"
        data-layout="dashboard"
      >
        {/* Header — shell renders immediately; user section streams in */}
        <div className="flex justify-between items-center gap-4 px-6 py-3 sticky top-0 z-10 bg-dashboard-base-100 border-b border-dashboard-base-300">
          <SidebarTrigger />

          <div className="flex items-center gap-3 ml-auto">
            <Suspense fallback={<HeaderSkeleton />}>
              <HeaderUserSection />
            </Suspense>
          </div>
        </div>

        <div className="relative p-6">
          {children}
        </div>
      </main>

      <Toaster position="top-center" />
    </SidebarProvider>
  );
}