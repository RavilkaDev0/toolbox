import { expect, type Page, test } from "@playwright/test";
import { prepareClipboard } from "./clipboard-support";
import { waitForToolPageReady } from "./tool-readiness";

const toolUrl = "/tools/word-counter";
const metric = (page: Page, label: string) =>
  page.getByTestId(`word-counter-${label.toLowerCase().replaceAll(" ", "-")}`);
const status = (page: Page) => page.getByRole("status");

test("counts Unicode text locally, copies it, clears and resets by keyboard", async ({ page }) => {
  const unexpectedRequests: string[] = [];
  let userTextInRequest = false;
  let consoleErrorCount = 0;
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD")
      unexpectedRequests.push(request.method());
    if (request.url().includes("Hello") || request.url().includes("Привет"))
      userTextInRequest = true;
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrorCount++;
  });
  page.on("pageerror", () => consoleErrorCount++);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await expect(page.getByRole("heading", { name: "Word counter" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(status(page)).toContainText("Reset complete");
  await prepareClipboard(page);
  const input = page.getByLabel("Text to analyze");
  const unicodeText = "e\u0301 😀";
  await input.fill(unicodeText);
  await expect(metric(page, "Characters with whitespace")).toHaveText("3");
  await expect(metric(page, "Characters without whitespace")).toHaveText("2");
  await expect(metric(page, "UTF-16 code units")).toHaveText("5");
  await expect(metric(page, "Unicode code points")).toHaveText("4");
  await expect(metric(page, "Words")).toHaveText("1");

  const multilingualText = "Hello, world!\r\n\r\nПривет мир!\n你好 e\u0301 😀";
  await input.fill(multilingualText);
  await expect(metric(page, "Words")).not.toHaveText("0");
  await expect(metric(page, "Lines")).toHaveText("4");
  await expect(metric(page, "Paragraphs")).toHaveText("2");
  await page.getByRole("button", { name: "Copy text" }).click();
  await expect(status(page)).toContainText("copied to this device’s clipboard");
  const clipboardText = await page.evaluate(() => navigator.clipboard.readText());
  expect(clipboardText.replace(/\r\n?/g, "\n")).toBe(multilingualText.replace(/\r\n?/g, "\n"));
  expect(unexpectedRequests).toEqual([]);
  expect(userTextInRequest).toBe(false);
  expect(!page.url().includes("Hello")).toBe(true);
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
  ).toBe(0);

  await page.getByRole("button", { name: "Clear", exact: true }).click();
  await expect(input).toHaveValue("");
  await expect(metric(page, "Words")).toHaveText("0");
  await input.fill("A short line.");
  const reset = page.getByRole("button", { name: "Reset" });
  await reset.focus();
  await reset.press("Enter");
  await expect(input).toHaveValue("");
  await expect(input).toBeFocused();
  expect(consoleErrorCount).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});

test("rejects text beyond the documented mobile input bound", async ({ page }) => {
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(status(page)).toContainText("Reset complete");
  const input = page.getByLabel("Text to analyze");
  await input.fill("x".repeat(100_001));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "100,000 UTF-16 code-unit limit",
  );
  await expect(input).toHaveValue("");
  await expect(metric(page, "Words")).toHaveText("0");
});
