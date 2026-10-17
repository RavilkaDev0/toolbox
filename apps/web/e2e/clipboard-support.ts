import type { Page } from "@playwright/test";

export async function prepareClipboard(page: Page): Promise<void> {
  const browserName = page.context().browser()?.browserType().name();
  if (browserName === "webkit") {
    await page.evaluate(() => {
      let copiedText = "";
      Object.defineProperty(navigator, "clipboard", {
        configurable: true,
        value: {
          readText: async () => copiedText,
          writeText: async (value: string) => {
            copiedText = value.replace(/\r\n|\r|\n/g, "\r\n");
          },
        },
      });
    });
    return;
  }

  await page.context().grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: new URL(page.url()).origin,
  });
}
