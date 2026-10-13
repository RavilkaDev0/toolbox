import { readFile } from "node:fs/promises";
import { expect, type Page, type TestInfo, test } from "@playwright/test";
import { inspectImage, parseContactVCard } from "@toolbox/core";

const toolUrl = "/tools/contact-qr";
const status = (page: Page) => page.getByRole("status");

async function saveDownload(page: Page, info: TestInfo, label: string, filename: string) {
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: label, exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe(filename);
  const path = info.outputPath(filename);
  await download.saveAs(path);
  return new Uint8Array(await readFile(path));
}

test("creates a live Unicode contact QR and exports verified PNG, SVG and vCard locally", async ({
  page,
}, info) => {
  const uploads: string[] = [];
  const requestUrls: string[] = [];
  const errors: string[] = [];
  page.on("request", (request) => {
    requestUrls.push(request.url());
    if (request.method() !== "GET" && request.method() !== "HEAD") uploads.push(request.method());
  });
  page.on("console", (message) => {
    if (message.type() === "error") errors.push(message.text());
  });
  page.on("pageerror", (error) => errors.push(error.message));

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(toolUrl);
  await expect(page.getByRole("heading", { name: "Contact QR code" })).toBeVisible();
  await page.getByLabel("Full name").fill("Dr. Ada Lovelace · 世界");
  await page.getByLabel("Organization").fill("Toolbox; Research\nComputing");
  await page.getByLabel("Job title").fill("Principal, Engineer");
  await page.getByLabel("Phone").fill("+44 (20) 7946-0958");
  await page.getByLabel("Email").fill("ada@example.org");
  await page.getByLabel("Website").fill("https://example.org/ada?source=qr");
  await page.getByLabel("Address · optional").fill("10 St James's Square\nLondon");
  await expect(status(page)).toContainText("Contact QR verified", { timeout: 45_000 });
  await expect(page.getByRole("img", { name: /Contact QR code/ })).toBeVisible();
  expect(page.url()).not.toContain("ada@example.org");
  expect(page.url()).not.toContain("Lovelace");

  const png = await saveDownload(page, info, "Download PNG", "toolbox-contact-qr.png");
  expect(inspectImage(png)).toMatchObject({ kind: "png", width: 512, height: 512 });
  const svg = await saveDownload(page, info, "Download vector SVG", "toolbox-contact-qr.svg");
  const svgText = new TextDecoder().decode(svg);
  expect(svgText).toContain("<svg");
  expect(svgText).not.toContain("<script");
  expect(svgText).not.toContain("ada@example.org");
  const vcf = await saveDownload(page, info, "Download vCard (.vcf)", "toolbox-contact.vcf");
  const vcard = new TextDecoder("utf-8", { fatal: true }).decode(vcf);
  expect(vcard).toContain("VERSION:3.0\r\n");
  expect(vcard).toContain("Toolbox\\; Research\\nComputing");
  expect(parseContactVCard(vcard)).toEqual({
    fullName: "Dr. Ada Lovelace · 世界",
    organization: "Toolbox; Research\nComputing",
    jobTitle: "Principal, Engineer",
    phone: "+44 (20) 7946-0958",
    email: "ada@example.org",
    website: "https://example.org/ada?source=qr",
    address: "10 St James's Square\nLondon",
  });

  await page.getByLabel("Email").fill("not-an-email");
  await expect(page.getByRole("alert")).toContainText("valid email address");
  await expect(page.getByRole("link", { name: "Download vCard (.vcf)" })).toHaveCount(0);
  expect(requestUrls.some((url) => url.includes("ada@example.org"))).toBe(false);
  expect(uploads).toEqual([]);

  const reset = page.getByRole("button", { name: "Reset" });
  await reset.focus();
  await reset.press("Enter");
  await expect(page.getByLabel("Full name")).toHaveValue("");
  await expect(page.getByRole("img", { name: /Contact QR code/ })).toHaveCount(0);
  expect(errors).toEqual([]);
  const dimensions = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: document.documentElement.clientWidth,
  }));
  expect(dimensions.width).toBeLessThanOrEqual(dimensions.viewport);
});
