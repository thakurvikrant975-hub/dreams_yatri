// app/api/package-builder/send-email/route.ts
//
// A Route Handler rather than a Server Action: the client attaches the
// full itinerary PDF (a client-generated Blob, potentially several MB once
// every hotel/activity photo is baked in), and Next's Server Action wire
// format (React Flight) can't reliably carry a payload that large — it
// throws "Maximum array nesting exceeded" trying to serialize a huge base64
// string as an action argument. A plain fetch() POST with FormData has no
// such limit, and matches the pattern this app already uses for photo
// uploads (see app/api/upload/route.ts).
import { NextRequest, NextResponse } from "next/server";
import { emailPackageToClient } from "@/app/(dashboard)/dashboard/(builder)/package-builder/email-package";

const MAX_SIZE = 20 * 1024 * 1024; // 20MB — matches app/api/upload/route.ts

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const packageId = formData.get("packageId") as string | null;
    const pdf = formData.get("pdf") as File | null;

    if (!packageId) {
      return NextResponse.json({ success: false, error: "No packageId provided" }, { status: 400 });
    }
    if (pdf && pdf.size > MAX_SIZE) {
      return NextResponse.json({ success: false, error: "PDF is too large to email (max 20MB)" }, { status: 400 });
    }

    const pdfAttachment = pdf
      ? {
          filename: pdf.name || "itinerary.pdf",
          content:  Buffer.from(await pdf.arrayBuffer()).toString("base64"),
        }
      : null;

    const result = await emailPackageToClient(packageId, pdfAttachment);
    return NextResponse.json(result, { status: result.success ? 200 : 400 });
  } catch (err) {
    console.error("[send-email route]", err);
    return NextResponse.json({ success: false, error: "Failed to send email" }, { status: 500 });
  }
}
