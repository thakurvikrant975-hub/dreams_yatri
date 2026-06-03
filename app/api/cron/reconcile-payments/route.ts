import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../auth";
import { reconcilePendingPayments, reconcileRefunds } from "@/app/actions/payment/reconcile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const payments = await reconcilePendingPayments();
    const refunds = await reconcileRefunds();
    return NextResponse.json({ ok: true, payments, refunds });
}
