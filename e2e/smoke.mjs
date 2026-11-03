// End-to-end smoke test: drives the real app in a browser like a user would.
// Usage: start the app (npm run dev), then: node e2e/smoke.mjs [baseUrl] [screenshotDir]
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { chromium, devices } = require("playwright");
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";

const BASE = process.argv[2] ?? "http://localhost:3000";
const SHOTS = process.argv[3] ?? "/tmp/stockly-shots";
mkdirSync(SHOTS, { recursive: true });

const browser = await chromium.launch();
const context = await browser.newContext({ ...devices["iPhone 13"] });
const page = await context.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
page.on("console", (m) => m.type() === "error" && errors.push(`console: ${m.text()}`));

let step = 0;
async function shot(name) {
  step++;
  await page.screenshot({ path: path.join(SHOTS, `${String(step).padStart(2, "0")}-${name}.png`), fullPage: true, caret: "initial" });
}
function assert(cond, msg) {
  if (!cond) throw new Error(`ASSERTION FAILED: ${msg}`);
  console.log(`  ✓ ${msg}`);
}

const email = `e2e-${Date.now()}@example.com`;

console.log("Sign up");
await page.goto(`${BASE}/signup`);
await page.fill("#name", "Tauri Test");
await page.fill("#email", email);
await page.fill("#password", "testing123");
await page.fill("#orgName", "Test Tools OÜ");
await shot("signup");
await page.click("button[type=submit]");
await page.waitForURL(/\/app\?welcome=1/);
assert(await page.getByText("Welcome to Stockly").isVisible(), "welcome banner shows");
await shot("empty-home");

console.log("Create folder");
await page.getByRole("button", { name: "New folder" }).click();
await page.fill("input[name=name]", "Van 1");
await page.getByRole("button", { name: "Create" }).click();
await page.waitForURL(/\/app\/folders\//);
assert((await page.locator("h1").textContent()).includes("Van 1"), "folder page opened");

console.log("Add item");
await page.getByRole("link", { name: "Add item" }).first().click();
await page.waitForURL(/\/app\/items\/new/);
await page.fill("#name", "Cordless drill 18V");
await page.fill("#quantity", "3");
await page.fill("#unit", "pcs");
await page.fill("#minQuantity", "2");
await page.fill("#price", "129,90");
await page.fill("#barcode", "4006381333931");
await page.fill("#tags", "tools, power");
await page.getByRole("button", { name: "Add field" }).click();
await page.locator("input[name=cfKey]").fill("Serial number");
await page.locator("input[name=cfValue]").fill("SN-0042");
await shot("item-form");
await page.getByRole("button", { name: "Add item" }).click();
await page.waitForURL(/\/app\/items\/[0-9a-f-]+\?created=1/);
assert(await page.getByText("Item added.").isVisible(), "item created");
assert(await page.getByText("SN-0042").isVisible(), "custom field shown");
assert(await page.getByText("€129.90").first().isVisible(), "price parsed from comma decimal");
const itemUrl = page.url().split("?")[0];

console.log("Adjust quantity");
await page.getByRole("button", { name: "Remove one" }).click();
await page.getByText("Quantity is now 2").waitFor();
assert(await page.getByRole("main").getByText("Low stock", { exact: true }).isVisible(), "low stock badge after dropping to min");
await page.locator("input[name=amount]").fill("5");
await page.getByRole("button", { name: "Put in", exact: true }).first().click();
await page.locator("input[name=note]").fill("Delivery #88");
await page.locator("form").filter({ has: page.locator("input[name=note]") }).getByRole("button", { name: "Put in" }).last().click();
await page.getByText("Quantity is now 7").waitFor();
await page.reload();
assert(await page.getByText("Delivery #88").isVisible(), "history shows the reason");
await shot("item-page");

console.log("Upload photo");
// Tiny valid PNG
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAIAAACQkWg2AAAAHElEQVR4nGNk+M9AEmAiTfmohlENoxqGkgYAU/sBH8aTdyQAAAAASUVORK5CYII=",
  "base64",
);
writeFileSync("/tmp/test.png", png);
await page.locator("input[type=file]").setInputFiles("/tmp/test.png");
await page.locator('img[src^="/api/photos/"]').first().waitFor({ timeout: 15000 });
const photoSrc = await page.locator('img[src^="/api/photos/"]').first().getAttribute("src");
const photoRes = await page.request.get(`${BASE}${photoSrc}`);
assert(photoRes.status() === 200 && photoRes.headers()["content-type"].startsWith("image/"), "photo stored and served");

console.log("Search and exact barcode match");
await page.goto(`${BASE}/app/search?q=4006381333931`);
await page.waitForURL(itemUrl);
assert(true, "exact barcode search jumps to item");
await page.goto(`${BASE}/app/search?q=drill`);
assert(await page.getByText("Cordless drill 18V").isVisible(), "text search finds item");

console.log("Low stock and activity");
await page.goto(`${BASE}/app/low-stock`);
assert(await page.getByText("Nothing is running low").isVisible(), "low stock empty after restock");
await page.goto(`${BASE}/app/activity`);
assert((await page.locator("text=Delivery #88").count()) > 0, "activity log has entries");
await shot("activity");

console.log("Labels");
await page.goto(`${BASE}/app/labels?ids=${itemUrl.split("/").pop()}`);
assert((await page.locator("svg path").count()) > 0, "QR label rendered");
await shot("labels");

console.log("Import Sortly-style CSV");
const csv = [
  "Entry Name,Sortly ID (SID),Unit,Min Level,Price,Quantity,Notes,Tags,Barcode/QR1-Data,Main Folder,Subfolder-level1,Supplier",
  "Safety gloves,SID1,pairs,10,4.50,6,,ppe,111222,Warehouse,Aisle 2,Acme",
  "Ear plugs,SID2,box,2,12,8,,ppe,,Warehouse,Aisle 2,",
  ",SID3,,,,,,,,,,",
].join("\n");
writeFileSync("/tmp/sortly.csv", csv);
await page.goto(`${BASE}/app/import`);
await page.locator("input[type=file]").setInputFiles("/tmp/sortly.csv");
await page.getByText("2 items ready").waitFor();
await shot("import-preview");
await page.getByRole("button", { name: "Import 2 items" }).click();
await page.getByText("Import complete").waitFor();
assert(await page.getByText("Added 2 items in 2 folders").isVisible(), "import created items and folders");
await page.goto(`${BASE}/app/low-stock`);
assert(await page.getByText("Safety gloves").isVisible(), "imported low-stock item flagged");

console.log("Export");
const exportRes = await page.request.get(`${BASE}/api/export`);
const exportText = await exportRes.text();
assert(exportRes.status() === 200 && exportText.includes("Warehouse / Aisle 2"), "CSV export includes folder paths");

console.log("Home dashboard");
await page.goto(`${BASE}/app`);
await shot("home");

console.log("Settings + invite");
await page.goto(`${BASE}/app/settings`);
await page.getByRole("button", { name: "Create invite link" }).click();
const inviteInput = page.getByLabel("Invite link");
await inviteInput.waitFor();
const inviteUrl = await inviteInput.inputValue();
assert(inviteUrl.includes("/invite/"), "invite link created");

console.log("Second user joins via invite and cannot see other workspace data without it");
const ctx2 = await browser.newContext({ ...devices["Pixel 7"] });
const p2 = await ctx2.newPage();
await p2.goto(`${BASE}${new URL(inviteUrl).pathname}`);
await p2.waitForURL(/\/signup\?invite=/);
assert(await p2.getByText("Join Test Tools OÜ on Stockly").isVisible(), "invite signup shows workspace name");
await p2.fill("#name", "Teammate");
await p2.fill("#email", `mate-${Date.now()}@example.com`);
await p2.fill("#password", "testing123");
await p2.click("button[type=submit]");
await p2.waitForURL(/\/app$/);
assert(await p2.getByText("Van 1").isVisible(), "teammate sees shared inventory");

const ctx3 = await browser.newContext();
const p3 = await ctx3.newPage();
await p3.goto(`${BASE}/signup`);
await p3.fill("#name", "Stranger");
await p3.fill("#email", `stranger-${Date.now()}@example.com`);
await p3.fill("#password", "testing123");
await p3.click("button[type=submit]");
await p3.waitForURL(/\/app/);
await p3.goto(itemUrl);
await p3.screenshot({ path: path.join(SHOTS, "stranger.png") });
await p3.getByRole("heading", { name: "Not found" }).waitFor();
assert(true, "stranger cannot open another workspace's item");
const strangerPhoto = await p3.request.get(`${BASE}${photoSrc}`);
assert(strangerPhoto.status() === 404, "stranger cannot load another workspace's photo");

console.log("Log out");
await page.goto(`${BASE}/app/more`);
await page.getByRole("button", { name: "Log out" }).click();
await page.waitForURL(/\/login/);
await page.goto(`${BASE}/app`);
await page.waitForURL(/\/login/);
assert(true, "logged out users are sent to login");

console.log("Landing page");
await page.goto(BASE);
await shot("landing");

await browser.close();
const relevant = errors.filter((e) => !e.includes("Download the React DevTools"));
if (relevant.length) {
  console.log("\nBrowser errors:\n" + relevant.join("\n"));
  process.exit(1);
}
console.log("\nAll smoke checks passed.");
