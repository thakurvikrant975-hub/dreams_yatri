// app/api/payments/verify/route.ts

import { NextRequest, NextResponse } from "next/server";
import { db } from "@/app/lib/db";
import crypto from "crypto";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;

  // Verify signature
  const expectedSignature = crypto
    .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET!)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest("hex");

  if (expectedSignature !== razorpay_signature) {
    return NextResponse.json({ error: "Invalid payment signature." }, { status: 400 });
  }

  // Find payment record
  const payment = await db.payment.findFirst({
    where: { gatewayOrderId: razorpay_order_id },
    include: { booking: true },
  });

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found." }, { status: 404 });
  }

  // Update payment
  await db.payment.update({
    where: { id: payment.id },
    data: {
      status:           "SUCCESS",
      gatewayPaymentId: razorpay_payment_id,
      gatewaySignature: razorpay_signature,
      paidAt:           new Date(),
    },
  });

  // Update booking paid amount
  const newPaidAmount = Number(payment.booking.paidAmount) + Number(payment.amount);
  const isFullyPaid   = newPaidAmount >= Number(payment.booking.totalAmount);

  await db.booking.update({
    where: { id: payment.bookingId },
    data: {
      paidAmount: newPaidAmount,
      status:     isFullyPaid ? "UPCOMING" : payment.booking.status,
    },
  });

  return NextResponse.json({ success: true });
}