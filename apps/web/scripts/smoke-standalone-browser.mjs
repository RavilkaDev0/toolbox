import assert from "node:assert/strict";
import { chromium } from "@playwright/test";

const origin = process.env.TOOLBOX_SMOKE_URL ?? "http://127.0.0.1:3101";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];

try {
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });

  for (const pathname of [
    "/",
    "/tools",
    "/tools/images-to-pdf",
    "/tools/merge-pdf",
    "/tools/pdf-to-png",
  ]) {
    const response = await page.goto(new URL(pathname, origin).href, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${pathname} must load from the standalone image`);
    assert.equal(await page.locator("h1").count(), 1, `${pathname} must render its page heading`);
    assert(
      (await page.evaluate(() => document.documentElement.scrollWidth)) <= 390,
      `${pathname} must not overflow a 390px viewport`,
    );
  }

  assert(errors.length === 0, `standalone browser errors:\n${errors.join("\n")}`);
  console.log(
    "Standalone Chromium smoke passed: five routes rendered at 390px without browser errors.",
  );
} finally {
  await browser.close();
}
