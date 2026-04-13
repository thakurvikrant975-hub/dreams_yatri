// app/(website)/profile/page.tsx

import Profile from './ProfileClient';
import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {
  try {
    const session = await auth();
    if (!session?.user) redirect("/");

    const [user, totalTrips, upcomingTrips] = await Promise.all([
      db.user.findUnique({
        where:  { id: session.user.id },
        select: {
          id: true, phone: true, country_code: true, name: true, email: true,
          gender: true, dateOfBirth: true, nationality: true, maritalStatus: true,
          anniversary: true, state: true, city: true, passportNumber: true,
          passportExpiryDate: true, passportIssuingCountry: true, panNumber: true,
          isProfileComplete: true, createdAt: true, updatedAt: true,
        },
      }),
      db.booking.count({
        where: { userId: session.user.id, status: "COMPLETED" },
      }),
      db.booking.count({
        where: { userId: session.user.id, status: "UPCOMING" },
      }),
    ]);

    if (!user) redirect("/");

    return (
      <Profile
        user={{
          ...user,
          totalTrips,
          upcomingTrips,
          wishlistCount: 0,   // ← placeholder until wishlist feature is built
        }}
      />
    );

  } catch (err) {
    console.error(err);
    redirect("/");
  }
}