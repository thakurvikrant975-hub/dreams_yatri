import { db } from '@/app/lib/db';

async function main() {
  const booking = await db.booking.findUnique({
    where: { id: 'cmq7nfsy9000104l55boyeuqn' },
    select: { userId: true },
  });
  if (!booking) throw new Error('booking not found');

  const payments = await db.payment.findMany({
    where: { userId: booking.userId },
    select: {
      id: true, amount: true, currency: true, status: true, gateway: true, method: true,
      failureReason: true, refundAmount: true, refundedAt: true, paidAt: true, createdAt: true,
      booking: { select: { bookingNumber: true, startDate: true, packageId: true, package: { select: { title: true } }, destination: { select: { name: true } } } },
    },
  });
  console.log(JSON.stringify(payments, null, 2));

  const grouped = await db.payment.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('GROUPED', JSON.stringify(grouped, null, 2));
  process.exit(0);
}

main();
