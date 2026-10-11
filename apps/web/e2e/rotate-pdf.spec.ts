import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFRawStream } from "pdf-lib";

test.describe.configure({ mode: "serial" });

const fixture = resolve("e2e/fixtures/pdfs/split-pages.pdf");
const toolUrl = "/tools/rotate-pdf";
function pageContent(page: import("pdf-lib").PDFPage) {
  const raw = page.doc.context.lookup(page.node.Contents());
  const streams =
    raw instanceof PDFArray ? raw.asArray().map((ref) => page.doc.context.lookup(ref)) : [raw];
  return streams
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) throw new Error("Missing page content");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
}
const boxNames = ["getMediaBox", "getCropBox", "getBleedBox", "getTrimBox", "getArtBox"] as const;

test("rotates selected pages in the browser, preserves page content, and downloads the real PDF", async ({
  page,
}, info) => {
  const unexpectedRequests: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      (!request.url().startsWith("http://127.0.0.1:3100/") && !request.url().startsWith("blob:"))
    )
      unexpectedRequests.push(`${request.method()} ${request.url()}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  const response = await page.goto(toolUrl);
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { level: 1, name: "Rotate PDF", exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/rotate-pdf$/,
  );
  await expect(
    page.getByText("Your PDF stays in this browser tab. No uploads, account or registration."),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Rotate PDF pages", exact: true })).toHaveCount(0);
  await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Showing PDF page 1 of 5\./)).toBeVisible({ timeout: 30_000 });
  await page.getByRole("button", { name: "Selected pages", exact: true }).focus();
  await page.keyboard.press("Enter");
  await page.getByLabel("Page numbers", { exact: true }).fill("4,2,2");
  await expect(page.getByText("2 of 5 pages selected.", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Rotation preview: Page 2: 90° → 180°; Page 4: 270° → 0°.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply rotation", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Showing PDF page 1 of 5\./).last()).toBeVisible({ timeout: 30_000 });
  const downloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await downloadEvent;
  expect(download.suggestedFilename()).toBe("toolbox-rotated.pdf");
  const outputPath = info.outputPath("selected-right.pdf");
  await download.saveAs(outputPath);
  const source = await PDFDocument.load(await readFile(fixture));
  const output = await PDFDocument.load(await readFile(outputPath));
  expect(output.getPageCount()).toBe(5);
  expect(output.getPages().map((outputPage) => outputPage.getRotation().angle)).toEqual([
    0, 180, 0, 0, 0,
  ]);
  for (const [index, outputPage] of output.getPages().entries()) {
    const sourcePage = source.getPage(index);
    for (const box of boxNames) expect(outputPage[box]()).toEqual(sourcePage[box]());
    expect(pageContent(outputPage)).toEqual(pageContent(sourcePage));
  }
  await page.screenshot({
    path: info.outputPath("rotate-pdf-desktop.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await info.attach("rotate-selected-right", { path: outputPath, contentType: "application/pdf" });
  expect(unexpectedRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("supports drag/drop, cancellation, all-pages and selected left rotations on mobile", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  const uploads: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  page.on("request", (request) => {
    if (request.method() !== "GET") uploads.push(request.method());
  });
  await page.addInitScript(() => {
    let holdNextRotate = false;
    let workers = 0;
    let urls = 0;
    const createUrl = URL.createObjectURL.bind(URL);
    const revokeUrl = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      urls++;
      return createUrl(blob);
    };
    URL.revokeObjectURL = (url) => {
      urls--;
      revokeUrl(url);
    };
    const originalPostMessage = Worker.prototype.postMessage;
    const reflectedWorker = Worker.prototype as unknown as {
      postMessage: (this: Worker, message: unknown) => void;
    };
    reflectedWorker.postMessage = function (this: Worker, message: unknown) {
      if (holdNextRotate && message && typeof message === "object" && "action" in message) {
        if (Reflect.get(message, "action") === "rotate") {
          holdNextRotate = false;
          return;
        }
      }
      originalPostMessage.call(this, message);
    };
    const NativeWorker = window.Worker;
    window.Worker = new Proxy(NativeWorker, {
      construct(target, args, newTarget) {
        const worker = Reflect.construct(target, args, newTarget) as Worker;
        workers++;
        let active = true;
        const terminate = worker.terminate.bind(worker);
        worker.terminate = () => {
          if (active) {
            active = false;
            workers--;
          }
          terminate();
        };
        return worker;
      },
    });
    Object.defineProperty(window, "holdNextRotate", {
      value: () => {
        holdNextRotate = true;
      },
    });
    Object.defineProperty(window, "rotateResources", {
      get: () => ({ workers, urls }),
    });
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(toolUrl);
  const bytes = Array.from(await readFile(fixture));
  await page.getByRole("region", { name: "File selection", exact: true }).evaluate((node, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(data)], "synthetic-rotations.pdf", {
        type: "application/pdf",
      }),
    );
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  }, bytes);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Showing PDF page 1 of 5\./).first()).toBeVisible({
    timeout: 30_000,
  });
  await page.evaluate(() => Reflect.apply(Reflect.get(window, "holdNextRotate"), window, []));
  await page.getByRole("button", { name: "Apply rotation", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. Your PDF remains selected for retry.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "rotateResources"))).toEqual({
    workers: 0,
    urls: 0,
  });
  await page.getByRole("button", { name: "Rotate 180°", exact: true }).click();
  await page.getByRole("button", { name: "Apply rotation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const source = await PDFDocument.load(new Uint8Array(bytes));
  const allDownloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const allDownload = await allDownloadEvent;
  const allPath = info.outputPath("all-180.pdf");
  await allDownload.saveAs(allPath);
  const allOutput = await PDFDocument.load(await readFile(allPath));
  expect(allOutput.getPages().map((outputPage) => outputPage.getRotation().angle)).toEqual([
    180, 270, 180, 90, 180,
  ]);
  await info.attach("rotate-all-180", { path: allPath, contentType: "application/pdf" });

  await page.getByRole("button", { name: "Selected pages", exact: true }).click();
  await page.getByLabel("Page numbers", { exact: true }).fill("2,4");
  await expect(
    page.getByText("Rotation preview: Page 2: 90° → 270°; Page 4: 270° → 90°.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Rotate left 90°", exact: true }).click();
  await expect(
    page.getByText("Rotation preview: Page 2: 90° → 0°; Page 4: 270° → 180°.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Apply rotation", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("PDF preview page").last().selectOption("4");
  await expect(page.getByText("Showing PDF page 4 of 5.").last()).toBeVisible({ timeout: 30_000 });
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).resolves.toBe(true);
  await page.screenshot({
    path: info.outputPath("rotate-pdf-mobile.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  const leftDownloadEvent = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const leftDownload = await leftDownloadEvent;
  const leftPath = info.outputPath("selected-left.pdf");
  await leftDownload.saveAs(leftPath);
  const leftOutput = await PDFDocument.load(await readFile(leftPath));
  expect(leftOutput.getPages().map((outputPage) => outputPage.getRotation().angle)).toEqual([
    0, 0, 0, 180, 0,
  ]);
  for (const [index, outputPage] of leftOutput.getPages().entries()) {
    const sourcePage = source.getPage(index);
    for (const box of boxNames) expect(outputPage[box]()).toEqual(sourcePage[box]());
    expect(pageContent(outputPage)).toEqual(pageContent(sourcePage));
  }
  await info.attach("rotate-selected-left", { path: leftPath, contentType: "application/pdf" });
  expect(await page.evaluate(() => Reflect.get(window, "rotateResources"))).toEqual({
    workers: 0,
    urls: 1,
  });
  await page.getByRole("button", { name: "Reset", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "No PDF selected", exact: true })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reset", exact: true })).toBeFocused();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "rotateResources")))
    .toEqual({
      workers: 0,
      urls: 0,
    });
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).resolves.toBe(true);
  }
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("measures real rotate output for three bounded image-backed PDFs", async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== "chromium", "Record one unthrottled Chromium performance sample.");
  test.setTimeout(180_000);
  await page.goto(toolUrl);
  const measurements: Array<{
    input: string;
    inputBytes: number;
    outputBytes: number;
    processingMs: number;
    mainRealmHeapBytes: number | null;
    pages: number;
  }> = [];
  for (const input of ["image-800.pdf", "image-2000.pdf", "image-4000.pdf"]) {
    const inputPath = resolve("e2e/fixtures/pdfs", input);
    const inputBytes = await readFile(inputPath);
    await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(inputPath);
    await expect(page.getByText("PDF ready. 1 pages available.", { exact: true })).toBeVisible({
      timeout: 55_000,
    });
    const startedAt = await page.evaluate(() => performance.now());
    await page.getByRole("button", { name: "Apply rotation", exact: true }).click();
    await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible({
      timeout: 55_000,
    });
    const processingMs = Math.round(
      await page.evaluate((start) => performance.now() - start, startedAt),
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download PDF", exact: true }).click();
    const download = await downloadEvent;
    const outputPath = info.outputPath(input);
    await download.saveAs(outputPath);
    const parsed = await PDFDocument.load(await readFile(outputPath));
    expect(parsed.getPageCount()).toBe(1);
    expect(parsed.getPage(0)?.getRotation().angle).toBe(90);
    measurements.push({
      input,
      inputBytes: inputBytes.byteLength,
      outputBytes: (await readFile(outputPath)).byteLength,
      processingMs,
      mainRealmHeapBytes: await page.evaluate(() => {
        const memory = Reflect.get(performance, "memory");
        const bytes = Reflect.get(memory ?? {}, "usedJSHeapSize");
        return typeof bytes === "number" && Number.isFinite(bytes) ? bytes : null;
      }),
      pages: parsed.getPageCount(),
    });
  }
  const report = JSON.stringify({ browser: browserName, measurements }, null, 2);
  await info.attach("rotate-pdf-performance.json", {
    body: report,
    contentType: "application/json",
  });
  await writeFile(info.outputPath("rotate-pdf-performance.json"), report);
});
