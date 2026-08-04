/**
 * Manifest of every row a test clone creates, so teardown deletes exactly what
 * was made and nothing else.
 *
 * Why a JSON file rather than a table: a registry table would mean a schema
 * migration on the production database purely to support a testing tool. The
 * manifest is written next to the scripts and committed, so it survives between
 * runs and machines.
 *
 * Teardown never infers what to delete from name or slug patterns — a clone of a
 * real package looks exactly like a real package by design, so pattern-matching
 * is precisely how you would eventually delete live inventory. If the manifest is
 * missing, teardown refuses rather than guesses.
 *
 * Ordering matters: `entries` is append-ordered as rows are created, and teardown
 * walks it in reverse so children go before the parents they reference.
 */
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { createHash } from "crypto";
import { dbTarget } from "./_db";

/** Prisma model names this tool is allowed to create and delete. */
export type ClonedModel =
    | "packages" | "package_images" | "package_gallery" | "package_durations" | "package_routes"
    | "route_stops" | "package_stay_categories" | "package_pricing" | "package_itineraries"
    | "itinerary_stays" | "itinerary_activities" | "itinerary_attractions" | "itinerary_transfers"
    | "package_cab_types" | "package_cab_segments" | "package_permits"
    | "hotels" | "hotel_rooms" | "hotel_room_pricing" | "hotel_room_occupancy_prices"
    | "hotel_images" | "hotel_meal_pricing"
    | "activities" | "activity_variants" | "cab_pricing";

export type ClonedRow = { model: ClonedModel; id: string | number };

export type CloneManifest = {
    /** Which real rows this clone was made from — recorded for traceability only. */
    source: { packageSlug: string | null; hotelSlug: string | null };
    createdAt: string;
    entries: ClonedRow[];
};

/**
 * One manifest per database. Without this a clone run against production would
 * append to the manifest from a dev run, and teardown would then attempt to
 * delete dev row ids against production — ids that may well belong to unrelated
 * live rows there. The target is hashed rather than spelled out so the filename
 * carries no credentials.
 */
const MANIFEST_PATH = join(
    process.cwd(),
    "scripts",
    `test-clone-manifest.${createHash("sha256").update(dbTarget).digest("hex").slice(0, 8)}.json`,
);

export function manifestPath(): string {
    return MANIFEST_PATH;
}

export function manifestExists(): boolean {
    return existsSync(MANIFEST_PATH);
}

export function readManifest(): CloneManifest | null {
    if (!existsSync(MANIFEST_PATH)) return null;
    return JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as CloneManifest;
}

/** Accumulates rows during a clone run, then writes them out in one go. */
export class ManifestWriter {
    private entries: ClonedRow[] = [];

    constructor(private source: CloneManifest["source"]) {}

    /** Record a created row. Call immediately after every create. */
    add(model: ClonedModel, id: string | number): void {
        this.entries.push({ model, id });
    }

    get count(): number {
        return this.entries.length;
    }

    /** Merge with any existing manifest so a second clone doesn't orphan the first. */
    save(): void {
        const prior = readManifest();
        const merged: CloneManifest = {
            source: this.source,
            createdAt: new Date().toISOString(),
            entries: [...(prior?.entries ?? []), ...this.entries],
        };
        writeFileSync(MANIFEST_PATH, JSON.stringify(merged, null, 2) + "\n");
    }
}
