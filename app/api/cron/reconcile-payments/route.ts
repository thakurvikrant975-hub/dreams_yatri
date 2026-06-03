import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../auth";
import { reconcilePendingPayments } from "@/app/actions/payment/reconcile.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const summary = await reconcilePendingPayments();
    return NextResponse.json({ ok: true, ...summary });
}
