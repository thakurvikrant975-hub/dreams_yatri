// app/(website)/profile/page.tsx

import Profile from './ProfileClient';
import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  try {
    const session = await auth();
    if (!session?.user) redirect("/");

    const userId = session.user.id;

    // ─── Fetch everything in parallel (OPTIMIZED) ───────────────────────────
    const [user, preferences, totalTrips] = await Promise.all([
      db.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          phone: true,
          country_code: true,
          name: true,
          email: true,
          gender: true,
          dateOfBirth: true,
          nationality: true,
          maritalStatus: true,
          anniversary: true,
          state: true,
          city: true,
          passportNumber: true,
          passportExpiryDate: true,
          passportIssuingCountry: true,
          panNumber: true,
          isProfileComplete: true,
          createdAt: true,
          updatedAt: true,
        },
      }),

      db.travelPreference.findUnique({
        where: { userId },
      }),

      db.booking.count({
        where: {
          userId,
          status: "COMPLETED",
        },
      }),
    ]);

    // ─── Safety check ───────────────────────────────────────────────────────
    if (!user) redirect("/");

    // ─── Merge computed stats ───────────────────────────────────────────────
    const enrichedUser = {
      ...user,
      totalTrips,
    };

    return (
      <Profile
        user={enrichedUser}
        preferences={preferences}
      />
    );

  } catch (error) {
    console.error("ProfilePage error:", error);
    redirect("/");
  }
}