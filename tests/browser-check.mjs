import { chromium } from "playwright";
import assert from "node:assert/strict";
import { mkdir, readFile } from "node:fs/promises";
import { sampleLogs } from "../dist/core.mjs";
const browser = await chromium.launch({ channel: "msedge", headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 1080 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
await page.goto("http://127.0.0.1:4173");
await page.locator(".alert").first().waitFor();
assert.equal(await page.locator(".alert").count(), 3);
await page.locator("[data-evidence]").first().click();
assert.equal(await page.locator("#raw-evidence").isVisible(), true);
await page.locator("#severity").selectOption("medium");
assert.equal(await page.locator(".alert").count(), 1);
await page.locator("#severity").selectOption("all");
await page.locator("#event-search").fill("198.51.100.42");
assert.equal(await page.locator("#events tr").count(), 7);
await page.locator("#event-search").fill("");
await page.locator("#sample").selectOption("normal");
await page.locator("#load-sample").click();
await page.locator("#analyze").click();
assert.equal(await page.locator(".alert").count(), 0);
assert.match(await page.locator("#alerts").textContent(), /No matching alerts/);
await page.locator("#log-input").fill("garbage");
await page.locator("#analyze").click();
assert.equal(await page.locator("#results").isVisible(), false);
assert.match(await page.locator("#status").textContent(), /No supported/);
await page
  .locator("#file")
  .setInputFiles({
    name: "example.json",
    mimeType: "application/json",
    buffer: Buffer.from(sampleLogs()),
  });
await page.locator("#analyze").click();
assert.equal(await page.locator(".alert").count(), 3);
const download = page.waitForEvent("download");
await page.locator("#export").click();
assert.equal(
  (await download).suggestedFilename(),
  "signaldesk-investigation.json",
);
await page.locator("#ai-settings").click();
assert.equal(await page.locator("#settings").isVisible(), true);
await page.locator("#close-settings").click();
await page.locator('.rail [data-view="rules"]').click();
assert.equal(await page.locator(".rule-card").count(), 3);
await page.locator('.rail [data-view="investigate"]').click();
await page
  .locator("#review-note")
  .fill("Verified the source with the account owner; needs more context.");
await page.locator("#review-status").selectOption("reviewing");
await page.locator(".alert").nth(1).click();
await page.locator(".alert").first().click();
assert.match(
  await page.locator("#review-note").inputValue(),
  /Verified the source/,
);
await page.locator("#report-format").selectOption("markdown");
const mdDownload = page.waitForEvent("download");
await page.locator("#export").click();
const md = await mdDownload;
assert.equal(md.suggestedFilename(), "signaldesk-investigation.md");
assert.match(
  await readFile(await md.path(), "utf8"),
  /Analyst notes: Verified the source/,
);
await page.locator('.rail [data-view="evaluation"]').click();
await page.locator("#eval-run").click();
assert.equal(await page.locator("#eval-case-results tr").count(), 12);
assert.match(await page.locator("#eval-status").textContent(), /10\/12/);
assert.match(await page.locator("#eval-metrics").textContent(), /87.5%/);
await page.screenshot({ path: "artifacts/evaluation.png", fullPage: true });
await page
  .locator("#eval-file")
  .setInputFiles({
    name: "invalid.json",
    mimeType: "application/json",
    buffer: Buffer.from("{"),
  });
await page.waitForFunction(() =>
  document.querySelector("#eval-status").textContent.includes("valid JSON"),
);
assert.equal(await page.locator("#eval-case-results tr").count(), 12);
await page.locator('[data-case="D09"]').click();
assert.equal(await page.locator("#investigate-view").isVisible(), true);
assert.equal(await page.locator(".alert").count(), 1);
await page.locator("#sample").selectOption("mixed");
await page.locator("#load-sample").click();
await page.locator("#analyze").click();
await mkdir("artifacts", { recursive: true });
await page.screenshot({ path: "artifacts/desktop.png", fullPage: true });
await page.setViewportSize({ width: 390, height: 844 });
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
await page.screenshot({ path: "artifacts/mobile.png", fullPage: true });
await page.locator('.mobile-nav [data-view="evaluation"]').click();
assert.equal(await page.locator("#evaluation-view").isVisible(), true);
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
await page.locator('.mobile-nav [data-view="investigate"]').click();
await page.setViewportSize({ width: 1440, height: 1080 });
await page.evaluate(() => (document.documentElement.style.fontSize = "200%"));
assert.equal(
  await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  true,
);
await page.evaluate(() => (document.documentElement.style.fontSize = ""));
const malicious = JSON.parse(sampleLogs());
for (const e of malicious)
  if (e.username === "admin") e.username = "<img src=x onerror=alert(1)>";
await page.locator("#log-input").fill(JSON.stringify(malicious));
await page.locator("#analyze").click();
assert.equal(await page.locator("#results img").count(), 0);
assert.deepEqual(errors, []);
console.log(
  "PASS: demo, filters, evidence, normal/invalid input, upload, JSON/Markdown export, notes, evaluation errors/metrics/case inspection, desktop/mobile navigation, text enlargement, safe rendering.",
);
console.log(
  "WebMCP native support:",
  await page.evaluate(() => !!document.modelContext?.registerTool),
);
await browser.close();
