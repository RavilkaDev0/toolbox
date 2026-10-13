import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { expect, type Page, type TestInfo, test } from "@playwright/test";

const fixture = (name: string) => resolve("e2e/fixtures/images", name);
const toolUrl = "/tools/image-resizer";
const imageInput = (page: Page) => page.getByLabel("Choose one image", { exact: true });

async function selectImage(page: Page, name: string) {
  await page.waitForLoadState("networkidle");
  await imageInput(page).setInputFiles(fixture(name));
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Original:/ })).toBeVisible();
}

async function dropImage(page: Page, name: string) {
  const base64 = (await readFile(fixture(name))).toString("base64");
  await page.evaluate(
    (entry) => {
      const bytes = Uint8Array.from(atob(entry.base64), (character) => character.charCodeAt(0));
      const transfer = new DataTransfer();
      transfer.items.add(new File([bytes], entry.name, { type: "image/webp" }));
      const dropzone = document.querySelector('[aria-label="File selection"]');
      if (!dropzone) throw new Error("Image dropzone is missing");
      dropzone.dispatchEvent(
        new DragEvent("dragover", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
      dropzone.dispatchEvent(
        new DragEvent("drop", { bubbles: true, cancelable: true, dataTransfer: transfer }),
      );
    },
    { name, base64 },
  );
  await expect(
    page.getByText("Files are ready. Review your settings.", { exact: true }),
  ).toBeVisible();
}

async function outputBytes(page: Page, info: TestInfo, name: string, extension: string) {
  await page.getByRole("button", { name: "Resize image", exact: true }).click();
  const resultImage = page.getByRole("img", { name: /^Resized / });
  await expect(resultImage).toBeVisible();
  await expect(page.getByRole("status").last()).toContainText("decoded and checked");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("link", { name: "Download resized image", exact: true }).click();
  const download = await downloadPromise;
  expect(download.suggestedFilename()).toBe(`toolbox-resized-image.${extension}`);
  const outputPath = info.outputPath(name);
  await download.saveAs(outputPath);
  const bytes = await readFile(outputPath);
  await info.attach(name, {
    path: outputPath,
    contentType: `image/${extension === "jpg" ? "jpeg" : extension}`,
  });
  if (
    info.project.name.startsWith("chromium") &&
    ["resized-landscape.jpg", "resized-transparent.png", "resized-square.webp"].includes(name)
  ) {
    const evidence = resolve("../../docs/evidence/tbx-010");
    await mkdir(evidence, { recursive: true });
    await writeFile(resolve(evidence, name), bytes);
  }
  const imageDimensions = await resultImage.evaluate((node) => {
    if (!(node instanceof HTMLImageElement)) throw new Error("Expected the decoded output preview");
    return [node.naturalWidth, node.naturalHeight];
  });
  expect(imageDimensions).toEqual(
    await page
      .getByText(/Output dimensions:/)
      .textContent()
      .then((text) => {
        const match = text?.match(/(\d+) × (\d+) px/);
        return match ? [Number(match[1]), Number(match[2])] : [];
      }),
  );
  return bytes;
}

async function pixel(page: Page, x: number, y: number) {
  return page.getByRole("img", { name: /^Resized / }).evaluate(
    (node, point) => {
      if (!(node instanceof HTMLImageElement))
        throw new Error("Expected the encoded output preview");
      const canvas = document.createElement("canvas");
      canvas.width = node.naturalWidth;
      canvas.height = node.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is not available");
      context.drawImage(node, 0, 0);
      return Array.from(context.getImageData(point.x, point.y, 1, 1).data);
    },
    { x, y },
  );
}

test("real JPEG, PNG and WebP images resize to independently decoded downloads", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    if (request.method() !== "GET")
      uploads.push(`${request.method()} ${new URL(request.url()).pathname}`);
  });
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || /hydrat/i.test(message.text())) errors.push(message.text());
  });
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  await expect(page).toHaveTitle(/Image resizer/);
  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    "href",
    /\/tools\/image-resizer$/,
  );

  for (const [source, extension, startDimensions, outputDimensions] of [
    ["landscape.jpg", "jpg", [240, 120], [101, 51]],
    ["transparent.png", "png", [120, 240], [60, 120]],
    ["square.webp", "webp", [160, 160], [80, 80]],
    ["oriented.jpg", "jpg", [40, 80], [40, 80]],
  ] as const) {
    await selectImage(page, source);
    await expect(page.getByRole("img", { name: /^Original:/ })).toHaveAttribute(
      "alt",
      `Original: ${startDimensions[0]} by ${startDimensions[1]} pixels`,
    );
    await page
      .getByLabel("Output format", { exact: true })
      .selectOption(extension === "jpg" ? "jpeg" : extension);
    if (source === "landscape.jpg") {
      await page.getByLabel("Width (px)").fill("101");
      await expect(page.getByLabel("Height (px)")).toHaveValue("51");
      const bytes = await outputBytes(page, info, "resized-landscape.jpg", extension);
      expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
    } else {
      if (source === "transparent.png") await expect(page.getByLabel(/^Quality/)).toBeDisabled();
      if (source === "transparent.png") {
        await page.getByLabel("Width (px)").fill("60");
      } else if (source === "square.webp") {
        await page.getByLabel("Resize by").selectOption("percentage");
        await page.getByLabel(/^Scale/).fill("50");
      }
      const bytes = await outputBytes(page, info, `resized-${source}`, extension);
      if (extension === "png") expect(bytes.subarray(0, 8).toString("latin1")).toContain("PNG");
      if (extension === "webp") {
        expect(bytes.subarray(0, 4).toString()).toBe("RIFF");
        expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
      }
    }
    const actual = await page.getByRole("img", { name: /^Resized / }).evaluate((node) => {
      if (!(node instanceof HTMLImageElement)) throw new Error("Expected decoded output image");
      return [node.naturalWidth, node.naturalHeight];
    });
    expect(actual).toEqual(outputDimensions);
    if (source === "oriented.jpg") {
      await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
      await page.screenshot({ path: info.outputPath("image-resizer-desktop.png"), fullPage: true });
      if (info.project.name.startsWith("chromium")) {
        const evidence = resolve("../../docs/evidence/tbx-010");
        await mkdir(evidence, { recursive: true });
        await page.screenshot({
          path: resolve(evidence, "image-resizer-desktop.png"),
          fullPage: true,
        });
      }
    }
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  expect(uploads).toEqual([]);
  expect(errors).toEqual([]);
});

test("percentage, unlocked stretch, alpha and JPEG white background are explicit and correct", async ({
  page,
}, info) => {
  await page.goto(toolUrl);
  await selectImage(page, "transparent.png");
  await page.getByLabel("Resize by").selectOption("percentage");
  await page.getByLabel(/^Scale/).fill("50");
  await expect(page.getByText("Output dimensions: 60 × 120 px")).toBeVisible();
  let bytes = await outputBytes(page, info, "alpha.png", "png");
  expect(bytes.subarray(0, 8).toString("latin1")).toContain("PNG");
  expect((await pixel(page, 2, 2))[3]).toBe(0);
  expect((await pixel(page, 30, 60))[3]).toBeGreaterThan(100);

  await page.getByLabel("Output format", { exact: true }).selectOption("webp");
  bytes = await outputBytes(page, info, "alpha.webp", "webp");
  expect(bytes.subarray(8, 12).toString()).toBe("WEBP");
  expect((await pixel(page, 2, 2))[3]).toBe(0);

  await page.getByLabel("Output format", { exact: true }).selectOption("jpeg");
  bytes = await outputBytes(page, info, "opaque.jpg", "jpg");
  expect([...bytes.subarray(0, 2)]).toEqual([0xff, 0xd8]);
  const background = await pixel(page, 2, 2);
  expect(background[0]).toBeGreaterThan(240);
  expect(background[1]).toBeGreaterThan(240);
  expect(background[2]).toBeGreaterThan(240);

  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await selectImage(page, "landscape.jpg");
  await page.getByLabel("Keep aspect ratio").uncheck();
  await page.getByLabel("Width (px)").fill("100");
  await page.getByLabel("Height (px)").fill("100");
  await expect(page.getByText(/image will be stretched/)).toBeVisible();
  await outputBytes(page, info, "stretched.jpg", "jpg");
  await expect(page.getByRole("img", { name: /^Resized JPEG: 100 by 100 pixels/ })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await dropImage(page, "square.webp");
  await expect(page.getByText("square.webp", { exact: true })).toBeVisible();
  await expect(page.getByRole("img", { name: "Original: 160 by 160 pixels" })).toBeVisible();
});

test("rejects empty, spoofed, damaged, animated and oversized inputs before offering an operation", async ({
  page,
}) => {
  await page.goto(toolUrl);
  await selectImage(page, "landscape.jpg");
  const bytes = await readFile(fixture("landscape.jpg"));
  await imageInput(page).setInputFiles({ name: "spoof.png", mimeType: "image/png", buffer: bytes });
  await expect(page.locator('[data-slot="alert"]')).toContainText("does not match");
  await expect(page.getByText("landscape.jpg", { exact: true })).toBeVisible();
  await imageInput(page).setInputFiles({
    name: "empty.png",
    mimeType: "image/png",
    buffer: Buffer.alloc(0),
  });
  await expect(page.locator('[data-slot="alert"]')).toContainText("empty or damaged");
  await imageInput(page).setInputFiles(fixture("damaged.png"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("empty or damaged");
  await imageInput(page).setInputFiles(fixture("corrupt-pixels.png"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("empty or damaged");
  await imageInput(page).setInputFiles(fixture("animated.webp"));
  await expect(page.locator('[data-slot="alert"]')).toContainText("static JPEG, PNG or WebP");
  await imageInput(page).setInputFiles(fixture("oversized.png"));
  await expect(page.locator('[data-slot="alert"]')).toContainText(/8 megapixels|8,192 pixel/);
  await expect(page.getByRole("button", { name: "Resize image", exact: true })).toBeVisible();
  await page.getByLabel("Width (px)").fill("0");
  await expect(page.getByRole("button", { name: "Resize image", exact: true })).toBeDisabled();
  await expect(page.getByRole("img", { name: /^Original:/ })).toBeVisible();
});

test("keyboard controls, cancellation, retry, reset, URL cleanup and mobile layout", async ({
  page,
}) => {
  await page.addInitScript(`
    window.holdImageResize = false;
    window.resizerWorkerTerminations = 0;
    const liveBlobUrls = new Set();
    const createObjectURL = URL.createObjectURL.bind(URL);
    const revokeObjectURL = URL.revokeObjectURL.bind(URL);
    URL.createObjectURL = (blob) => { const url = createObjectURL(blob); liveBlobUrls.add(url); return url; };
    URL.revokeObjectURL = (url) => { liveBlobUrls.delete(url); revokeObjectURL(url); };
    Object.defineProperty(window, "resizerLiveBlobUrls", { get: () => liveBlobUrls.size });
    const NativeWorker = window.Worker;
    window.Worker = class extends NativeWorker {
      postMessage(message, transfer) {
        if (window.holdImageResize && message && message.action === "resize") return;
        return super.postMessage(message, transfer);
      }
      terminate() { window.resizerWorkerTerminations += 1; return super.terminate(); }
    };
  `);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await selectImage(page, "noise-800.jpg");
  await page.evaluate(() => Reflect.set(window, "holdImageResize", true));
  await page.getByRole("button", { name: "Resize image", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("button", { name: "Cancel", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(
    page.getByText("Operation cancelled. You can try again or reset.", { exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("img", { name: /^Resized / })).toHaveCount(0);
  expect(
    await page.evaluate(() => Reflect.get(window, "resizerWorkerTerminations")),
  ).toBeGreaterThan(0);

  await page.evaluate(() => Reflect.set(window, "holdImageResize", false));
  await page.getByRole("button", { name: "Resize image", exact: true }).focus();
  await page.keyboard.press("Enter");
  await expect(
    page.getByRole("link", { name: "Download resized image", exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "resizerLiveBlobUrls"))).toBe(2);
  expect(await page.locator("html").evaluate((node) => node.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  const actionBox = await page.getByRole("button", { name: "Reset", exact: true }).boundingBox();
  expect(actionBox?.height).toBeGreaterThanOrEqual(40);
  await page.addStyleTag({ content: "nextjs-portal { display: none !important; }" });
  await page.screenshot({ path: "test-results/image-resizer-mobile-390.png", fullPage: true });
  if (page.context().browser()?.browserType().name() === "chromium") {
    const evidence = resolve("../../docs/evidence/tbx-010");
    await mkdir(evidence, { recursive: true });
    await page.screenshot({
      path: resolve(evidence, "image-resizer-mobile-390.png"),
      fullPage: true,
    });
  }
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("heading", { name: "No image selected" })).toBeVisible();
  expect(await page.evaluate(() => Reflect.get(window, "resizerLiveBlobUrls"))).toBe(0);
  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    expect(
      await page.locator("html").evaluate((node) => node.scrollWidth <= window.innerWidth),
    ).toBe(true);
  }
});

test("measures real resize output for small, medium and large bounded inputs", async ({
  page,
}, info) => {
  const measurements: {
    input: string;
    inputBytes: number;
    outputBytes: number;
    elapsedMs: number;
  }[] = [];
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto(toolUrl);
  for (const name of ["landscape.jpg", "noise-800.jpg", "noise-2000.jpg"]) {
    await selectImage(page, name);
    await page.getByLabel("Width (px)").fill("120");
    const inputBytes = (await readFile(fixture(name))).byteLength;
    const started = Date.now();
    const bytes = await outputBytes(page, info, `perf-${name}`, "jpg");
    measurements.push({
      input: name,
      inputBytes,
      outputBytes: bytes.length,
      elapsedMs: Date.now() - started,
    });
    await page.getByRole("button", { name: "Reset", exact: true }).click();
  }
  const measurementPath = info.outputPath("image-resizer-performance.json");
  await writeFile(measurementPath, `${JSON.stringify(measurements, null, 2)}\n`);
  await info.attach("image-resizer-performance.json", {
    path: measurementPath,
    contentType: "application/json",
  });
  const evidence = resolve("../../docs/evidence/tbx-010");
  await mkdir(evidence, { recursive: true });
  await writeFile(
    resolve(evidence, "image-resizer-performance.json"),
    `${JSON.stringify(measurements, null, 2)}\n`,
  );
});
