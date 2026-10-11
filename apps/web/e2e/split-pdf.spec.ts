import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";

test.describe.configure({ mode: "serial" });

const fixture = resolve("e2e/fixtures/pdfs/split-pages.pdf");
const toolUrl = "/tools/split-pdf";

test("extracts selected pages in source order and downloads verified PDF without uploads", async ({
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
  const response = await page.goto(toolUrl);
  expect(response?.ok()).toBe(true);
  await expect(
    page.getByRole("heading", { level: 1, name: "Split PDF", exact: true }),
  ).toBeVisible();
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/split-pdf$/,
  );
  await expect(
    page.getByText("Your PDF stays in this browser tab. No upload, account or registration."),
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Combine PDF documents", exact: true }),
  ).toHaveAttribute("href", "/tools/merge-pdf");
  await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Showing PDF page 1 of 5/)).toBeVisible();
  await page.getByLabel("Pages", { exact: true }).fill("5,1-2,4,1");
  await expect(page.getByText("4 of 5 pages selected · estimated output: 1 PDF")).toBeVisible();
  await page.getByRole("button", { name: "Extract pages", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await expect(page.getByText(/Showing PDF page 1 of 4/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("toolbox-extracted.pdf");
  const path = info.outputPath("extracted.pdf");
  await download.saveAs(path);
  const result = await PDFDocument.load(await readFile(path));
  const source = await PDFDocument.load(await readFile(fixture));
  expect(result.getPageCount()).toBe(4);
  const expected = [0, 1, 3, 4];
  for (const [index, pageResult] of result.getPages().entries()) {
    const original = source.getPage(expected[index] ?? -1);
    expect(pageResult.getSize()).toEqual(original.getSize());
    expect(pageResult.getRotation()).toEqual(original.getRotation());
  }
  await page.screenshot({
    path: info.outputPath("split-pdf-desktop.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await info.attach("split-pdf-extract", { path, contentType: "application/pdf" });
  expect(unexpectedRequests).toEqual([]);
  expect(errors).toEqual([]);
});

test("splits selected pages to a real ZIP with safe names, then supports retry and reset", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    let holdNextSplit = false;
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
      if (holdNextSplit && message && typeof message === "object" && "action" in message) {
        if (Reflect.get(message, "action") === "split") {
          holdNextSplit = false;
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
    Object.defineProperty(window, "holdNextSplit", {
      value: () => {
        holdNextSplit = true;
      },
    });
    Object.defineProperty(window, "splitResources", {
      get: () => ({ workers, urls }),
    });
  });
  await page.goto(toolUrl);
  const bytes = Array.from(await readFile(fixture));
  await page.getByRole("region", { name: "File selection", exact: true }).evaluate((node, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], "../../private-name.pdf", { type: "" }));
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  }, bytes);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Output mode", { exact: true }).selectOption("split");
  await page.getByLabel("Pages", { exact: true }).fill("4,1");
  await expect(
    page.getByText("2 of 5 pages selected · estimated output: 2 PDF files"),
  ).toBeVisible();
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download ZIP", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("toolbox-pages.zip");
  const path = info.outputPath("selected-pages.zip");
  await download.saveAs(path);
  const archive = unzipSync(await readFile(path));
  expect(Object.keys(archive).sort()).toEqual(["page-001.pdf", "page-004.pdf"]);
  const first = await PDFDocument.load(archive["page-001.pdf"] ?? new Uint8Array());
  const fourth = await PDFDocument.load(archive["page-004.pdf"] ?? new Uint8Array());
  expect(first.getPageCount()).toBe(1);
  expect(fourth.getPageCount()).toBe(1);
  const source = await PDFDocument.load(new Uint8Array(bytes));
  expect(first.getPage(0)?.getSize()).toEqual(source.getPage(0)?.getSize());
  expect(fourth.getPage(0)?.getRotation()).toEqual(source.getPage(3)?.getRotation());
  await info.attach("split-pdf-zip", { path, contentType: "application/zip" });

  await page.evaluate(() => Reflect.apply(Reflect.get(window, "holdNextSplit"), window, []));
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. Your PDF remains selected for retry.", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "splitResources"))).toEqual({
    workers: 0,
    urls: 0,
  });
  await page.getByRole("button", { name: "All pages", exact: true }).click();
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toBeVisible({
    timeout: 15_000,
  });
  const retryDownload = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download ZIP", exact: true }).click();
  const retry = await retryDownload;
  const retryPath = info.outputPath("all-pages.zip");
  await retry.saveAs(retryPath);
  expect(Object.keys(unzipSync(await readFile(retryPath))).length).toBe(5);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No PDF selected", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "splitResources")))
    .toEqual({
      workers: 0,
      urls: 0,
    });
});

test("rejects malformed and oversized documents and remains keyboard accessible on mobile", async ({
  page,
}, info) => {
  test.setTimeout(180_000);
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto(toolUrl);
  await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(fixture);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  const field = page.getByLabel("Pages", { exact: true });
  await field.fill("1-9");
  await expect(
    page.getByText("Choose pages from 1 to the document page count.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Extract pages", exact: true })).toBeDisabled();
  await field.fill("2,1");
  await expect(page.getByText("2 of 5 pages selected · estimated output: 1 PDF")).toBeVisible();
  await page.getByRole("button", { name: "Extract pages", exact: true }).focus();
  await expect(page.getByRole("button", { name: "Extract pages", exact: true })).toBeFocused();
  await expect(page.getByText(/Showing PDF page 1 of 5\./)).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("img", { name: "Generated PDF page 1", exact: true })).toBeVisible();
  await expect(
    page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
  ).resolves.toBe(true);
  await page.screenshot({
    path: info.outputPath("split-pdf-mobile.png"),
    fullPage: true,
    style: "nextjs-portal { visibility: hidden; }",
  });
  await expect
    .poll(() =>
      page
        .getByRole("button", { name: "Extract pages", exact: true })
        .evaluate((node) => node.getBoundingClientRect().height),
    )
    .toBeGreaterThanOrEqual(44);
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await expect(
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).resolves.toBe(true);
  }
  await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles({
    name: "too-large.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.alloc(8 * 1024 * 1024 + 1),
  });
  await expect(
    page.getByText("This PDF is larger than 8 MiB. Choose a smaller document.", { exact: true }),
  ).toBeVisible();
  const rejectedFiles = [
    ["damaged.pdf", "A PDF is empty, damaged or has the wrong type. Choose a valid PDF and retry."],
    [
      "encrypted.pdf",
      "Encrypted PDFs are not supported. Export an unprotected copy using an authorized PDF editor.",
    ],
  ] as const;
  for (const [name, message] of rejectedFiles) {
    await page
      .getByLabel("Choose a PDF", { exact: true })
      .setInputFiles(resolve("e2e/fixtures/pdfs", name));
    await expect(page.getByText(message, { exact: true })).toBeVisible({ timeout: 30_000 });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  const overLimitFile = resolve("e2e/fixtures/pdfs", "split-large-output.pdf");
  await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(overLimitFile);
  await expect(page.getByText("PDF ready. 5 pages available.", { exact: true })).toBeVisible({
    timeout: 30_000,
  });
  await page.getByLabel("Output mode", { exact: true }).selectOption("split");
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await expect(
    page.getByText(
      "This selection exceeds the limits or processing time. Use smaller PDFs or split the batch.",
      { exact: true },
    ),
  ).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toHaveCount(0);
  await page.getByLabel("Pages", { exact: true }).fill("1");
  await page.getByRole("button", { name: "Split PDF", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toBeVisible({
    timeout: 30_000,
  });
  expect(errors).toEqual([]);
});

test("measures real split output for three bounded image-backed PDFs", async ({
  page,
  browserName,
}, info) => {
  test.skip(browserName !== "chromium", "Record one unthrottled Chromium performance sample.");
  test.setTimeout(180_000);
  await page.goto(toolUrl);
  const measurements: Array<{
    input: string;
    inputBytes: number;
    zipBytes: number;
    pagePdfBytes: number;
    processingMs: number;
    mainRealmHeapBytes: number | null;
    pages: number;
  }> = [];
  for (const input of ["image-800.pdf", "image-2000.pdf", "image-4000.pdf"]) {
    const inputPath = resolve("e2e/fixtures/pdfs", input);
    const inputBytes = await readFile(inputPath);
    await page.getByLabel("Choose a PDF", { exact: true }).setInputFiles(inputPath);
    await expect(page.getByText(/PDF ready\. 1 pages? available\./)).toBeVisible({
      timeout: 30_000,
    });
    await page.getByLabel("Output mode", { exact: true }).selectOption("split");
    const startedAt = await page.evaluate(() => performance.now());
    await page.getByRole("button", { name: "Split PDF", exact: true }).click();
    await expect(page.getByRole("link", { name: "Download ZIP", exact: true })).toBeVisible({
      timeout: 30_000,
    });
    const processingMs = Math.round(
      await page.evaluate((start) => performance.now() - start, startedAt),
    );
    const downloadEvent = page.waitForEvent("download");
    await page.getByRole("link", { name: "Download ZIP", exact: true }).click();
    const download = await downloadEvent;
    const path = info.outputPath(input.replace(".pdf", ".zip"));
    await download.saveAs(path);
    const archive = unzipSync(await readFile(path));
    expect(Object.keys(archive)).toEqual(["page-001.pdf"]);
    const pagePdf = archive["page-001.pdf"];
    if (!pagePdf) throw new Error("Split ZIP is missing page-001.pdf");
    const parsed = await PDFDocument.load(pagePdf);
    measurements.push({
      input,
      inputBytes: inputBytes.byteLength,
      zipBytes: (await readFile(path)).byteLength,
      pagePdfBytes: pagePdf.byteLength,
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
  await info.attach("split-pdf-performance.json", {
    body: report,
    contentType: "application/json",
  });
  await writeFile(info.outputPath("split-pdf-performance.json"), report);
});
