import { expect, type Page, test } from "@playwright/test";
import { prepareClipboard } from "./clipboard-support";
import { waitForToolPageReady } from "./tool-readiness";

const toolUrl = "/tools/password-generator";
const status = (page: Page) => page.getByRole("status");
test.use({ screenshot: "off", trace: "off" });

test("generates and copies a local cryptographic password, then resets by keyboard", async ({
  page,
}) => {
  let unexpectedRequest = false;
  let passwordInRequest = false;
  let consoleErrorCount = 0;
  let generated = "";
  let secretConsoleLeak = false;
  page.on("request", (request) => {
    if (request.method() !== "GET" && request.method() !== "HEAD") unexpectedRequest = true;
    if (
      generated &&
      (request.url().includes(generated) || request.url().includes(encodeURIComponent(generated)))
    )
      passwordInRequest = true;
  });
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrorCount++;
    if (generated && message.text().includes(generated)) secretConsoleLeak = true;
  });
  page.on("pageerror", () => consoleErrorCount++);

  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await expect(page.getByRole("heading", { name: "Password generator" })).toBeVisible();
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(status(page)).toContainText("Reset complete");
  await prepareClipboard(page);

  const length = page.getByLabel("Password length");
  await length.focus();
  await length.press("Control+A");
  await length.pressSequentially("32");
  const symbols = page.getByLabel("Symbols");
  await symbols.focus();
  await symbols.press("Space");
  await expect(symbols).not.toBeChecked();
  await page.getByRole("button", { name: "Generate password" }).focus();
  await page.getByRole("button", { name: "Generate password" }).press("Enter");
  await expect(status(page)).toContainText("secure random source");
  const hiddenResult = page.getByLabel("Generated password hidden");
  await expect(hiddenResult).toBeVisible();
  await expect(hiddenResult).toHaveText("•".repeat(32));

  await page.getByRole("button", { name: "Show password" }).click();
  const visibleResult = page.getByLabel("Generated password", { exact: true });
  generated = (await visibleResult.textContent()) ?? "";
  await page.getByRole("button", { name: "Hide password" }).click();
  expect(generated.length === 32).toBe(true);
  expect(/^[A-HJ-NP-Za-km-z2-9]+$/.test(generated)).toBe(true);
  expect([...generated].every((character) => !"O0Il1".includes(character))).toBe(true);
  await page.getByRole("button", { name: "Copy password" }).click();
  await expect(status(page)).toContainText("copied to this device’s clipboard");
  expect((await page.evaluate(() => navigator.clipboard.readText())) === generated).toBe(true);
  expect(!page.url().includes(generated)).toBe(true);
  expect((await page.context().cookies()).some((cookie) => cookie.value === generated)).toBe(false);
  await page.getByRole("button", { name: "Regenerate" }).click();
  await expect(status(page)).toContainText("secure random source");
  const regenerated = (await page.getByLabel("Generated password hidden").textContent()) ?? "";
  expect(regenerated.length === 32).toBe(true);
  expect(regenerated === "•".repeat(32)).toBe(true);
  expect(unexpectedRequest).toBe(false);
  expect(passwordInRequest).toBe(false);

  const reset = page.getByRole("button", { name: "Reset" });
  await reset.focus();
  await reset.press("Enter");
  await expect(page.getByLabel("Generated password hidden")).toHaveCount(0);
  await expect(length).toHaveValue("20");
  await expect(symbols).toBeChecked();
  expect(
    await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    })),
  ).toEqual({ local: [], session: [] });
  expect(consoleErrorCount).toBe(0);
  expect(secretConsoleLeak).toBe(false);

  await page.setViewportSize({ width: 390, height: 844 });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});

test("disables generation when no character class is selected", async ({ page }) => {
  await page.goto(toolUrl);
  await waitForToolPageReady(page);
  await page.getByRole("button", { name: "Reset", exact: true }).click();
  await expect(status(page)).toContainText("Reset complete");
  for (const label of [
    "Uppercase letters (A–Z)",
    "Lowercase letters (a–z)",
    "Digits (0–9)",
    "Symbols",
  ]) {
    await page.getByLabel(label).uncheck();
  }
  await expect(page.getByRole("main").getByRole("alert")).toContainText(
    "at least one character type",
  );
  await expect(page.getByRole("button", { name: "Generate password" })).toBeDisabled();
});
