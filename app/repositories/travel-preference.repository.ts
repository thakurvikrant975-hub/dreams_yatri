// app/repositories/travel-preference.repository.ts

import { db } from '@/app/lib/db'
import { Result, Ok, Err } from '@/app/lib/result'
import { TravelPreferenceInput } from '@/app/lib/validators/travel-preferences'
type TravelPreference = Awaited<ReturnType<typeof db.travelPreference.findUniqueOrThrow>>

export async function upsertTravelPreference(
  userId: string,
  data: TravelPreferenceInput,
): Promise<Result<TravelPreference>> {
  try {
    const preference = await db.travelPreference.upsert({
      where:  { userId },
      create: { userId, ...data },
      update: { ...data },
    })
    return Ok(preference)
  } catch (e) {
    return Err('DB_ERROR', 'Failed to save travel preferences', e)
  }
}

export async function getTravelPreference(
  userId: string,
): Promise<Result<TravelPreference | null>> {
  try {
    const preference = await db.travelPreference.findUnique({
      where: { userId },
    })
    return Ok(preference)
  } catch (e) {
    return Err('NOT_FOUND', 'Failed to fetch travel preferences', e)
  }
}