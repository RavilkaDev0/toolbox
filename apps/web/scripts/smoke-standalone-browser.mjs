import assert from "node:assert/strict";
import { resolve } from "node:path";
import { chromium } from "@playwright/test";

const origin = process.env.TOOLBOX_SMOKE_URL ?? "http://127.0.0.1:3101";
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
const uploads = [];

try {
  page.on("pageerror", (error) => errors.push(`page error: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(`console error: ${message.text()}`);
  });
  page.on("requestfailed", (request) => {
    const abortedRscPrefetch =
      request.failure()?.errorText === "net::ERR_ABORTED" &&
      new URL(request.url()).searchParams.has("_rsc");
    if (abortedRscPrefetch) return;
    errors.push(`request failed: ${request.url()} (${request.failure()?.errorText ?? "unknown"})`);
  });
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD")
      uploads.push(`${request.method()} ${request.url()}`);
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

  await page.goto(new URL("/tools/merge-pdf", origin).href, { waitUntil: "networkidle" });
  await page
    .getByLabel("Choose PDFs", { exact: true })
    .setInputFiles([
      resolve("apps/web/e2e/fixtures/pdfs/a4.pdf"),
      resolve("apps/web/e2e/fixtures/pdfs/letter.pdf"),
    ]);
  await page.getByText("Files are ready. Review your settings.", { exact: true }).waitFor();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await page.getByText(/^Showing PDF page 1 of/).waitFor();

  assert(errors.length === 0, `standalone browser errors:\n${errors.join("\n")}`);
  assert(uploads.length === 0, `browser sent non-read requests: ${uploads.join(", ")}`);
  console.log(
    "Standalone Chromium smoke passed: five routes, a real PDF preview and no uploads at 390px.",
  );
} finally {
  await browser.close();
}
