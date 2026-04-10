import Profile from './ProfileClient';
import { auth } from '@/app/lib/auth';
import { db } from '@/app/lib/db';
import { redirect } from 'next/navigation';

export default async function ProfilePage() {

  let user = null;

  try {
    const session = await auth();
    if (!session?.user) redirect("/");

    user = await db.user.findUnique({
      where: { id: session.user.id },
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
    });


    if (!user) redirect("/");

  } catch (err) {
    console.log(err)
    return;
  }


  return (
    <div>
      <Profile user={user} />
    </div>
  )
}


