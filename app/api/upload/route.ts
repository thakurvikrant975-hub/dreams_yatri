// app/api/upload/route.ts
import { NextRequest, NextResponse } from "next/server";
import { uploadToR2, type ImageFolder } from "@/app/lib/r2/r2upload";

/**
 * What this endpoint will accept — a SUBSET of ImageFolder, deliberately.
 * ImageFolder is every folder R2 knows about; some of those (hotel-docs,
 * avatars, chat-attachments) are written by their own code paths and have no
 * business being addressable from an open upload endpoint.
 *
 * Typed as ImageFolder[] so that relationship is checked rather than assumed.
 * It previously was not, and the two lists had drifted in both directions —
 * vehicles/attractions/cab-drivers were accepted here while missing from the
 * union, which the `folder as any` below hid. The cost of that cast was a
 * folder name in neither list still type-checking, and failing only at runtime.
 */
const VALID_FOLDERS: readonly ImageFolder[] = [
    "regions", "destinations", "hotels", "packages", "activities", "vehicles",
    "attractions", "cab-drivers", "blogs", "team-members", "landing-pages",
    "payment-receipts", "payment-proofs",
];

/** Narrows the form field to a folder we accept, so no cast is needed below. */
function isValidFolder(v: string): v is ImageFolder {
    return (VALID_FOLDERS as readonly string[]).includes(v);
}
const ALLOWED_TYPES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/avif"];
const MAX_SIZE = 20 * 1024 * 1024; // 20MB

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;
        const folder = formData.get("folder") as string | null;
        const nameHint = (formData.get("name") as string | null) ?? undefined;

        if (!file) return NextResponse.json({ error: "No file provided" }, { status: 400 });
        if (!folder) return NextResponse.json({ error: "No folder provided" }, { status: 400 });

        if (!isValidFolder(folder)) {
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
            folder,
            fileName: file.name,
            nameHint,
            contentType: file.type,
        });

        return NextResponse.json(result);

    } catch (err) {
        console.error("[Upload API Error]", err);
        return NextResponse.json({ error: "Upload failed" }, { status: 500 });
    }
}