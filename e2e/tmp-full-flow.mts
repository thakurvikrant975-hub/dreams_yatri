import { chromium } from "playwright";
import { customerCookie } from "./support/auth.mts";

const browser = await chromium.launch();
const context = await browser.newContext();
const cookie = await customerCookie();
await context.addCookies([cookie]);
const page = await context.newPage();

await page.goto("http://localhost:3000/book/cms5pvu5a000yfav9m8th6why", { waitUntil: "networkidle" });
await page.waitForTimeout(1500);

await page.getByText("Add Adult 1").click();
await page.waitForTimeout(500);

const dialog = page.locator("div[role='dialog']");
await dialog.getByPlaceholder("First name").fill("Test");
await dialog.getByPlaceholder("Last name").fill("Traveller");

await dialog.getByText("Select date").click();
await page.waitForTimeout(500);
// click a mid-month day in the currently open calendar popover (any past-eligible day)
await page.locator("button", { hasText: /^15$/ }).first().click({ timeout: 5000 });
await page.waitForTimeout(500);
await page.screenshot({ path: "e2e/tmp/dob-clicked.png", fullPage: false });

const confirmBtn = dialog.getByRole("button", { name: "Confirm details" });
const isEnabled = await confirmBtn.isEnabled();
console.log("confirm enabled:", isEnabled);
await confirmBtn.click({ timeout: 5000 });
await page.waitForTimeout(1000);
await page.screenshot({ path: "e2e/tmp/dialog3.png", fullPage: true });

await browser.close();
