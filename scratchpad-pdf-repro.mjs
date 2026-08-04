import { chromium } from "playwright";

const BASE = "http://localhost:3000";
const PKG_ID = "4445b25a-9d6a-444a-9ef9-6f48e16fe6f5";
const SHOT_DIR = "/private/tmp/claude-501/-Users-apple-Desktop-projects-dreams-yatri/cc33b175-088a-4acc-b6bf-50a913ecf112/scratchpad";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
page.on("console", (msg) => {
  if (msg.type() === "error" || msg.type() === "warning") console.log("[console]", msg.type(), msg.text());
});
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto(`${BASE}/dashboard/login`, { waitUntil: "networkidle" });
await page.waitForSelector('input[placeholder="name@dreamsyatri.com"]', { timeout: 10000 });
await page.fill('input[placeholder="name@dreamsyatri.com"]', "vikrant@dreamsyatri.com");
await page.fill('input[placeholder="Password here..."]', "Admin@123");
await page.getByText("Dive Into Dashboard").click();
await page.waitForTimeout(3000);
console.log("after login url:", page.url());
if (page.url().includes("/login")) {
  const bodyText = await page.textContent("body");
  console.log("login page body snippet:", bodyText?.slice(0, 500));
}

await page.goto(`${BASE}/dashboard/package-builder/${PKG_ID}`, { waitUntil: "networkidle" });
await page.waitForTimeout(3000);
console.log("builder url:", page.url());

const previewBtn = page.getByText("Preview PDF", { exact: false });
const count = await previewBtn.count();
console.log("Preview PDF button count:", count);
if (count > 0) {
  await previewBtn.first().click();
  await page.waitForTimeout(9000);
  await page.screenshot({ path: `${SHOT_DIR}/pdf-preview-dialog.png`, fullPage: true });
  console.log("screenshot saved: pdf-preview-dialog.png");
} else {
  await page.screenshot({ path: `${SHOT_DIR}/builder-page.png`, fullPage: true });
  console.log("no preview button found, saved builder screenshot instead");
}

await browser.close();
