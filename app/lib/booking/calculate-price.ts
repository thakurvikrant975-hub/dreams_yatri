// lib/booking/calculate-price.ts

export type MealRates = {
  BREAKFAST: { VEG: number; NON_VEG: number };
  LUNCH:     { VEG: number; NON_VEG: number };
  DINNER:    { VEG: number; NON_VEG: number };
};

// What meals are included per plan
const MEAL_PLAN_INCLUDES: Record<string, ("BREAKFAST" | "LUNCH" | "DINNER")[]> = {
  EP:  [],
  CP:  ["BREAKFAST"],
  MAP: ["BREAKFAST", "DINNER"],
  AP:  ["BREAKFAST", "LUNCH", "DINNER"],
};

// Per-day meal cost for one hotel, one food preference, one meal plan
export function calculateDayMealCost(
  mealRates:      MealRates,
  mealPlan:       keyof typeof MEAL_PLAN_INCLUDES,
  foodPreference: "VEG" | "NON_VEG",
  travellers:     number
): {
  breakdown: { type: string; rate: number; total: number }[];
  totalPerDay: number;
} {
  const meals = MEAL_PLAN_INCLUDES[mealPlan];
  const breakdown = meals.map((meal) => {
    const rate = mealRates[meal][foodPreference];
    return {
      type:  meal,
      rate,
      total: rate * travellers,
    };
  });

  return {
    breakdown,
    totalPerDay: breakdown.reduce((sum, m) => sum + m.total, 0),
  };
}

// Full booking price — day-wise because each day can have a different hotel
export type DayInput = {
  dayNumber:      number;
  hotelRatePerRoom: number;
  mealRates:      MealRates;   // from hotel_meal_rates for this hotel
  checkInDate:    Date;
  checkOutDate:   Date;
};

export type FullPricingInput = {
  travellers:       number;
  roomSharingType:  "SHARED" | "PRIVATE";
  maxPerRoom:       number;    // from hotel_room_pricing.max_occupancy
  mealPlan:         "EP" | "CP" | "MAP" | "AP";
  foodPreference:   "VEG" | "NON_VEG";
  cabType:          string;
  cabCapacity:      number;
  cabRatePerDay:    number;
  totalDays:        number;    // duration + 1 (includes arrival day)
  days:             DayInput[]; // one per night
  marginPct:        number;    // 22
  gstPct:           number;    // 5
};

export type FullPricingBreakdown = {
  rooms:          number;
  cabs:           number;

  // Day-wise hotel + meal breakdown
  dayBreakdown: {
    dayNumber:    number;
    hotelCost:    number;
    meals: {
      type:       string;
      rate:       number;
      total:      number;
    }[];
    mealCostPerDay: number;
  }[];

  // Totals
  hotelCost:      number;
  mealCost:       number;
  cabCost:        number;
  subtotal:       number;
  marginPct:      number;
  marginAmount:   number;
  preGst:         number;
  gstPct:         number;
  gstAmount:      number;
  totalAmount:    number;
  perPersonCost:  number;
};

export function calculateFullBookingPrice(
  input: FullPricingInput
): FullPricingBreakdown {
  const {
    travellers, roomSharingType, maxPerRoom,
    mealPlan, foodPreference,
    cabCapacity, cabRatePerDay, totalDays,
    days, marginPct, gstPct,
  } = input;

  // Rooms — same count every night
  const rooms = roomSharingType === "PRIVATE"
    ? travellers
    : Math.ceil(travellers / maxPerRoom);

  // Cabs
  const cabs = Math.ceil(travellers / cabCapacity);
  const cabCost = cabs * cabRatePerDay * totalDays;

  // Day-wise hotel + meal costs
  let totalHotelCost = 0;
  let totalMealCost  = 0;

  const dayBreakdown = days.map((day) => {
    const hotelCost = rooms * day.hotelRatePerRoom;
    totalHotelCost += hotelCost;

    const { breakdown: meals, totalPerDay: mealCostPerDay } =
      calculateDayMealCost(
        day.mealRates,
        mealPlan,
        foodPreference,
        travellers
      );
    totalMealCost += mealCostPerDay;

    return {
      dayNumber: day.dayNumber,
      hotelCost,
      meals,
      mealCostPerDay,
    };
  });

  // Final calculation
  const subtotal     = totalHotelCost + cabCost + totalMealCost;
  const marginAmount = subtotal * (marginPct / 100);
  const preGst       = subtotal + marginAmount;
  const gstAmount    = preGst * (gstPct / 100);
  const totalAmount  = preGst + gstAmount;

  return {
    rooms,
    cabs,
    dayBreakdown,
    hotelCost:     Math.round(totalHotelCost),
    mealCost:      Math.round(totalMealCost),
    cabCost:       Math.round(cabCost),
    subtotal:      Math.round(subtotal),
    marginPct,
    marginAmount:  Math.round(marginAmount),
    preGst:        Math.round(preGst),
    gstPct,
    gstAmount:     Math.round(gstAmount),
    totalAmount:   Math.round(totalAmount),
    perPersonCost: Math.round(totalAmount / travellers),
  };
}