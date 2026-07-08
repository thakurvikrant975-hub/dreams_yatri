import type { Metadata } from "next";
import Link from "next/link";
import { StarIcon } from "@phosphor-icons/react/dist/ssr";
import Header from "@/app/components/navigation/Header";
import Footer from "@/app/components/navigation/Footer";
import Card from "@/app/components/ui/Card";
import Button from "@/app/components/ui/Button";
import { Heading, Text } from "@/app/components/ui/Typography";
import { db } from "@/app/lib/db";
import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
import ReviewForm from "./ReviewForm";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Leave a review | Dreams Yatri",
  robots: { index: false, follow: false },
};

function StatusScreen({ heading, body }: { heading: string; body: string }) {
  return (
    <div className="screen-space py-16">
      <Card className="max-w-lg mx-auto px-8 py-10 text-center">
        <Heading level={3} weight="semibold">{heading}</Heading>
        <Text intent="secondary" className="mt-2 block">{body}</Text>
        <Link href="/packages" className="inline-block mt-6"><Button variant="premium">Browse packages</Button></Link>
      </Card>
    </div>
  );
}

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getAuthenticatedUser();

  let content: React.ReactNode;

  if (!user?.id) {
    content = <StatusScreen heading="Please log in" body="Log in to leave a review for your stay." />;
  } else {
    const booking = await db.booking.findUnique({
      where: { id },
      select: {
        id: true,
        userId: true,
        bookingNumber: true,
        status: true,
        hotelBookings: {
          select: { hotelId: true, hotel: { select: { id: true, name: true } } },
          distinct: ["hotelId"],
        },
      },
    });

    if (!booking || booking.userId !== user.id) {
      content = <StatusScreen heading="Booking not found" body="This booking doesn't exist or isn't associated with your account." />;
    } else if (booking.status !== "COMPLETED") {
      content = <StatusScreen heading="Not eligible for review yet" body="You can leave a review once your stay is complete." />;
    } else if (booking.hotelBookings.length === 0) {
      content = <StatusScreen heading="Nothing to review" body="This booking doesn't include a property stay." />;
    } else {
      const existingReviews = await db.hotel_review.findMany({
        where: { booking_id: booking.id, hotel_id: { in: booking.hotelBookings.map((h) => h.hotelId) } },
        select: { hotel_id: true, rating: true, comment: true },
      });
      const reviewedByHotel = new Map(existingReviews.map((r) => [r.hotel_id, r]));

      content = (
        <div className="screen-space py-10">
          <Card className="max-w-xl mx-auto px-8 py-9 space-y-5">
            <div className="text-center">
              <Heading level={2} weight="bold">Rate your stay</Heading>
              <Text intent="secondary" className="mt-2 block">
                Booking <span className="font-semibold text-primary">{booking.bookingNumber}</span>
              </Text>
            </div>

            {booking.hotelBookings.map(({ hotelId, hotel }) => {
              const existing = reviewedByHotel.get(hotelId);
              if (existing) {
                return (
                  <div key={hotelId} className="rounded-xl border border-neutral-200 bg-neutral-50 px-5 py-4">
                    <p className="text-sm font-semibold text-neutral-800 mb-1">{hotel.name}</p>
                    <div className="flex items-center gap-0.5 mb-1.5">
                      {[1, 2, 3, 4, 5].map((n) => (
                        <StarIcon key={n} size={16} weight={existing.rating >= n ? "fill" : "regular"} className={existing.rating >= n ? "text-amber-400" : "text-neutral-300"} />
                      ))}
                    </div>
                    {existing.comment && <Text intent="secondary" className="text-sm">{existing.comment}</Text>}
                    <p className="text-xs text-neutral-400 mt-1">You've already reviewed this stay — thank you!</p>
                  </div>
                );
              }
              return (
                <ReviewForm key={hotelId} bookingId={booking.id} hotelId={hotelId} hotelName={hotel.name} />
              );
            })}
          </Card>
        </div>
      );
    }
  }

  return (
    <>
      <Header />
      {content}
      <Footer />
    </>
  );
}
