import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;
const CI = !!process.env.CI;

export default defineConfig({
    testDir: "./e2e",
    // Fixture data is shared/deterministic (fixed IDs), not per-test-isolated,
    // so specs that touch the same booking must not run concurrently.
    fullyParallel: false,
    workers: 1,
    retries: CI ? 1 : 0,
    reporter: CI ? [["github"], ["html", { open: "never" }]] : [["list"]],
    globalSetup: "./e2e/global-setup.mts",

    use: {
        baseURL: BASE_URL,
        trace: "retain-on-failure",
        screenshot: "only-on-failure",
    },

    // In CI, the workflow runs `npm run build` as its own step (so a build
    // failure is reported on its own line, not buried inside webServer
    // startup) — this just starts the already-built app. Locally, reuse
    // whatever `npm run dev` already has up rather than fighting over the port.
    webServer: {
        command: CI ? "npm run start" : "npm run dev",
        url: BASE_URL,
        reuseExistingServer: !CI,
        timeout: 180_000,
    },

    projects: [
        {
            name: "dashboard",
            testDir: "./e2e/dashboard",
            use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/dashboard.json" },
        },
        {
            name: "hotel-connect",
            testDir: "./e2e/hotel-connect",
            use: { ...devices["Desktop Chrome"], storageState: "e2e/.auth/hotel-connect.json" },
        },
        {
            name: "website",
            testDir: "./e2e/website",
            use: { ...devices["Desktop Chrome"] },
        },
    ],
});
