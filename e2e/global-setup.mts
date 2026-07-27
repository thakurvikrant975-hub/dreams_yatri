import fs from "fs/promises";
import path from "path";
import { ensureE2EBooking, ensureE2ECancellableBooking } from "./support/fixtures.mjs";
import { dashboardCookie, hotelConnectCookie, customerCookie } from "./support/auth.mjs";

const AUTH_DIR = path.join(process.cwd(), "e2e/.auth");

async function writeStorageState(file: string, cookie: Awaited<ReturnType<typeof dashboardCookie>>) {
    await fs.writeFile(
        path.join(AUTH_DIR, file),
        JSON.stringify({ cookies: [cookie], origins: [] }, null, 2),
    );
}

/** Runs once before the whole suite: seeds deterministic fixture data (so
 * specs don't depend on whatever happens to already be in the target DB)
 * and mints pre-authenticated sessions for each of the app's three separate
 * auth realms, saved as Playwright storageState files that projects in
 * playwright.config.ts load via `use.storageState`. */
export default async function globalSetup() {
    await fs.mkdir(AUTH_DIR, { recursive: true });

    await ensureE2EBooking();
    await ensureE2ECancellableBooking();

    await writeStorageState("dashboard.json", await dashboardCookie());
    await writeStorageState("hotel-connect.json", await hotelConnectCookie());
    await writeStorageState("customer.json", await customerCookie());
}
