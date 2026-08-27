// app/(dashboard)/dashboard/(builder)/layout.tsx
//
// Full-screen layout for standalone dashboard tools (currently: Package
// Builder) that shouldn't be squeezed inside the AppSidebar + top header
// chrome from (main)/layout.tsx — e.g. on mobile, where every extra pixel
// of chrome fights the editor for space. Mirrors that layout's auth +
// RBAC page-access enforcement exactly (moving a route out of (main) also
// moves it out of that layout's protection), just without the sidebar/header.

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { Toaster } from "sonner";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { resolveNavHref } from "@/app/(dashboard)/dashboard/(main)/lib/rbac/nav-hrefs";
import { PackageStatusNotifier } from "@/app/(dashboard)/dashboard/(main)/(sales)/sales-query/PackageStatusNotifier";

function parsePageAccess(raw: unknown): string[] {
  return Array.isArray(raw) ? raw.filter((href): href is string => typeof href === "string") : [];
}

export default async function BuilderLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await dashboardAuth();
  if (!session) redirect("/dashboard/login");

  const ctx = await getEffectiveMember(session);
  if (!ctx) redirect("/dashboard/login");

  const { realMember, member } = ctx;

  if (!realMember.teamRole) redirect("/dashboard");

  const pageAccess = parsePageAccess(member.teamRole?.pageAccess);
  const isFullStackDev = realMember.teamRole?.name?.toLowerCase() === "full stack developer";

  if (pageAccess.length > 0 && !isFullStackDev) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    const matched = resolveNavHref(pathname);
    if (matched && !pageAccess.includes(matched)) {
      const fallback = pageAccess[0] ?? "/dashboard";
      if (pathname !== fallback) redirect(fallback);
    }
  }

  // The builder is where a sales exec actually spends their day, and it is the
  // one layout this notifier was never mounted in — so "the hotel team filled
  // your day" reached an exec only if they happened to be somewhere else in
  // the dashboard when the ~20s poll came round. That is most of the reason
  // fills "didn't reach" anyone: the message had nowhere to land.
  const isSales = realMember.teamRole?.name?.toLowerCase() === "sales executive";

  return (
    <div className="min-h-screen bg-dashboard-base-200">
      {children}
      <Toaster position="top-center" />
      {isSales && <PackageStatusNotifier />}
    </div>
  );
}
