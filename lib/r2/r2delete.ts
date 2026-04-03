import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { r2 } from "./r2";

export async function deleteFromR2(key: string) {
    await r2.send(
        new DeleteObjectCommand({
            Bucket: process.env.R2_BUCKET!,
            Key: key
        })
    )
}