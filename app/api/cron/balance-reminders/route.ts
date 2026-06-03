import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../auth";
import { runBalanceReminders } from "@/app/actions/payment/reminders.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const summary = await runBalanceReminders();
    return NextResponse.json({ ok: true, ...summary });
}
