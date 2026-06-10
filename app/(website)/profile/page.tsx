// app/(website)/profile/page.tsx

export const dynamic = 'force-dynamic';

import { Suspense } from 'react';
import Profile from './ProfileClient';
import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import { redirect } from 'next/navigation';
import { travelHistoryStatusWhere } from '@/app/lib/booking-display-status';

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  try {
    const session = await auth();
    if (!session?.user) redirect("/");

    const { tab } = await searchParams;

    const [user, totalTrips, upcomingTrips] = await Promise.all([
      db.user.findUnique({
        where:  { id: session.user.id },
        select: {
          id: true, phone: true, whatsapp: true, country_code: true, name: true, email: true,
          image: true,
          gender: true, dateOfBirth: true, nationality: true, maritalStatus: true,
          anniversary: true, state: true, city: true, passportNumber: true,
          passportExpiryDate: true, passportIssuingCountry: true, panNumber: true,
          isProfileComplete: true, createdAt: true, updatedAt: true,
        },
      }),
      db.booking.count({
        where: { userId: session.user.id, ...travelHistoryStatusWhere('COMPLETED') },
      }),
      db.booking.count({
        where: { userId: session.user.id, ...travelHistoryStatusWhere('UPCOMING') },
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
        initialTab={tab}
      />
    );

  } catch (err) {
    console.error(err);
    redirect("/");
  }
}