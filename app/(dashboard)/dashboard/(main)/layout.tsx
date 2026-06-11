// app/(dashboard)/layout.tsx
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppSidebar } from "./components/dashboard/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AvatarName from "./components/dashboard/AvatarName";
import { SalesTargetBadge } from "./components/dashboard/SalesTargetBadge";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveNavHref } from "./lib/rbac/nav-hrefs";
import { Toaster } from "sonner";
import { SalesStatusToggle } from "./components/dashboard/Salesstatustoggle";

function parsePageAccess(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((href): href is string => typeof href === "string") : [];
}

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const member = await getCurrentMember(session);
  if (!member) redirect("/dashboard/login");

  const pageAccess = parsePageAccess(member.teamRole?.pageAccess);

  // Server-side enforcement — sidebar visibility alone doesn't stop direct
  // URL access, so re-check the requested page against the role's pageAccess.
  if (pageAccess.length > 0) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    const matched = resolveNavHref(pathname);
    if (matched && !pageAccess.includes(matched)) {
      const fallback = pageAccess[0] ?? "/dashboard";
      if (pathname !== fallback) redirect(fallback);
    }
  }

  const isSales = member.teamRole?.name?.toLowerCase() === "sales";

  return (
    <SidebarProvider>
      <AppSidebar pageAccess={pageAccess} />

      <main
        className="flex-1 overflow-y-auto min-h-screen bg-dashboard-base-200"
        data-layout="dashboard"
      >
        <div className="flex justify-between items-center gap-4 px-6 py-3 sticky top-0 z-10 bg-dashboard-base-100 border-b border-dashboard-base-300">
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
              role={member.teamRole?.name ?? ""}
              avatarSrc={member.profilePicUrl ?? undefined}
            />
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