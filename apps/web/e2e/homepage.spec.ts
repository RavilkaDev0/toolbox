import { expect, test } from "@playwright/test";

test("homepage has accessible landmarks and a keyboard-accessible skip link", async ({
  page,
}, testInfo) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);

  const skipLink = page.getByRole("link", { name: "Skip to main content" });
  await page.keyboard.press("Tab");
  await expect(skipLink).toBeFocused();

  await expect(page.getByRole("banner")).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Main navigation" })).toBeVisible();
  await expect(page.getByRole("main")).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 1, name: "Useful tools, with privacy at the center" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "Browse available tools" })).toHaveAttribute(
    "href",
    "/tools",
  );
  await expect(page.getByText("No tools have been published yet")).toBeVisible();

  await page.keyboard.press("Enter");
  await expect(page.getByRole("main")).toBeFocused();
  await expect(page).toHaveURL(/\/#main-content$/);

  await page.screenshot({ path: testInfo.outputPath("homepage.png"), fullPage: true });
});
