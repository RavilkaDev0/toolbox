import { expect, type Page, test } from "@playwright/test";
import { prepareClipboard } from "./clipboard-support";

const toolUrl = "/tools/case-converter";
const inputFor = (page: Page) => page.getByRole("textbox", { name: "Text to convert" });
const outputFor = (page: Page) => page.getByRole("textbox", { name: "Converted text" });

test("converts and copies text locally with keyboard and mobile access", async ({ page }) => {
  const nonReadRequests: string[] = [];
  const requestUrls: string[] = [];
  let consoleErrorCount = 0;
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD")
      nonReadRequests.push(request.url());
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrorCount++;
  });
  page.on("pageerror", () => consoleErrorCount++);
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(toolUrl);
  await expect(page.getByRole("heading", { name: "Case converter" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Reset complete");
  await prepareClipboard(page);
  const input = inputFor(page);
  const output = outputFor(page);
  await expect(input).toBeVisible();
  await input.fill("hELLO, WORLD! SECOND LINE?\n  keep  spacing 😀");
  await page.getByLabel("Conversion mode").selectOption("title");
  await expect(output).toHaveValue("Hello, World! Second Line?\n  Keep  Spacing 😀");
  await page.getByLabel("Conversion mode").selectOption("sentence");
  await expect(output).toHaveValue("Hello, world! Second line?\n  Keep  spacing 😀");

  await input.fill("Iİ");
  await page.getByLabel("Conversion mode").selectOption("lowercase");
  await page.getByLabel("Language rules").selectOption("tr");
  await expect(output).toHaveValue("ıi");
  const copy = page.getByRole("button", { name: "Copy result" });
  await copy.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByRole("status")).toContainText("copied to this device’s clipboard");
  expect(await page.evaluate(() => navigator.clipboard.readText())).toBe("ıi");
  expect(nonReadRequests).toEqual([]);
  expect(requestUrls.some((url) => url.includes("I%C4%B0") || url.includes("%C4%B0"))).toBe(false);
  expect(!page.url().includes("Iİ")).toBe(true);
  expect(
    await page.evaluate(
      () => Object.keys(localStorage).length + Object.keys(sessionStorage).length,
    ),
  ).toBe(0);

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
  expect(consoleErrorCount).toBe(0);
});

test("rejects text beyond the documented bounded input size", async ({ page }) => {
  await page.goto(toolUrl);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Reset complete");
  const input = inputFor(page);
  await input.fill("x".repeat(100_001));
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "100,000 UTF-16 code-unit limit",
  );
  await expect(input).toHaveValue("");
  await expect(outputFor(page)).toHaveValue("");
});
