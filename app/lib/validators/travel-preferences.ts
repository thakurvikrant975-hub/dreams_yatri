// lib/validations/travel-preferences.ts

import { z } from 'zod'

export const TripTypeEnum = z.enum([
  'Adventure', 'Leisure', 'Pilgrimage', 'Honeymoon',
  'Family', 'Corporate', 'Backpacking', 'Wildlife',
])

export const GroupTypeEnum = z.enum(['Solo', 'Couple', 'Family', 'Group'])

export const BudgetTierEnum = z.enum(['Budget', 'MidRange', 'Luxury', 'UltraLuxury'])

export const TripDurationEnum = z.enum(['Weekend', 'Short', 'Week', 'Long', 'Extended'])

export const TravelMonthEnum = z.enum([
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
])

export const TravelPreferenceSchema = z.object({
  tripTypes: z.array(TripTypeEnum).min(1, 'Select at least one trip type'),
  groupType: GroupTypeEnum.optional(),
  budget:    BudgetTierEnum.optional(),
  duration:  TripDurationEnum.optional(),
  months:    z.array(TravelMonthEnum).max(12).optional().default([]),
})

export type TravelPreferenceInput = z.infer<typeof TravelPreferenceSchema>