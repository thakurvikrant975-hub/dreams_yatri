import { NextResponse } from "next/server";
import { isAuthorizedCron } from "../auth";
import { markMissedFollowUps } from "@/app/services/followup-discipline.service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
    if (!isAuthorizedCron(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    const summary = await markMissedFollowUps();
    return NextResponse.json({ ok: true, ...summary });
}
