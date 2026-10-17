import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { waitForToolPageReady } from "./tool-readiness";

declare global {
  interface Window {
    __tbxPdfPngTest?: {
      activeWorkers: number;
      objectUrls: number;
      encodeCount: number;
      holdAt: number;
      releaseHeldEncoding: (() => void) | null;
    };
  }
}

const toolUrl =
  process.env.TOOLBOX_UI_FIXTURES === "1" ? "/design-fixtures/pdf-to-png" : "/tools/pdf-to-png";
const pdfFixture = (name: string) => resolve("e2e/fixtures/pdfs", name);

async function choosePdf(page: Page, path: string) {
  const chooserPromise = page.waitForEvent("filechooser");
  await page.getByRole("button", { name: "Choose files", exact: true }).click();
  const chooser = await chooserPromise;
  await chooser.setFiles(path);
}

function pngDimensions(data: Uint8Array) {
  expect(Array.from(data.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10]);
  expect(new TextDecoder().decode(data.subarray(12, 16))).toBe("IHDR");
  const header = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const width = header.getUint32(16, false);
  const height = header.getUint32(20, false);
  expect(width).toBeGreaterThan(0);
  expect(height).toBeGreaterThan(0);
  return { width, height };
}

async function dropPdf(page: Page, path: string, filename: string) {
  const bytes = await readFile(path);
  await page.locator('[aria-label="File selection"]').evaluate(
    (zone, payload) => {
      const transfer = new DataTransfer();
      transfer.items.add(
        new File([Uint8Array.from(payload.bytes)], payload.filename, { type: "application/pdf" }),
      );
      zone.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    },
    { bytes: Array.from(bytes), filename },
  );
}

async function pagePixels(page: Page) {
  return page.locator('img[alt^="Rendered PDF page"]').evaluate(async (image) => {
    if (!(image instanceof HTMLImageElement))
      throw new Error("The output preview is not an image.");
    await image.decode();
    const bitmap = await createImageBitmap(image);
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas pixel reader is unavailable.");
    context.drawImage(bitmap, 0, 0);
    const blank = Array.from(context.getImageData(150, 30, 1, 1).data);
    const red = Array.from(context.getImageData(30, 150, 1, 1).data);
    bitmap.close();
    return { width: canvas.width, height: canvas.height, blank, red };
  });
}

async function installLifecycleProbe(page: Page) {
  await page.addInitScript(() => {
    const state = {
      activeWorkers: 0,
      objectUrls: 0,
      encodeCount: 0,
      holdAt: 0,
      releaseHeldEncoding: null as (() => void) | null,
    };
    window.__tbxPdfPngTest = state;
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget) as Worker;
        state.activeWorkers++;
        let active = true;
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          if (active) {
            active = false;
            state.activeWorkers--;
          }
          terminate();
        };
        return worker;
      },
    });
    const createUrl = URL.createObjectURL.bind(URL);
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (object) => {
      state.objectUrls++;
      return createUrl(object);
    };
    URL.revokeObjectURL = (url) => {
      state.objectUrls--;
      revokeUrl(url);
    };
    const toBlob = HTMLCanvasElement.prototype.toBlob;
    HTMLCanvasElement.prototype.toBlob = function (callback, type, quality) {
      state.encodeCount++;
      if (state.holdAt > 0 && state.encodeCount === state.holdAt) {
        state.releaseHeldEncoding = () => {
          state.releaseHeldEncoding = null;
          toBlob.call(this, callback, type, quality);
        };
        return;
      }
      toBlob.call(this, callback, type, quality);
    };
  });
}

test("renders every mixed-size and rotated page to a real ordered ZIP and repeats deterministically", async ({
  page,
}, info) => {
  const errors: string[] = [];
  const uploads: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(`${request.method()} ${request.url()}`);
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(toolUrl);
  await waitForToolPageReady(page);
  expect(response?.ok()).toBe(true);
  await expect(page.getByRole("heading", { name: "PDF to PNG", level: 1 })).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/pdf-to-png$/,
  );
  await expect(
    page.getByText("Your PDF stays in this browser tab. No uploads, account or registration."),
  ).toBeVisible();
  await choosePdf(page, pdfFixture("split-pages.pdf"));
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Showing the first page of 5.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });

  const archives: Buffer[] = [];
  for (let attempt = 0; attempt < 2; attempt++) {
    await page.getByRole("button", { name: "Render PNGs", exact: true }).click();
    await expect(page.getByText(/5 pages rendered · ZIP/)).toBeVisible({ timeout: 45_000 });
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download ZIP", exact: true }).click();
    const download = await downloadEvent;
    expect(download.suggestedFilename()).toBe("toolbox-pages.zip");
    const path = info.outputPath(`all-pages-${attempt + 1}.zip`);
    await download.saveAs(path);
    const archive = await readFile(path);
    archives.push(archive);
    const entries = unzipSync(archive);
    const expectedNames = [1, 2, 3, 4, 5].map(
      (number) => `page-${String(number).padStart(3, "0")}.png`,
    );
    expect(Object.keys(entries)).toEqual(expectedNames);
    for (const name of expectedNames) {
      const image = entries[name];
      if (!image) throw new Error(`Missing ZIP entry ${name}`);
      expect(pngDimensions(image).width).toBeLessThanOrEqual(8_192);
      expect(pngDimensions(image).height).toBeLessThanOrEqual(8_192);
    }
    const pageHashes = expectedNames.map((name) => {
      const image = entries[name];
      if (!image) throw new Error(`Missing ZIP entry ${name}`);
      return createHash("sha256").update(image).digest("hex");
    });
    expect(new Set(pageHashes).size).toBeGreaterThan(1);
    expect(archive.byteLength).toBeLessThanOrEqual(32 * 1024 * 1024);
  }
  const firstArchive = archives[0];
  const secondArchive = archives[1];
  if (!firstArchive || !secondArchive) throw new Error("Repeated ZIP outputs were not captured.");
  expect(firstArchive.equals(secondArchive)).toBe(true);
  await page.screenshot({
    path: info.outputPath("pdf-to-png-desktop.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  await info.attach("pdf-to-png-mixed-pages.zip", {
    path: info.outputPath("all-pages-1.zip"),
    contentType: "application/zip",
  });
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("accepts drag and drop, supports keyboard page selection on mobile, and downloads a single PNG", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(request.method());
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await dropPdf(page, pdfFixture("split-pages.pdf"), "mixed-pages.pdf");
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const selectedMode = page.getByRole("button", { name: "Selected pages", exact: true });
  await selectedMode.focus();
  await page.keyboard.press("Enter");
  await expect(selectedMode).toHaveAttribute("aria-pressed", "true");
  await page.getByLabel("Page numbers", { exact: true }).fill("4");
  await page.getByLabel("Image resolution", { exact: true }).selectOption("192");
  const renderButton = page.getByRole("button", { name: "Render PNG", exact: true });
  await renderButton.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByText(/1 page rendered · PNG/)).toBeVisible({ timeout: 45_000 });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PNG", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("toolbox-page-004.png");
  const outputPath = info.outputPath("pdf-to-png-selected.png");
  await download.saveAs(outputPath);
  const png = new Uint8Array(await readFile(outputPath));
  const dimensions = pngDimensions(png);
  expect(dimensions.width * dimensions.height).toBeLessThanOrEqual(8_000_000);
  await expect(page.locator('img[alt^="Rendered PDF page 4"]')).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth))
    .toBe(true);
  await page.screenshot({
    path: info.outputPath("pdf-to-png-mobile.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden !important; }",
  });
  await info.attach("pdf-to-png-selected.png", { path: outputPath, contentType: "image/png" });
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("preserves transparent areas and fills an opaque white background when selected", async ({
  page,
}, info) => {
  test.setTimeout(90_000);
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await choosePdf(page, pdfFixture("pdf-to-png-transparent.pdf"));
  await expect(page.getByText("PDF ready. 1 page available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Render PNG", exact: true }).click();
  await expect(page.getByText(/1 page rendered · PNG/)).toBeVisible({ timeout: 45_000 });
  const transparentPixels = await pagePixels(page);
  expect(transparentPixels).toMatchObject({ width: 192, height: 192, blank: [0, 0, 0, 0] });
  expect(transparentPixels.red[0]).toBeGreaterThan(240);
  expect(transparentPixels.red[1]).toBeLessThan(15);
  expect(transparentPixels.red[2]).toBeLessThan(15);
  expect(transparentPixels.red[3]).toBe(255);

  await page.getByLabel("PNG background", { exact: true }).selectOption("white");
  await page.getByRole("button", { name: "Render PNG", exact: true }).click();
  await expect(page.getByText(/1 page rendered · PNG/)).toBeVisible({ timeout: 45_000 });
  const whitePixels = await pagePixels(page);
  expect(whitePixels).toMatchObject({ width: 192, height: 192, blank: [255, 255, 255, 255] });
  expect(whitePixels.red[0]).toBeGreaterThan(240);
  expect(whitePixels.red[3]).toBe(255);
  await page.screenshot({
    path: info.outputPath("pdf-to-png-alpha-white.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden !important; }",
  });
});

test("rejects malformed, encrypted, interactive and oversized inputs", async ({ page }) => {
  test.setTimeout(90_000);
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  for (const [fixture, message] of [
    ["damaged.pdf", "A PDF is empty, damaged or has the wrong type."],
    ["encrypted.pdf", "Encrypted PDFs are not supported."],
    ["javascript.pdf", "This PDF contains forms, annotations, layers, actions or attachments."],
    ["too-many-pages.pdf", "This PDF exceeds a file, page, pixel, time, or output limit."],
  ] as const) {
    await choosePdf(page, pdfFixture(fixture));
    await expect(page.getByText(message, { exact: false })).toBeVisible({ timeout: 30_000 });
  }
  await choosePdf(page, pdfFixture("pdf-to-png-large-page.pdf"));
  await expect(page.getByText("PDF ready. 1 page available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText("Showing the first page of 1.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByRole("button", { name: "Render PNG", exact: true }).click();
  await expect(
    page.getByText("This PDF exceeds a file, page, pixel, time, or output limit.", {
      exact: false,
    }),
  ).toBeVisible({ timeout: 60_000 });
});

test("cancels during PNG encoding without fake progress, then retries and releases resources", async ({
  page,
}) => {
  test.setTimeout(90_000);
  await installLifecycleProbe(page);
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await choosePdf(page, pdfFixture("split-pages.pdf"));
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate(() => {
    const probe = window.__tbxPdfPngTest;
    if (probe) {
      probe.encodeCount = 0;
      probe.holdAt = 1;
    }
  });
  await page.getByRole("button", { name: "Render PNGs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Boolean(window.__tbxPdfPngTest?.releaseHeldEncoding)))
    .toBe(true);
  await expect(page.getByTestId("render-progress")).toHaveCount(0);
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. You can try again or reset.", { exact: true }),
  ).toBeVisible();
  await expect
    .poll(() =>
      page.locator("canvas.hidden").evaluate((canvas) => (canvas as HTMLCanvasElement).width),
    )
    .toBe(0);
  await page.evaluate(() => {
    const probe = window.__tbxPdfPngTest;
    probe?.releaseHeldEncoding?.();
    if (probe) {
      probe.releaseHeldEncoding = null;
      probe.holdAt = 0;
    }
  });
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Render PNGs", exact: true }).click();
  await expect(page.getByText(/5 pages rendered · ZIP/)).toBeVisible({ timeout: 45_000 });
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No PDF selected" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.__tbxPdfPngTest?.objectUrls)).toBe(0);
  await expect.poll(() => page.evaluate(() => window.__tbxPdfPngTest?.activeWorkers)).toBe(0);
});

test("benchmarks real PNG output for three bounded image-backed PDFs", async ({ page }, info) => {
  test.setTimeout(180_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  const metrics: Array<{
    inputBytes: number;
    outputBytes: number;
    renderMs: number;
    width: number;
    height: number;
  }> = [];
  for (const width of [800, 2000, 4000]) {
    const fixture = pdfFixture(`image-${width}.pdf`);
    const inputBytes = (await readFile(fixture)).byteLength;
    await choosePdf(page, fixture);
    await expect(page.getByText("PDF ready. 1 page available.", { exact: true })).toBeVisible({
      timeout: 30_000,
    });
    await page.getByRole("button", { name: "Render PNG", exact: true }).click();
    await expect(page.getByText(/1 page rendered · PNG/)).toBeVisible({ timeout: 45_000 });
    const summary = await page.getByText(/1 page rendered · PNG/).textContent();
    const duration = summary?.match(/· (\d+) ms$/);
    if (!duration?.[1]) throw new Error("The PDF render duration was not reported.");
    const preview = page.locator('img[alt^="Rendered PDF page"]');
    await expect(preview).toBeVisible();
    const resultImage = await preview.evaluate((image) => ({
      width: (image as HTMLImageElement).naturalWidth,
      height: (image as HTMLImageElement).naturalHeight,
    }));
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PNG", exact: true }).click();
    const download = await downloadEvent;
    const outputPath = info.outputPath(`pdf-to-png-${width}.png`);
    await download.saveAs(outputPath);
    const outputBytes = (await readFile(outputPath)).byteLength;
    metrics.push({ inputBytes, outputBytes, renderMs: Number(duration[1]), ...resultImage });
  }
  console.log(`TBX-008 PNG benchmark: ${JSON.stringify(metrics)}`);
  await info.attach("pdf-to-png-benchmark.json", {
    body: Buffer.from(JSON.stringify(metrics, null, 2)),
    contentType: "application/json",
  });
});
