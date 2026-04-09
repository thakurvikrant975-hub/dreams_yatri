// app/types/profile.ts

import type { Gender, MaritalStatus, Role, UserStatus, TripType, GroupType, BudgetTier, TripDuration, TravelMonth } from "@/app/generated/prisma";

export type ProfileUser = {
  id:                     string;
  phone:                  string | null;
  country_code:           string;
  name:                   string | null;
  email:                  string | null;
  gender:                 Gender | null;
  dateOfBirth:            Date | null;
  nationality:            string | null;
  maritalStatus:          MaritalStatus | null;
  anniversary:            Date | null;
  state:                  string | null;
  city:                   string | null;
  passportNumber:         string | null;
  passportExpiryDate:     Date | null;
  passportIssuingCountry: string | null;
  panNumber:              string | null;
  isProfileComplete:      boolean;
  image:                  string | null;
  role:                   Role;
  status:                 UserStatus;
};

export type ProfilePreferences = {
  tripTypes:  TripType[];
  groupType:  GroupType | null;
  budget:     BudgetTier | null;
  duration:   TripDuration | null;
  months:     TravelMonth[];
} | null;