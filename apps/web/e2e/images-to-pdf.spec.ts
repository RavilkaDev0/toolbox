import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { decodePDFRawStream, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";

const fixture = (name: string) => resolve("e2e/fixtures/images", name);
const toolUrl = "/tools/images-to-pdf";
async function select(page: Page, names: string[]) {
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Choose images", { exact: true }).setInputFiles(names.map(fixture));
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}
async function output(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "Create PDF", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible();
  await expect(page.getByText(/^Showing PDF page 1 of/)).toBeVisible();
  const downloaded = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await downloaded;
  expect(download.suggestedFilename()).toBe("toolbox-images.pdf");
  const path = info.outputPath(`${name}.pdf`);
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await info.attach(name, { path, contentType: "application/pdf" });
  return PDFDocument.load(bytes);
}
function imageOnPage(pdf: PDFDocument, index: number) {
  const page = pdf.getPage(index);
  const resources = page.node.Resources();
  if (!resources) throw new Error("Missing resources");
  const images = resources.lookup(PDFName.of("XObject"));
  if (!images || !("values" in images)) throw new Error("Missing images");
  const refs = (images as import("pdf-lib").PDFDict).values();
  const stream = pdf.context.lookup(refs[0]);
  if (!(stream instanceof PDFRawStream)) throw new Error("Invalid image stream");
  return stream;
}
test("real mixed conversion, keyboard order, Auto, alpha and local download", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(request.method());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(toolUrl);
  await select(page, ["landscape.jpg", "transparent.png", "square.webp"]);
  await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(3);
  await page.getByRole("button", { name: "Move image 3 up", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("img", { name: /^Page / }).nth(1)).toHaveAttribute(
    "alt",
    /square.webp/,
  );
  await page.getByLabel("Page size", { exact: true }).selectOption("auto");
  for (const label of ["Orientation", "Margins", "Placement"])
    await expect(page.getByLabel(label, { exact: true })).toBeDisabled();
  const pdf = await output(page, info, "mixed-auto");
  expect(pdf.getPageCount()).toBe(3);
  expect(pdf.getPages().map((p) => p.getSize())).toEqual([
    { width: 180, height: 90 },
    { width: 120, height: 120 },
    { width: 90, height: 180 },
  ]);
  const png = imageOnPage(pdf, 2);
  expect(png.dict.lookup(PDFName.of("Width"))?.toString()).toBe("120");
  const alpha = pdf.context.lookup(png.dict.get(PDFName.of("SMask")));
  if (!(alpha instanceof PDFRawStream)) throw new Error("Missing alpha stream");
  const mask = decodePDFRawStream(alpha).decode();
  expect(mask[0]).toBe(0);
  expect(mask[120 * 100 + 50]).toBe(128);
  await expect(page.getByRole("link", { name: "Open PDF", exact: true })).toHaveAttribute(
    "href",
    /^blob:/,
  );
  await page.getByLabel("PDF preview page", { exact: true }).selectOption("3");
  await expect(page.getByText("Showing PDF page 3 of 3.", { exact: true })).toBeVisible();
  const pixel = await page.locator("canvas").evaluate((node) => {
    if (!(node instanceof HTMLCanvasElement)) throw new Error("Expected PDF canvas");
    return Array.from(
      node
        .getContext("2d")
        ?.getImageData(Math.floor(node.width / 2), Math.floor(node.height / 2), 1, 1).data ?? [],
    );
  });
  expect(pixel[0]).toBeGreaterThanOrEqual(130);
  expect(pixel[0]).toBeLessThanOrEqual(145);
  expect(pixel[1]).toBeGreaterThan(200);
  expect(pixel[2]).toBeGreaterThan(155);
  expect(pixel[3]).toBe(255);
  expect(pdf.getTitle()).toBeUndefined();
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("A4 Fit and Letter Fill preserve proportions and margins", async ({ page }, info) => {
  await page.goto(toolUrl);
  await select(page, ["landscape.jpg"]);
  let pdf = await output(page, info, "a4-fit");
  expect(pdf.getPage(0).getWidth()).toBeCloseTo(595.2756);
  expect(pdf.getPage(0).getHeight()).toBeCloseTo(841.8898);
  await page.getByLabel("Page size", { exact: true }).selectOption("letter");
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
  await page.getByLabel("Orientation").selectOption("landscape");
  await page.getByLabel("Margins").selectOption("20");
  await page.getByLabel("Placement").selectOption("fill");
  pdf = await output(page, info, "letter-fill");
  expect(pdf.getPage(0).getSize()).toEqual({ width: 792, height: 612 });
  const contents = pdf.getPage(0).node.Contents();
  if (!contents || !("asArray" in contents)) throw new Error("Missing contents");
  const raw = pdf.context.lookup(contents.asArray()[0]);
  if (!(raw instanceof PDFRawStream)) throw new Error("Invalid content stream");
  const operators = new TextDecoder().decode(decodePDFRawStream(raw).decode());
  expect(operators).toContain("W\nn");
  const transform = operators.split("\n").find((line) => /^997\./.test(line));
  expect(transform).toBeDefined();
  await output(page, info, "letter-fill-repeat");
});

test("EXIF orientation and lossy WebP decode into correct Auto pages", async ({ page }, info) => {
  await page.goto(toolUrl);
  await select(page, ["oriented.jpg", "lossy.webp", "transparent.webp"]);
  await page.getByLabel("Page size", { exact: true }).selectOption("auto");
  const pdf = await output(page, info, "orientation");
  expect(pdf.getPages().map((p) => p.getSize())).toEqual([
    { width: 30, height: 60 },
    { width: 120, height: 120 },
    { width: 90, height: 180 },
  ]);
  expect(imageOnPage(pdf, 2).dict.has(PDFName.of("SMask"))).toBe(true);
});

test("rejects invalid input atomically, permits removal, drop and repeated selection", async ({
  page,
}) => {
  await page.goto(toolUrl);
  await select(page, ["landscape.jpg"]);
  for (const file of [
    "damaged.png",
    "corrupt-pixels.png",
    "oversized.png",
    "animated.webp",
    "animated.png",
  ]) {
    await page.getByLabel("Choose images", { exact: true }).setInputFiles(fixture(file));
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(1);
  }
  for (const input of [
    { name: "empty.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(0) },
    { name: "wrong.png", mimeType: "image/png", buffer: await readFile(fixture("landscape.jpg")) },
    { name: "huge.jpg", mimeType: "image/jpeg", buffer: Buffer.alloc(8 * 1024 * 1024 + 1) },
    { name: "file.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a") },
  ]) {
    await page.getByLabel("Choose images", { exact: true }).setInputFiles(input);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(1);
  }
  await page.getByRole("button", { name: "Remove image 1", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No images selected" })).toBeVisible();
  const bytes = Array.from(await readFile(fixture("square.webp")));
  await page.getByRole("region", { name: "File selection", exact: true }).evaluate((node, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], "dropped.webp", { type: "image/webp" }));
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  }, bytes);
  await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(1);
  await select(page, ["square.webp"]);
  await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(2);
  await page
    .getByRole("img", { name: /^Page / })
    .nth(1)
    .dragTo(page.locator("ol > li").first());
  await expect(page.getByRole("img", { name: /^Page / }).first()).toHaveAttribute(
    "alt",
    /square.webp/,
  );
});

test("cancel and reset terminate jobs, revoke URLs, discard stale results and allow retry", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const live = new Set<string>();
    const originalCreate = URL.createObjectURL.bind(URL);
    const originalRevoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = originalCreate(blob);
      live.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      live.delete(url);
      originalRevoke(url);
    };
    Object.defineProperty(window, "liveBlobUrls", { get: () => live.size });
  });
  await page.goto(toolUrl);
  await select(page, ["noise-4000.jpg", "transparent.png"]);
  await page.getByRole("button", { name: "Create PDF", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  await expect(page.getByText("Operation cancelled. You can try again or reset.")).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF" })).toHaveCount(0);
  const pdf = await output(page, info, "retry");
  expect(pdf.getPageCount()).toBe(2);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("img", { name: /^Page / })).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "liveBlobUrls"))).toBe(0);
  await page.getByLabel("Choose images", { exact: true }).setInputFiles(fixture("noise-4000.jpg"));
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No images selected" })).toBeVisible();
  await select(page, ["landscape.jpg"]);
  await output(page, info, "after-reset");
  await page.goto("/tools");
  expect(await page.evaluate(() => Reflect.get(window, "liveBlobUrls"))).toBe(0);
});

test("mobile touch-sized controls, conversion and screenshots", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(toolUrl);
    await select(page, ["landscape.jpg", "transparent.png", "square.webp"]);
    await output(page, info, `viewport-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .getByRole("button", { name: "Move image 2 up", exact: true })
        .evaluate((node) => node.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: info.outputPath(`images-${width}.png`),
      fullPage: true,
      caret: "initial",
      style: "nextjs-portal { visibility: hidden; }",
    });
  }
  expect(errors).toEqual([]);
});

test("measures real conversion at three bounded input sizes", async ({ page }, info) => {
  const metrics: { pixels: number; inputBytes: number; outputBytes: number; elapsedMs: number }[] =
    [];
  for (const width of [800, 2000, 4000]) {
    await page.goto(toolUrl);
    const file = fixture(`noise-${width}.jpg`);
    await select(page, [`noise-${width}.jpg`]);
    const started = performance.now();
    await output(page, info, `benchmark-${width}`);
    metrics.push({
      pixels: width * width * 0.75,
      inputBytes: (await readFile(file)).length,
      outputBytes: (await readFile(info.outputPath(`benchmark-${width}.pdf`))).length,
      elapsedMs: Math.round(performance.now() - started),
    });
  }
  const path = info.outputPath("performance.json");
  await writeFile(path, JSON.stringify(metrics, null, 2));
  await info.attach("performance", { path, contentType: "application/json" });
});

test("preview worker failure leaves a verified PDF available for download", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    let count = 0;
    window.Worker = class extends NativeWorker {
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        count++;
        if (count === 3)
          queueMicrotask(() =>
            this.dispatchEvent(
              new ErrorEvent("error", { message: "Synthetic preview worker failure" }),
            ),
          );
      }
    };
  });
  await page.goto(toolUrl);
  await select(page, ["landscape.jpg"]);
  await page.getByRole("button", { name: "Create PDF", exact: true }).click();
  await expect(
    page.getByText("Preview could not be displayed. Open or download the PDF to view it.", {
      exact: true,
    }),
  ).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await pending;
  const path = info.outputPath("preview-failed.pdf");
  await download.saveAs(path);
  expect((await PDFDocument.load(await readFile(path))).getPageCount()).toBe(1);
});
