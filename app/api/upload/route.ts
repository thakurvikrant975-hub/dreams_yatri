// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadToR2 } from "@/lib/r2/r2upload";

const VALID_FOLDERS = ["regions", "destinations", "hotels", "packages", "activities"];
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folder = formData.get("folder") as string | null;

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (!folder) return NextResponse.json({ error: "No folder provided" }, { status: 400 });

        if (!VALID_FOLDERS.includes(folder)) {
            return NextResponse.json({ error: "Invalid folder" }, { status: 400 });
        }
        if (!ALLOWED_TYPES.includes(file.type)) {
            return NextResponse.json({ error: "File type not allowed" }, { status: 400 });
        }
        if (file.size > MAX_SIZE) {
            return NextResponse.json({ error: "Max file size is 20MB" }, { status: 400 });
        }

        const buffer = Buffer.from(await file.arrayBuffer());

        // Returns { key, url }
        const result = await uploadToR2({
            file: buffer,
            folder: folder as any,
            fileName: file.name,
            contentType: file.type,
        });

        return NextResponse.json(result);

    } catch (err) {
        console.error("[Upload API Error]", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}