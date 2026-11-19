import { mkdir } from "node:fs/promises";
import { chromium } from "playwright";

const base = process.env.SHOT_URL || "http://127.0.0.1:4173";
const out = "docs/screenshots";
await mkdir(out, { recursive: true });

const browser = await chromium.launch({
  executablePath: process.env.CHROME_PATH || "/usr/bin/google-chrome-stable",
  args: ["--no-sandbox", "--disable-dev-shm-usage"],
});
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
page.on("pageerror", (error) => {
  console.error("PAGEERROR", error);
  process.exitCode = 1;
});

await page.goto(base, { waitUntil: "domcontentloaded" });
await page.evaluate(async () => {
  const regs = await navigator.serviceWorker?.getRegistrations?.() || [];
  await Promise.all(regs.map((reg) => reg.unregister()));
  const keys = await caches.keys();
  await Promise.all(keys.map((key) => caches.delete(key)));
});

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png` });
  console.log("wrote", name);
}

await page.goto(`${base}/?reset=1&lang=en`, { waitUntil: "networkidle" });
await page.getByTestId("persona-promo_camila").waitFor();
await shot("login");

await page.goto(`${base}/?reset=1&lang=en&as=promo_camila#/agenda`, { waitUntil: "networkidle" });
await page.getByTestId("agenda").waitFor();
await page.screenshot({ path: `${out}/agenda.png`, fullPage: true });
console.log("wrote agenda");

await page.getByTestId("score-store_serra_clara").click();
await page.getByTestId("score-dialog").waitFor();
await shot("score");
await page.getByRole("button", { name: "Close" }).click();

await page.getByTestId("stop-store_serra_clara").click();
await page.getByTestId("visit").waitFor();
await page.getByTestId("checkin-demo").click();
await page.getByRole("button", { name: "Use sample shelf" }).first().click();
await page.getByTestId("run-audit").click();
await page.getByTestId("audit-result").waitFor();
await page.evaluate(() => window.scrollTo(0, 0));
await shot("visit");
await page.getByTestId("audit-panel").screenshot({ path: `${out}/audit.png` });
console.log("wrote audit");
await page.getByRole("button", { name: "Complete visit" }).click();
await page.getByText("Visit completed").waitFor();
await page.goto(`${base}/?lang=en&as=promo_camila#/agenda`, { waitUntil: "networkidle" });
await page.getByText("1 of 7 visits done today").waitFor();

await page.goto(`${base}/?reset=1&lang=en&as=manager_renata#/dashboard`, { waitUntil: "networkidle" });
await page.getByTestId("dashboard").waitFor();
await shot("dashboard");

await page.goto(`${base}/?reset=1&lang=pt&as=promo_camila#/agenda`, { waitUntil: "networkidle" });
await page.getByTestId("agenda").waitFor();
await shot("agenda-pt");

const phone = await browser.newPage({ viewport: { width: 390, height: 844 } });
phone.on("pageerror", (error) => {
  console.error("PAGEERROR", error);
  process.exitCode = 1;
});
await phone.goto(`${base}/?reset=1&lang=en&as=promo_camila#/agenda`, { waitUntil: "networkidle" });
await phone.getByTestId("agenda").waitFor();
await phone.screenshot({ path: `${out}/agenda-mobile.png` });
console.log("wrote agenda-mobile");
await phone.close();

await browser.close();
