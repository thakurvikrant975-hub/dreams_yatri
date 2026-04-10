// // app/api/payments/initiate/route.ts

// import { NextRequest, NextResponse } from "next/server";
// import { db } from "@/app/lib/db";
// import { getAuthenticatedUser } from "@/app/lib/functions/getAuthenticatedUser";
// import Razorpay from "razorpay";

// const razorpay = new Razorpay({
//   key_id:     process.env.RAZORPAY_KEY_ID!,
//   key_secret: process.env.RAZORPAY_KEY_SECRET!,
// });

// export async function POST(req: NextRequest) {
//   const sessionUser = await getAuthenticatedUser();
//   if (!sessionUser) {
//     return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
//   }

//   const { bookingId } = await req.json();

//   if (!bookingId) {
//     return NextResponse.json({ error: "bookingId is required." }, { status: 400 });
//   }

//   // Verify booking belongs to user
//   const booking = await db.booking.findFirst({
//     where: { id: bookingId, userId: sessionUser.id },
//   });

//   if (!booking) {
//     return NextResponse.json({ error: "Booking not found." }, { status: 404 });
//   }

//   const amountDue = Number(booking.totalAmount) - Number(booking.paidAmount);

//   if (amountDue <= 0) {
//     return NextResponse.json({ error: "Booking is already fully paid." }, { status: 400 });
//   }

//   // Create Razorpay order
//   const order = await razorpay.orders.create({
//     amount:   Math.round(amountDue * 100), // paise
//     currency: booking.currency,
//     receipt:  booking.bookingNumber,
//   });

//   // Create pending payment record
//   await db.payment.create({
//     data: {
//       bookingId:      bookingId,
//       userId:         sessionUser.id,
//       amount:         amountDue,
//       currency:       booking.currency,
//       gateway:        "RAZORPAY",
//       status:         "PENDING",
//       gatewayOrderId: order.id,
//     },
//   });

//   return NextResponse.json({
//     orderId:  order.id,
//     amount:   amountDue,
//     currency: booking.currency,
//     keyId:    process.env.RAZORPAY_KEY_ID,
//   });
// }