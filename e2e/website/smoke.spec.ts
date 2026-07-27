import { test, expect } from "@playwright/test";

// No auth needed — these are public pages. Read-only smoke coverage: proves
// the marketing/browse surface renders for an anonymous visitor, catching
// the class of bug that only shows up server-side (a page.tsx throwing,
// a bad query) rather than in a component unit test.
test.describe("Website — public pages", () => {
    test("homepage loads with no console errors", async ({ page }) => {
        const errors: string[] = [];
        page.on("pageerror", (e) => errors.push(e.message));

        const resp = await page.goto("/", { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page).toHaveTitle(/.+/);
        expect(errors).toEqual([]);
    });

    test("packages listing renders at least one package", async ({ page }) => {
        const resp = await page.goto("/packages", { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page.locator("a[href^='/packages/']").first()).toBeVisible();
    });

    test("a package detail page renders", async ({ page }) => {
        // Discover a real package slug from the listing rather than
        // hardcoding one — package data in the target DB will vary.
        await page.goto("/packages", { waitUntil: "domcontentloaded" });
        const href = await page.locator("a[href^='/packages/']").first().getAttribute("href");
        expect(href).toBeTruthy();

        const resp = await page.goto(href!, { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page.getByText("Package Not Found")).not.toBeVisible();
    });
});
