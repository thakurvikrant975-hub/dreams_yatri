// app/(dashboard)/layout.tsx
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { AppSidebar } from "./components/dashboard/AppSidebar";
import { SidebarProvider, SidebarTrigger } from "./components/ui/sidebar";
import AvatarName from "./components/dashboard/AvatarName";
import { SalesTargetBadge } from "./components/dashboard/SalesTargetBadge";
import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { signOutEmployee } from "@/app/lib/auth-dashboard-actions";
import { getEffectiveMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { computeVerificationCounts } from "@/app/services/verification-counts.service";
import { resolveNavHref } from "./lib/rbac/nav-hrefs";
import { Toaster } from "sonner";
import { OfflineDetector } from "./components/dashboard/OfflineDetector";
import { NumberInputScrollGuard } from "./components/dashboard/NumberInputScrollGuard";
import { FollowUpReminderProvider } from "./(sales)/sales-query/Followupreminderprovider";
import { PackageStatusNotifier } from "./(sales)/sales-query/PackageStatusNotifier";
import { ProfileCompletionBadge } from "./components/dashboard/ProfileCompletionBadge";
import { getMyProfile } from "./profile/actions";
import { NotificationBell } from "./components/dashboard/NotificationBell";
import { getUnreadNotificationCount } from "./lib/notifications-actions";

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

  const ctx = await getEffectiveMember(session);
  if (!ctx) redirect("/dashboard/login");

  const { realMember, member, isImpersonating } = ctx;

  // A member with no team role has no page access, no permissions, and no
  // department context to fall back on — block the entire dashboard (no
  // sidebar, no page content) until an admin assigns one, rather than
  // rendering a broken/empty shell.
  if (!realMember.teamRole) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-dashboard-base-200 px-6">
        <div className="max-w-md w-full text-center space-y-4 rounded-2xl border border-dashboard-base-300 bg-dashboard-base-100 px-8 py-10 shadow-sm">
          <div className="mx-auto h-14 w-14 rounded-full bg-dashboard-warning/10 flex items-center justify-center">
            <ShieldAlert className="h-7 w-7 text-dashboard-warning" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg font-semibold text-dashboard-base-content">Access Not Configured</h1>
            <p className="text-sm text-dashboard-base-content/60">
              Team role and department not specified. Please contact Admin.
            </p>
          </div>
          <form action={signOutEmployee}>
            <button
              type="submit"
              className="mt-2 w-full rounded-lg bg-dashboard-primary text-dashboard-primary-content text-sm font-medium py-2.5 hover:bg-dashboard-primary/90 transition-colors cursor-pointer"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    );
  }

  // Sidebar and page-access enforcement use the EFFECTIVE member's permissions,
  // so when FSD views as another member they see that member's restricted nav.
  const isFullStackDev = realMember.teamRole?.name?.toLowerCase() === "full stack developer";
  // FSD has no restrictions on their own nav — only while impersonating do
  // they see the effective (impersonated) member's restricted sidebar, as a
  // preview of what that member actually sees.
  const pageAccess = isFullStackDev && !isImpersonating
    ? []
    : parsePageAccess(member.teamRole?.pageAccess);

  // Server-side enforcement — sidebar visibility alone doesn't stop direct
  // URL access, so re-check the requested page against the role's pageAccess.
  // Skip enforcement for FSD (they have full access regardless of viewAs).
  if (pageAccess.length > 0 && !isFullStackDev) {
    const pathname = (await headers()).get("x-pathname") ?? "/dashboard";
    const matched = resolveNavHref(pathname);
    if (matched && !pageAccess.includes(matched)) {
      const fallback = pageAccess[0] ?? "/dashboard";
      if (pathname !== fallback) redirect(fallback);
    }
  }

  // Sales badge / toggle always belong to the real logged-in member.
  const isSales = realMember.teamRole?.name?.toLowerCase() === "sales executive";

  // "Viewing as" banner info: derive from the effective member when impersonating.
  const viewingAs = isImpersonating
    ? { id: member.id, name: member.name, roleName: member.teamRole?.name ?? undefined }
    : null;

  // Sidebar badge seed — the same "Total Pending" sources as the Verify
  // Hotels / Verify Cabs / Package Bookings pages themselves, then kept live
  // over Ably (no per-navigation refetch). Best-effort: these are cosmetic
  // badge counts, not auth/access data, so a DB hiccup here (e.g. the first
  // query after the connection pool sat idle overnight) must never take down
  // the whole dashboard — every user hits this on every page load, right
  // after login redirects here. Same "swallow and log" contract as this
  // function's sibling, broadcastVerificationCounts().
  const { hotelsPending, cabsPending, bookingsUnconfirmed, packagesPending, hotelRequestsPending } =
    await computeVerificationCounts().catch((e) => {
      console.error("[dashboard layout] verification counts failed, defaulting to 0:", e);
      return { hotelsPending: 0, cabsPending: 0, bookingsUnconfirmed: 0, packagesPending: 0, hotelRequestsPending: 0 };
    });

  // Same "never take the dashboard down over a cosmetic badge" contract as
  // the verification counts above — every page load hits this.
  const unreadNotificationCount = await getUnreadNotificationCount().catch((e) => {
    console.error("[dashboard layout] unread notification count failed, defaulting to 0:", e);
    return 0;
  });

  // "May I know you 🥰" onboarding popup — gated on the REAL logged-in
  // member (never the impersonated "view as" target, same rule the profile
  // page itself follows), and only on the fields that are actually required
  // to dismiss it. Everything else in the popup (family details, identity
  // docs) is optional and never blocks this from clearing.
  const missingRequiredFields = !realMember.gender
    || !realMember.personalMobile
    || !realMember.personalEmail
    || (!realMember.joiningDate && !realMember.joiningDateUnknown);
  // Dismissing the popup (X, Escape, outside click — see OnboardingPopup's
  // handleOpenChange) sets this cookie for ten minutes so closing it actually
  // buys some quiet time instead of it reappearing on the very next
  // navigation. Once the cookie expires, missing fields alone are enough to
  // bring it back on every page change again.
  const snoozed = !!(await cookies()).get("dy_onboarding_snooze")?.value;
  const needsOnboarding = missingRequiredFields && !snoozed;
  // Fetched unconditionally now (not just when the gate is due) so the
  // header's ProfileCompletionBadge always has something to open, letting
  // anyone jump into this form voluntarily instead of only when required
  // fields force it.
  const onboardingProfile = await getMyProfile();

  return (
    <SidebarProvider>
      {/* Sidebar reflects the effective member's page access.
          `no-print` only takes effect on pages that define the
          `@media print { .no-print { display: none } }` rule themselves
          (currently the invoice/voucher documents) — it's inert elsewhere,
          so this doesn't change print behavior for ordinary dashboard pages. */}
      <div className="no-print contents">
        <AppSidebar
          pageAccess={pageAccess}
          hotelsPending={hotelsPending}
          cabsPending={cabsPending}
          bookingsUnconfirmed={bookingsUnconfirmed}
          packagesPending={packagesPending}
          hotelRequestsPending={hotelRequestsPending}
        />
      </div>

      <main
        className="flex-1 overflow-y-auto min-h-screen bg-dashboard-base-200 print:overflow-visible print:min-h-0 print:bg-white"
        data-layout="dashboard"
      >
        <div className="no-print flex justify-between items-center gap-4 px-6 py-3 sticky top-0 z-10 bg-dashboard-base-100 border-b border-dashboard-base-300">
          <SidebarTrigger />

          <div className="flex items-center gap-3 ml-auto">
            {onboardingProfile && (
              <ProfileCompletionBadge
                profile={onboardingProfile}
                isComplete={!missingRequiredFields}
                autoOpen={needsOnboarding}
              />
            )}
            {isSales && <SalesTargetBadge memberId={realMember.id} />}
            <NotificationBell memberId={realMember.id} initialUnreadCount={unreadNotificationCount} />

{/* 
            <SalesStatusToggle
              memberId={realMember.id}
              initialActive={realMember.isActive}
            /> */}

            {/* Header always shows the real logged-in user's identity */}
            <AvatarName
              name={session.user.name ?? "Employee"}
              email={session.user.email ?? "name@dreamsyatri.com"}
              role={realMember.teamRole?.name ?? ""}
              avatarSrc={realMember.profilePicUrl ?? undefined}
              isFullStackDev={isFullStackDev}
              viewingAs={viewingAs}
            />
          </div>
        </div>

        <div className="relative p-6 print:p-0">
          {children}
        </div>
      </main>

      <Toaster position="top-center" />
      <OfflineDetector />
      <NumberInputScrollGuard />
      {isSales && <FollowUpReminderProvider />}
      {isSales && <PackageStatusNotifier />}
    </SidebarProvider>
  );
}
