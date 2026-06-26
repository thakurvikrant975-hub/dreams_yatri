-- Add veg_price and non_veg_price columns to hotel_meal_pricings
ALTER TABLE "hotel_meal_pricings" ADD COLUMN IF NOT EXISTS "veg_price" DECIMAL(10,2);
ALTER TABLE "hotel_meal_pricings" ADD COLUMN IF NOT EXISTS "non_veg_price" DECIMAL(10,2);
