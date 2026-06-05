import { packagePaymentReceiptTemplate } from "@/app/lib/functions/emailTemplates";

export async function GET() {
    const html = packagePaymentReceiptTemplate({
        bookingNumber: "DY-260605-A1B2C3",
        packageName: "Manali Adventure Classic",
        destination: "Manali, Himachal Pradesh",
        travelDate: "15 July 2026",
        duration: "6 Days / 5 Nights",
        travellers: 2,
        breakdown: [
            { label: "Accommodation (5 Nights)", amount: "12,000" },
            { label: "Transport & Transfers", amount: "5,500" },
            { label: "Meals (Breakfast + Dinner)", amount: "3,000" },
            { label: "Sightseeing & Activities", amount: "2,500" },
        ],
        subtotal: "23,000",
        gst: "2,760",
        amountPaid: "7,930",
        paymentPlan: "DEPOSIT",
        balanceDue: "17,830",
        balanceDueDate: "1 July 2026",
        paymentMethod: "UPI",
        transactionId: "pay_QXZ123ABC456",
        paidAt: "5 June 2026",
        customerName: "Vikrant",
    });

    return new Response(html, {
        headers: { "Content-Type": "text/html; charset=utf-8" },
    });
}
