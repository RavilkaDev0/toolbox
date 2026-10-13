import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { inspectImage } from "@toolbox/core";

const toolUrl = "/tools/wifi-qr";

async function saveDownload(page: import("@playwright/test").Page, name: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(
    name === "Download PNG" ? "toolbox-wifi-qr.png" : "toolbox-wifi-qr.svg",
  );
  const path = await download.path();
  expect(path).not.toBeNull();
  return new Uint8Array(await readFile(path as string));
}

test("generates verified Wi-Fi exports locally, supports reset and exposes no upload route", async ({
  page,
}) => {
  const uploads: string[] = [];
  const errors: string[] = [];
  const requestUrls: string[] = [];
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD") uploads.push(request.method());
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(toolUrl);
  await expect(page.getByRole("heading", { name: "Wi-Fi QR code" })).toBeVisible();
  await page.getByLabel("Network name · SSID").fill("Guest; Wi-Fi, 楽しい");
  await page.getByLabel("Network password").fill('very\\safe;password,"quotes"');
  expect(page.url()).not.toContain("Guest");
  expect(page.url()).not.toContain("very");
  await page.getByLabel("Hidden network").check();
  await page.getByRole("button", { name: "Generate Wi-Fi QR" }).click();
  await expect(page.getByRole("status")).toContainText("exact network settings", {
    timeout: 45_000,
  });
  await expect(
    page.getByRole("img", { name: "Independently verified Wi-Fi QR code" }),
  ).toBeVisible();
  const png = await saveDownload(page, "Download PNG");
  expect(inspectImage(png)).toMatchObject({ kind: "png", width: 512, height: 512 });
  expect(png.byteLength).toBeLessThan(5 * 1024 * 1024);
  const svg = await saveDownload(page, "Download vector SVG");
  const svgText = new TextDecoder().decode(svg);
  expect(svgText).toContain("<svg");
  expect(svgText).not.toContain("<script");
  expect(svgText).not.toContain("very\\safe");
  expect(requestUrls.some((url) => url.includes("Guest") || url.includes("very"))).toBe(false);
  expect(uploads).toEqual([]);

  await page.getByRole("button", { name: "Reset" }).click();
  await expect(page.getByLabel("Network name · SSID")).toHaveValue("");
  await expect(page.getByLabel("Network password")).toHaveValue("");
  await expect(page.getByRole("img", { name: "Independently verified Wi-Fi QR code" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("link", { name: "Download PNG" })).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("supports WPA3 SAE, WEP, open network, mobile sizing and keyboard password toggle", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await page.getByLabel("Network name · SSID").fill("Guest");
  await page.getByLabel("Network password").fill("valid passphrase");
  await page.getByLabel("Security").selectOption("wpa3");
  const password = page.getByLabel("Network password");
  const visibility = page.getByRole("button", { name: "Show password" });
  await visibility.focus();
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "text");
  await page.keyboard.press("Enter");
  await expect(password).toHaveAttribute("type", "password");
  await page.getByRole("button", { name: "Generate Wi-Fi QR" }).click();
  await expect(page.getByRole("status")).toContainText("exact network settings", {
    timeout: 45_000,
  });

  await page.getByLabel("Security").selectOption("wep");
  await password.fill("abcde");
  await page.getByRole("button", { name: "Generate Wi-Fi QR" }).click();
  await expect(page.getByRole("status")).toContainText("exact network settings", {
    timeout: 45_000,
  });

  await page.getByLabel("Security").selectOption("open");
  await expect(page.getByLabel("Network password")).toHaveCount(0);
  await page.getByRole("button", { name: "Generate Wi-Fi QR" }).click();
  await expect(page.getByRole("status")).toContainText("exact network settings", {
    timeout: 45_000,
  });
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});
