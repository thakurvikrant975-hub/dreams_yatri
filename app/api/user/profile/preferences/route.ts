// app/api/user/preferences/route.ts

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { TravelPreferenceSchema } from '@/app/lib/validators/travel-preferences'
import { upsertTravelPreference, getTravelPreference }  from '@/app/repositories/travel-preference.repository'
export async function GET(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const result = await getTravelPreference(session.user.id)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ data: result.data })
}

export async function PATCH(req: NextRequest) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const parsed = TravelPreferenceSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 })
  }

  const result = await upsertTravelPreference(session.user.id, parsed.data)
  if (!result.success) return NextResponse.json({ error: result.error }, { status: 500 })

  return NextResponse.json({ data: result.data })
}