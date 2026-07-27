import { test, expect } from "@playwright/test";
import { E2E_BOOKING_ID, E2E_BOOKING_NUMBER } from "../support/fixtures.mjs";

test.describe("Package Bookings — list", () => {
    test("loads, shows the fixture booking, and search filters to it", async ({ page }) => {
        await page.goto("/dashboard/package-bookings", { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: "Package Bookings" })).toBeVisible();
        await expect(page.getByRole("link", { name: E2E_BOOKING_NUMBER })).toBeVisible();

        await page.getByPlaceholder(/Search booking/).fill(E2E_BOOKING_NUMBER);
        await page.getByPlaceholder(/Search booking/).press("Enter");
        await expect(page).toHaveURL(/search=/);
        const rows = page.locator('a[href*="/dashboard/package-bookings/"]');
        await expect(rows).toHaveCount(1);
        await expect(rows.first()).toHaveText(E2E_BOOKING_NUMBER);
    });

    test("status filter narrows results", async ({ page }) => {
        await page.goto("/dashboard/package-bookings", { waitUntil: "domcontentloaded" });
        await page.getByText("All Statuses", { exact: true }).click();
        await page.getByRole("option", { name: "Confirmed", exact: true }).click();
        await expect(page).toHaveURL(/status=CONFIRMED/);
        await expect(page.getByRole("link", { name: E2E_BOOKING_NUMBER })).toBeVisible();
    });
});

test.describe("Package Bookings — detail", () => {
    test("renders trip, stay, payments and actions for the fixture booking", async ({ page }) => {
        await page.goto(`/dashboard/package-bookings/${E2E_BOOKING_ID}`, { waitUntil: "domcontentloaded" });
        await expect(page.getByRole("heading", { name: E2E_BOOKING_NUMBER })).toBeVisible();

        // Hotel-only booking (no packageId) — renders "Property & stay", not the
        // package itinerary/fulfilment-checklist branch.
        await expect(page.getByText("Direct hotel booking")).toBeVisible();
        await expect(page.getByText("E2E Fixture Hotel")).toBeVisible();

        await expect(page.getByText("E2E Lead Traveller")).toBeVisible();
        await expect(page.getByText("Lead", { exact: true })).toBeVisible();

        // Deposit + balance payment plan from the fixture.
        await expect(page.getByText("₹10,000.00").first()).toBeVisible();

        await expect(page.getByRole("link", { name: "Invoice" })).toHaveAttribute(
            "href", `/dashboard/package-bookings/${E2E_BOOKING_ID}/invoice`,
        );
        await expect(page.getByRole("link", { name: "Voucher" })).toHaveAttribute(
            "href", `/dashboard/package-bookings/${E2E_BOOKING_ID}/voucher`,
        );
    });
});

test.describe("Invoice", () => {
    test("renders totals and payments for the fixture booking", async ({ page }) => {
        const resp = await page.goto(`/dashboard/package-bookings/${E2E_BOOKING_ID}/invoice`, { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page.getByText("INVOICE", { exact: true })).toBeVisible();
        await expect(page.getByText(`INV-${E2E_BOOKING_NUMBER}`)).toBeVisible();
        await expect(page.getByText("₹21,787.50").last()).toBeVisible(); // Total (same value as the line item since GST is 0% in the fixture)
        await expect(page.getByText("₹10,000.00").first()).toBeVisible(); // Amount paid
        await expect(page.getByText("₹11,787.50")).toBeVisible(); // Balance due
        await expect(page.getByText("Page Not Found")).not.toBeVisible();
    });
});

test.describe("Voucher", () => {
    test("collapses the fixture's 2 hotel rows and 3 cab legs into single date-range rows", async ({ page }) => {
        const resp = await page.goto(`/dashboard/package-bookings/${E2E_BOOKING_ID}/voucher`, { waitUntil: "domcontentloaded" });
        expect(resp?.status()).toBe(200);
        await expect(page.getByText("VOUCHER", { exact: true })).toBeVisible();

        // 2 consecutive BookingHotel rows at the same hotel → exactly 1 row,
        // spanning 2 nights — regression test for the date-range grouping.
        await expect(page.getByText("E2E Fixture Hotel")).toHaveCount(1);
        const hotelRow = page.locator("tr", { has: page.getByText("E2E Fixture Hotel") });
        await expect(hotelRow.locator("td").last()).toHaveText("2");

        // 3 consecutive same-vehicle BookingCab legs → exactly 1 row, "Days: 3".
        await expect(page.getByText("Innova", { exact: false })).toHaveCount(1);
        const cabRow = page.locator("tr", { has: page.getByText("Innova", { exact: false }) });
        await expect(cabRow.locator("td").last()).toHaveText("3");
    });
});
