import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { decodePDFRawStream, PDFArray, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import { waitForToolPageReady } from "./tool-readiness";

const fixture = (name: string) => resolve("e2e/fixtures/pdfs", name);
const toolUrl = "/tools/merge-pdf";
async function select(page: Page, names: string[]) {
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(names.map(fixture));
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}
async function output(page: Page, info: TestInfo, name: string) {
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).focus();
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toBeVisible();
  await expect(page.getByText(/^Showing PDF page 1 of/)).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download PDF", exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe("toolbox-merged.pdf");
  const path = info.outputPath(`${name}.pdf`);
  await download.saveAs(path);
  const bytes = await readFile(path);
  expect(bytes.subarray(0, 5).toString()).toBe("%PDF-");
  await info.attach(name, { path, contentType: "application/pdf" });
  return PDFDocument.load(bytes);
}
function contents(page: import("pdf-lib").PDFPage) {
  const raw = page.doc.context.lookup(page.node.Contents());
  const streams =
    raw instanceof PDFArray ? raw.asArray().map((ref) => page.doc.context.lookup(ref)) : [raw];
  return streams
    .map((stream) => {
      if (!(stream instanceof PDFRawStream)) throw Error("Invalid content");
      return new TextDecoder().decode(decodePDFRawStream(stream).decode());
    })
    .join("\n");
}
test("real ordered merge preserves text, vectors, images, boxes and rotations without uploads", async ({
  page,
}, info) => {
  const unexpected: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (
      request.method() !== "GET" ||
      (!request.url().startsWith("http://127.0.0.1:3100/") && !request.url().startsWith("blob:"))
    )
      unexpected.push(request.method());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await select(page, ["a4.pdf", "rotated.pdf"]);
  await page.getByRole("button", { name: "Move document 2 up", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.locator("ol").first().locator("li").first()).toContainText("rotated.pdf");
  await page.getByRole("button", { name: "Preview document 1", exact: true }).click();
  await expect(page.getByText("Showing the first page of 1.", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Document first page", exact: true })).toBeVisible();
  const pdf = await output(page, info, "ordered-merge");
  expect(pdf.getPageCount()).toBe(3);
  const sources = [];
  for (const name of ["rotated.pdf", "a4.pdf"])
    sources.push(...(await PDFDocument.load(await readFile(fixture(name)))).getPages());
  for (const [index, merged] of pdf.getPages().entries()) {
    const source = sources[index];
    if (!source) throw Error("Missing page");
    expect(merged.getSize()).toEqual(source.getSize());
    expect(merged.getRotation()).toEqual(source.getRotation());
    expect(merged.getCropBox()).toEqual(source.getCropBox());
    expect(contents(merged)).toBe(contents(source));
    expect(contents(merged)).toContain(" re");
    expect(contents(merged)).toContain(" Do");
    expect(merged.node.Resources()?.has(PDFName.of("Font"))).toBe(true);
    const images = merged.node.Resources()?.lookup(PDFName.of("XObject"));
    const originals = source.node.Resources()?.lookup(PDFName.of("XObject"));
    if (!images || !originals || !("values" in images) || !("values" in originals))
      throw Error("Missing images");
    const image = pdf.context.lookup((images as import("pdf-lib").PDFDict).values()[0]);
    const original = source.doc.context.lookup(
      (originals as import("pdf-lib").PDFDict).values()[0],
    );
    if (!(image instanceof PDFRawStream) || !(original instanceof PDFRawStream))
      throw Error("Invalid image");
    expect(image.getContents()).toEqual(original.getContents());
  }
  await page.getByLabel("PDF preview page", { exact: true }).selectOption("3");
  await expect(page.getByText("Showing PDF page 3 of 3.")).toBeVisible();
  expect(unexpected).toEqual([]);
  expect(errors).toEqual([]);
});
test("add, actual drag order, remove, repeated selection and two-PDF minimum", async ({
  page,
}, info) => {
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await select(page, ["a4.pdf"]);
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  await select(page, ["letter.pdf"]);
  const rows = page.locator("ol").first().locator("li");
  await rows.nth(1).dragTo(rows.first());
  await expect(rows.first()).toContainText("letter.pdf");
  await page.getByRole("button", { name: "Remove document 2", exact: true }).click();
  await expect(page.getByRole("button", { name: "Merge PDFs", exact: true })).toBeDisabled();
  const bytes = Array.from(await readFile(fixture("a4.pdf")));
  await page.getByRole("region", { name: "File selection", exact: true }).evaluate((node, data) => {
    const transfer = new DataTransfer();
    transfer.items.add(new File([new Uint8Array(data)], "dropped.pdf", { type: "" }));
    node.dispatchEvent(new DragEvent("drop", { bubbles: true, dataTransfer: transfer }));
  }, bytes);
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Preview document 2", exact: true }).click();
  await expect(page.getByText("Showing the first page of 2.", { exact: true })).toBeVisible();
  await select(page, ["letter.pdf"]);
  expect((await output(page, info, "add-remove-drop")).getPageCount()).toBe(4);
});
test("invalid, encrypted, active and resource-limited PDFs preserve the valid selection", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (["warning", "error"].includes(message.type())) errors.push(message.text());
  });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await select(page, ["a4.pdf"]);
  for (const name of [
    "damaged.pdf",
    "encrypted.pdf",
    "javascript.pdf",
    "attachment.pdf",
    "link.pdf",
    "form.pdf",
    "launch.pdf",
    "layers.pdf",
    "large-number.pdf",
    "too-many-pages.pdf",
    "empty-pages.pdf",
  ]) {
    await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(fixture(name));
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Remove document 1", exact: true }),
    ).toBeVisible();
    await expect(page.getByRole("button", { name: "Remove document 2", exact: true })).toHaveCount(
      0,
    );
  }
  for (const input of [
    { name: "empty.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(0) },
    { name: "huge.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(8 * 1024 * 1024 + 1) },
    { name: "wrong.pdf", mimeType: "image/png", buffer: await readFile(fixture("letter.pdf")) },
  ]) {
    await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(input);
    await expect(page.getByRole("main").getByRole("alert")).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("worker cancellation/reset/retry release resources and reject stale results", async ({
  page,
}, info) => {
  await page.addInitScript(() => {
    const urls = new Set<string>();
    const create = URL.createObjectURL.bind(URL),
      revoke = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => {
      const url = create(blob);
      urls.add(url);
      return url;
    };
    URL.revokeObjectURL = (url) => {
      urls.delete(url);
      revoke(url);
    };
    let active = 0;
    const NativeWorker = Worker;
    window.Worker = class extends NativeWorker {
      private alive = true;
      constructor(url: string | URL, options?: WorkerOptions) {
        super(url, options);
        active++;
      }
      override terminate() {
        if (this.alive) {
          active--;
          this.alive = false;
        }
        super.terminate();
      }
    };
    Object.defineProperty(window, "resourceCounts", {
      get: () => ({ urls: urls.size, workers: active }),
    });
  });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await select(page, ["image-4000.pdf", "image-4000.pdf"]);
  await page.getByRole("button", { name: "Merge PDFs", exact: true }).click();
  await page.getByRole("button", { name: "Cancel", exact: true }).press("Enter");
  await expect(
    page.getByText("Operation cancelled. You can try again or reset.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Download PDF", exact: true })).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "resourceCounts"))).toEqual({
    urls: 0,
    workers: 0,
  });
  await output(page, info, "retry");
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No PDFs selected", exact: true })).toBeVisible();
  await expect
    .poll(() => page.evaluate(() => Reflect.get(window, "resourceCounts")))
    .toEqual({ urls: 0, workers: 0 });
  await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(fixture("image-4000.pdf"));
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await select(page, ["a4.pdf", "letter.pdf"]);
  expect((await output(page, info, "after-reset")).getPageCount()).toBe(3);
  await page.goto("/tools");
  expect(await page.evaluate(() => Reflect.get(window, "resourceCounts"))).toEqual({
    urls: 0,
    workers: 0,
  });
});
test("desktop/mobile screens, real preview and touch-sized controls", async ({ page }, info) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(toolUrl);
    await waitForToolPageReady(page);
    await select(page, ["a4.pdf", "letter.pdf"]);
    await output(page, info, `viewport-${width}`);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true,
    );
    expect(
      await page
        .getByRole("button", { name: "Move document 2 up", exact: true })
        .evaluate((node) => node.getBoundingClientRect().height),
    ).toBeGreaterThanOrEqual(44);
    await page.screenshot({
      path: info.outputPath(`merge-${width}.png`),
      fullPage: true,
      style: "nextjs-portal { visibility: hidden; }",
    });
  }
  expect(errors).toEqual([]);
});
test("hung worker times out and is terminated with a recoverable error", async ({ page }) => {
  await page.clock.install({ time: new Date("2030-01-01T00:00:00Z") });
  await page.addInitScript(() => {
    const NativeWorker = Worker;
    let terminated = 0;
    let started = 0;
    window.Worker = class extends NativeWorker {
      override postMessage() {
        /* Fault injection: a worker never answers. */
        started++;
      }
      override terminate() {
        terminated++;
        super.terminate();
      }
    };
    Object.defineProperty(window, "terminatedWorkers", { get: () => terminated });
    Object.defineProperty(window, "startedWorkers", { get: () => started });
  });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await page.waitForLoadState("networkidle");
  await page.clock.pauseAt(new Date("2030-01-01T00:01:00Z"));
  await page.getByLabel("Choose PDFs", { exact: true }).setInputFiles(fixture("letter.pdf"));
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "startedWorkers"))).toBe(1);
  await page.clock.runFor(44_999);
  await expect(page.getByText("Checking files…", { exact: true })).toBeVisible();
  await expect(page.getByRole("main").getByRole("alert")).toHaveCount(0);
  expect(await page.evaluate(() => Reflect.get(window, "terminatedWorkers"))).toBe(0);
  await page.clock.runFor(1);
  expect(await page.evaluate(() => Reflect.get(window, "terminatedWorkers"))).toBe(1);
  // Advance one render frame after asserting termination at the exact deadline.
  await page.clock.runFor(16);
  await expect(page.getByRole("main").getByRole("alert")).toContainText("processing time");
  await page.getByRole("button", { name: "Reset", exact: true }).press("Enter");
  await page.clock.runFor(16);
  await expect(page.getByRole("heading", { name: "No PDFs selected", exact: true })).toBeVisible();
});
test("benchmarks real input/output at three sizes", async ({ page }, info) => {
  const metrics = [];
  for (const width of [800, 2000, 4000]) {
    const name = `image-${width}.pdf`;
    await page.goto(toolUrl);
    await waitForToolPageReady(page);
    await select(page, [name, "letter.pdf"]);
    const started = performance.now();
    const pdf = await output(page, info, `benchmark-${width}`);
    expect(pdf.getPageCount()).toBe(2);
    const memory = await page.evaluate(() => {
      const memory = Reflect.get(performance, "memory") as { usedJSHeapSize?: number } | undefined;
      return memory?.usedJSHeapSize ?? null;
    });
    metrics.push({
      width,
      inputBytes:
        (await readFile(fixture(name))).length + (await readFile(fixture("letter.pdf"))).length,
      outputBytes: (await readFile(info.outputPath(`benchmark-${width}.pdf`))).length,
      elapsedMs: Math.round(performance.now() - started),
      mainJsHeapBytes: memory,
    });
  }
  const path = info.outputPath("performance.json");
  await writeFile(path, `${JSON.stringify(metrics, null, 2)}\n`);
  await info.attach("performance", { path, contentType: "application/json" });
});
