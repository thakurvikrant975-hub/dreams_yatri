// app/actions/hotels.ts
import { createLog } from "../lib/logger";
import { LogAction, LogSeverity } from "@/app/generated/prisma";
import { db } from "@/app/lib/db";

export async function createHotel(data: HotelInput) {
  const user = await getAuthenticatedUser();

  const hotel = await db.hotel.create({ data });

  await createLog({
    userId: user.id,
    userEmail: user.email,
    userName: user.name,
    userRole: user.role,
    userDesignation: user.designation,
    action: LogAction.CREATE,
    entity: "Hotel",
    entityId: hotel.id,
    entitySlug: hotel.slug,
    newData: hotel,
    severity: LogSeverity.LOW,
  });

  return { success: true, data: hotel };
}

// On failure:
await createLog({
  ...userContext,
  action: LogAction.CREATE,
  entity: "Hotel",
  status: LogStatus.FAILED,
  errorMessage: err.message,
  severity: LogSeverity.HIGH,
});