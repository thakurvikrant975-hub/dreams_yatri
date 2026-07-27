import { test, expect } from "@playwright/test";
import { E2E_CANCELLABLE_BOOKING_ID, E2E_CANCELLABLE_BOOKING_NUMBER } from "../support/fixtures.mjs";

// Runs against its own dedicated fixture (not the one the other dashboard
// specs read) since this test actually cancels the booking.
test("cancel booking: preview shows refund, confirming cancels it", async ({ page }) => {
    await page.goto(`/dashboard/package-bookings/${E2E_CANCELLABLE_BOOKING_ID}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: E2E_CANCELLABLE_BOOKING_NUMBER })).toBeVisible();

    await page.getByRole("button", { name: "Cancel booking" }).click();
    await expect(page.getByText("Cancel this booking?")).toBeVisible();
    await expect(page.getByText(/Refund/)).toBeVisible({ timeout: 10_000 }); // preview loaded

    await page.getByPlaceholder(/Reason/).fill("E2E automated cancellation test");
    await page.getByRole("button", { name: "Confirm cancellation" }).click();

    // The success toast is the fastest signal the mutation actually
    // completed, ahead of the router.refresh() re-render asserted on next.
    await expect(page.getByText(/Booking cancelled/)).toBeVisible({ timeout: 10_000 });

    // Pill should flip to Cancelled and the cancel button should no longer
    // be offered (already CANCELLED) once the refreshed data lands.
    await expect(page.getByText("Cancelled", { exact: true })).toBeVisible({ timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Cancel booking" })).toHaveCount(0);
});
