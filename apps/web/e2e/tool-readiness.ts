import { expect, type Page } from "@playwright/test";

export async function waitForToolPageReady(page: Page) {
  await expect(page.locator('[data-tool-page-ready="true"]')).toHaveCount(1);
}
