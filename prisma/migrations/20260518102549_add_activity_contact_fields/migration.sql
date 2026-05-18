-- AddColumn address, city, state, country, pincode, phone, email to activities
ALTER TABLE "activities" ADD COLUMN "address" TEXT;
ALTER TABLE "activities" ADD COLUMN "city"    TEXT;
ALTER TABLE "activities" ADD COLUMN "state"   TEXT;
ALTER TABLE "activities" ADD COLUMN "country" TEXT DEFAULT 'India';
ALTER TABLE "activities" ADD COLUMN "pincode" TEXT;
ALTER TABLE "activities" ADD COLUMN "phone"   TEXT;
ALTER TABLE "activities" ADD COLUMN "email"   TEXT;
