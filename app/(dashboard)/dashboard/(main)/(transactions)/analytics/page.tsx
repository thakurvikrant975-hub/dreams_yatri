import { getEffectiveMember } from "../../lib/get-current-member";
import { HotelDepartmentAnalyticsView } from "./HotelDepartmentAnalyticsView";

const HOTEL_DEPARTMENT_NAMES = ["hotel", "hotel department", "hotels", "hotel team"];

function isHotelDepartment(name: string | undefined | null): boolean {
  return !!name && HOTEL_DEPARTMENT_NAMES.includes(name.trim().toLowerCase());
}

export default async function AnalyticsPage() {
  const ctx = await getEffectiveMember();

  if (!ctx) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-center">
        <p className="text-lg font-semibold text-dashboard-base-content">Account not found</p>
        <p className="text-sm text-dashboard-base-content/60">
          Your session is valid but no team member record exists for this email.
        </p>
      </div>
    );
  }

  const { member } = ctx;

  if (member.department && isHotelDepartment(member.department.name)) {
    return (
      <HotelDepartmentAnalyticsView
        departmentId={member.department.id}
        departmentName={member.department.name}
      />
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] gap-2 text-center">
      <p className="text-lg font-semibold text-dashboard-base-content">Analytics</p>
      <p className="text-sm text-dashboard-base-content/60 max-w-sm">
        No analytics are configured for your department yet.
      </p>
    </div>
  );
}
