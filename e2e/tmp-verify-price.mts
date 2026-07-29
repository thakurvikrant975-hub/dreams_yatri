import { chromium } from "playwright";

const browser = await chromium.launch();
const page = await browser.newPage();
const url = "http://localhost:3000/packages/kerala-family-escape-hills-backwaters-beaches/8d-7n/kochi-munnar-thekkaday-alappuzha-kerala-kovalam-kerala/2-star";
await page.goto(url, { waitUntil: "networkidle" });
await page.waitForTimeout(2500);

const priceTexts = await page.locator("text=/₹[0-9,]+/").allTextContents();
console.log("Prices found on page:", JSON.stringify([...new Set(priceTexts)], null, 2));

await page.screenshot({ path: "e2e/tmp/price-check.png", fullPage: false });
await browser.close();
