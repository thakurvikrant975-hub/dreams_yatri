import { dashboardAuth } from "@/app/lib/auth-dashboard";
import { getCurrentMember } from "@/app/(dashboard)/dashboard/(main)/lib/get-current-member";
import { AppSidebar } from "./AppSidebar";

export async function AppSidebarLoader() {
  const session = await dashboardAuth();
  const member = session ? await getCurrentMember(session) : null;

  const raw = member?.teamRole?.pageAccess;
  const pageAccess: string[] | null =
    Array.isArray(raw) && raw.length > 0 ? (raw as string[]) : null;

  return <AppSidebar pageAccess={pageAccess} />;
}
