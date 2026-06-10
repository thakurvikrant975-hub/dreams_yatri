import { db } from '@/app/lib/db';
import { encode } from 'next-auth/jwt';

async function main() {
  const booking = await db.booking.findUnique({
    where: { id: 'cmq7nfsy9000104l55boyeuqn' },
    select: { userId: true, user: { select: { id: true, phone: true, role: true, status: true, isProfileComplete: true } } },
  });
  if (!booking?.user) throw new Error('user not found');

  const token = await encode({
    token: {
      userId: booking.user.id,
      phone: booking.user.phone,
      role: booking.user.role,
      status: booking.user.status,
      isProfileComplete: booking.user.isProfileComplete,
      sub: booking.user.id,
    },
    secret: process.env.AUTH_SECRET!,
    salt: 'authjs.session-token',
  });

  console.log('TOKEN=' + token);

  const sample = await db.booking.findMany({
    where: { userId: booking.user.id },
    take: 3,
    select: {
      id: true, bookingNumber: true, status: true, cancelledAt: true, createdAt: true,
      destination: { select: { name: true, country: true, thumbnail: true } },
    },
  });
  console.log(JSON.stringify(sample, null, 2));
  process.exit(0);
}

main();
