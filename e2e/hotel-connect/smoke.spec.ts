import { test, expect } from "@playwright/test";

test.describe("Hotel Connect — owner portal", () => {
    test("dashboard root loads for an authenticated owner (no redirect to login)", async ({ page }) => {
        const resp = await page.goto("/hotel-connect", { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page).not.toHaveURL(/\/hotel-connect\/login/);
    });

    test("properties page loads", async ({ page }) => {
        const resp = await page.goto("/hotel-connect/properties", { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page).not.toHaveURL(/\/hotel-connect\/login/);
    });
});

test("login page redirects an unauthenticated visitor away from the dashboard", async ({ browser }) => {
    // Deliberately a fresh, cookie-less context — browser.newContext() would
    // otherwise inherit the "hotel-connect" project's storageState default
    // (Playwright applies project-level `use` options to it too), defeating
    // the point of this check.
    const context = await browser.newContext({ storageState: undefined });
    const page = await context.newPage();
    await page.goto("/hotel-connect", { waitUntil: "domcontentloaded" });
    await expect(page).toHaveURL(/\/hotel-connect\/login/);
    await context.close();
});
