import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { inspectImage } from "@toolbox/core";
import { waitForToolPageReady } from "./tool-readiness";

const toolUrl = "/tools/qr-designer";
const logoFixture = resolve("e2e/fixtures/images/landscape.png");
const status = (page: Page) => page.getByRole("status");

async function waitForVerified(page: Page) {
  await expect(status(page)).toContainText("Verified QR design", { timeout: 45_000 });
}

async function changeAndWaitForNewResult(page: Page, change: () => Promise<unknown>) {
  const preview = page.getByRole("img", { name: /QR code preview/ });
  const previousUrl = await preview.getAttribute("src");
  await change();
  await expect
    .poll(
      async () =>
        (await status(page).textContent())?.includes("Verified QR design") === true &&
        (await preview.getAttribute("src")) !== null &&
        (await preview.getAttribute("src")) !== previousUrl,
      { timeout: 45_000 },
    )
    .toBe(true);
}

async function saveDownload(page: Page, info: TestInfo, label: string, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: label, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(name);
  const path = info.outputPath(name);
  await download.saveAs(path);
  return new Uint8Array(await readFile(path));
}

async function chooseLogo(
  page: Page,
  file: string | { name: string; mimeType: string; buffer: Buffer },
) {
  const chooser = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  await (await chooser).setFiles(file);
}

test("encodes short, Unicode and dense payloads into verified PNG and vector SVG without uploads", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  const measurements: Array<{
    label: string;
    utf8Bytes: number;
    elapsedMs: number;
    pngBytes: number;
  }> = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") uploads.push(request.method());
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  const shortStarted = Date.now();
  const toolRegion = page.getByRole("region", { name: "QR designer workspace" });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await expect(page.getByRole("heading", { name: "QR designer", exact: true })).toBeVisible();
  await waitForVerified(page);
  const elapsedMs = Date.now() - shortStarted;

  const payload = page.getByLabel("URL", { exact: true });
  await expect(payload).toHaveValue("https://example.com");
  const png = await saveDownload(page, info, "Download PNG", "toolbox-qr-code.png");
  expect(inspectImage(png)).toMatchObject({ kind: "png", width: 512, height: 512 });
  expect(png.byteLength).toBeLessThan(5 * 1024 * 1024);
  const svg = await saveDownload(page, info, "Download vector SVG", "toolbox-qr-code.svg");
  const svgText = new TextDecoder().decode(svg);
  expect(svgText).toContain("<svg");
  expect(svgText).toContain("<path");
  expect(svgText).not.toContain("<script");
  expect(svgText).not.toMatch(/href="https?:/i);
  expect(svgText).not.toContain("https://example.com");
  measurements.push({ label: "short-url", utf8Bytes: 19, elapsedMs, pngBytes: png.byteLength });

  const preset = page.getByLabel("Design preset", { exact: true });
  for (const value of ["garden", "studio", "classic"] as const) {
    await changeAndWaitForNewResult(page, () => preset.selectOption(value));
  }
  await changeAndWaitForNewResult(page, () =>
    page.getByLabel("Module style", { exact: true }).selectOption("diamond"),
  );
  await changeAndWaitForNewResult(page, () =>
    page.getByLabel("Module style", { exact: true }).selectOption("square"),
  );

  await changeAndWaitForNewResult(page, () =>
    page.getByLabel("Content type", { exact: true }).selectOption("text"),
  );
  const text = page.getByLabel("Text", { exact: true });
  const unicodePayload = "Toolbox · 世界 · 👋";
  const unicodeStarted = Date.now();
  await changeAndWaitForNewResult(page, () => text.fill(unicodePayload));
  const unicodeElapsedMs = Date.now() - unicodeStarted;
  const unicodePng = await saveDownload(page, info, "Download PNG", "toolbox-qr-code.png");
  measurements.push({
    label: "unicode-emoji",
    utf8Bytes: new TextEncoder().encode(unicodePayload).byteLength,
    elapsedMs: unicodeElapsedMs,
    pngBytes: unicodePng.byteLength,
  });
  expect(inspectImage(unicodePng)).toMatchObject({ kind: "png", width: 512, height: 512 });

  await changeAndWaitForNewResult(page, () =>
    page.getByLabel("Error correction", { exact: true }).selectOption("L"),
  );
  await changeAndWaitForNewResult(page, async () => {
    await page.getByLabel(/^Output size/).focus();
    await page.keyboard.press("End");
  });
  const densePayload = "qr-designer-test-".repeat(118).slice(0, 2000);
  const denseStarted = Date.now();
  await changeAndWaitForNewResult(page, () => text.fill(densePayload));
  const denseElapsedMs = Date.now() - denseStarted;
  const densePng = await saveDownload(page, info, "Download PNG", "toolbox-qr-code.png");
  measurements.push({
    label: "dense-2000-byte",
    utf8Bytes: new TextEncoder().encode(densePayload).byteLength,
    elapsedMs: denseElapsedMs,
    pngBytes: densePng.byteLength,
  });
  expect(inspectImage(densePng)).toMatchObject({ kind: "png", width: 1536, height: 1536 });

  await page.getByLabel("Foreground", { exact: true }).evaluate((element) => {
    if (!(element instanceof HTMLInputElement))
      throw new Error("Foreground color input is missing");
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
    setter?.call(element, "#aaaaaa");
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await expect(toolRegion.getByRole("alert")).toContainText("4.5:1 contrast");
  await expect(page.getByRole("link", { name: "Download PNG", exact: true })).toHaveCount(0);

  if (info.project.name.startsWith("chromium")) {
    await writeFile(
      info.outputPath("qr-performance.json"),
      JSON.stringify(measurements, null, 2),
      "utf8",
    );
  }
  expect(text).toBeAttached();
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("checks raster logos, rejects SVG input, supports keyboard cancellation and reset on mobile", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") uploads.push(request.method());
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await waitForVerified(page);
  const previousPreview = await page
    .getByRole("img", { name: /QR code preview/ })
    .getAttribute("src");
  await chooseLogo(page, logoFixture);
  await expect(page.getByRole("img", { name: "Checked logo preview", exact: true })).toBeVisible();
  await expect
    .poll(
      async () =>
        (await status(page).textContent())?.includes("Verified QR design") === true &&
        (await page.getByRole("img", { name: /QR code preview/ }).getAttribute("src")) !==
          previousPreview,
      { timeout: 45_000 },
    )
    .toBe(true);
  const svg = await saveDownload(page, info, "Download vector SVG", "toolbox-qr-code.svg");
  const svgText = new TextDecoder().decode(svg);
  expect(svgText).toContain('<image href="data:image/png;base64,');
  expect(svgText).not.toMatch(/href="https?:/i);

  await page.getByRole("button", { name: "Reset", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByLabel("URL", { exact: true })).toHaveValue("");
  await expect(page.getByRole("link", { name: "Download PNG", exact: true })).toHaveCount(0);

  await chooseLogo(page, {
    name: "active.svg",
    mimeType: "image/svg+xml",
    buffer: Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'),
  });
  const toolAlert = page.getByRole("region", { name: "QR designer workspace" }).getByRole("alert");
  await expect(toolAlert).toContainText("valid PNG or JPEG");
  await chooseLogo(page, {
    name: "spoof.png",
    mimeType: "image/png",
    buffer: Buffer.from("not a PNG image"),
  });
  await expect(toolAlert).toContainText("valid PNG or JPEG");
  await chooseLogo(page, resolve("e2e/fixtures/images/damaged.png"));
  await expect(toolAlert).toContainText("valid PNG or JPEG");
  await chooseLogo(page, resolve("e2e/fixtures/images/oversized.png"));
  await expect(toolAlert).toContainText("512 px per side");

  await page.getByLabel("URL", { exact: true }).fill("https://example.com/retry");
  await waitForVerified(page);
  await page.getByRole("button", { name: "Generate QR", exact: true }).focus();
  await page.keyboard.press("Enter");
  const cancel = page.getByRole("button", { name: "Cancel", exact: true });
  await expect(cancel).toBeVisible();
  await cancel.click();
  await expect(status(page)).toContainText("Generation cancelled");
  await expect(page.getByRole("button", { name: "Generate QR", exact: true })).toBeFocused();
  await expect(page.getByRole("link", { name: "Download PNG", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Generate QR", exact: true }).click();
  await waitForVerified(page);
  const png = await saveDownload(page, info, "Download PNG", "toolbox-qr-code.png");
  expect(inspectImage(png)).toMatchObject({ kind: "png", width: 512, height: 512 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});
