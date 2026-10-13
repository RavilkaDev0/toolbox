import { defineConfig, devices } from "@playwright/test";

const performanceSuites = [
  {
    name: "images-to-pdf",
    files: ["**/images-to-pdf.spec.ts"],
    title: "measures real conversion at three bounded input sizes",
  },
  {
    name: "merge-pdf",
    files: ["**/merge-pdf.spec.ts"],
    title: "benchmarks real input/output at three sizes",
  },
  {
    name: "rotate-pdf",
    files: ["**/rotate-pdf.spec.ts"],
    title: "measures real rotate output for three bounded image-backed PDFs",
  },
  {
    name: "split-pdf",
    files: ["**/split-pdf.spec.ts"],
    title: "measures real split output for three bounded image-backed PDFs",
  },
  {
    name: "pdf-to-png",
    files: ["**/pdf-to-png.spec.ts"],
    title: "benchmarks real PNG output for three bounded image-backed PDFs",
  },
  {
    name: "image-compressor",
    files: ["**/image-compressor.spec.ts"],
    title: "measures real image compression at three bounded input sizes",
  },
  {
    name: "image-resizer",
    files: ["**/image-resizer.spec.ts"],
    title: "measures real resize output for small, medium and large bounded inputs",
  },
  {
    name: "png-jpg-converter",
    files: ["**/png-jpg-converter.spec.ts"],
    title: "measures three real JPEG to PNG conversions",
  },
  {
    name: "webp-converter",
    files: ["**/webp-converter.spec.ts"],
    title: "measures three real JPEG to WebP conversions",
  },
] as const;

const featureSuites = [
  { name: "shell", files: ["**/design-system.spec.ts", "**/homepage.spec.ts"] },
  { name: "qr-designer", files: ["**/qr-designer.spec.ts"] },
  ...performanceSuites.filter((suite) => suite.name !== "split-pdf"),
] as const;

const browsers = [
  { name: "chromium", device: devices["Desktop Chrome"] },
  { name: "webkit", device: devices["Desktop Safari"] },
] as const;

const isolatedPerformanceProjects = performanceSuites.map((suite) => ({
  name: `chromium-${suite.name}-performance`,
  testMatch: suite.files,
  grep: new RegExp(suite.title),
  use: { ...devices["Desktop Chrome"], browserName: "chromium" as const },
}));

const splitScenarios = [
  {
    name: "split-extract",
    title: "extracts selected pages in source order and downloads verified PDF without uploads",
  },
  {
    name: "split-zip-retry",
    title: "splits selected pages to a real ZIP with safe names, then supports retry and reset",
  },
  {
    name: "split-limits",
    title: "rejects malformed and oversized documents and remains keyboard accessible on mobile",
  },
] as const;

const isolatedSplitScenarioProjects = splitScenarios.flatMap((scenario) =>
  browsers.map((browser) => ({
    name: `${browser.name}-${scenario.name}`,
    testMatch: ["**/split-pdf.spec.ts"],
    grep: new RegExp(scenario.title),
    use: { ...browser.device, browserName: browser.name },
  })),
);

const isolatedFeatureProjects = [
  ...featureSuites.flatMap((suite) =>
    browsers.map((browser) => ({
      name: `${browser.name}-${suite.name}`,
      testMatch: suite.files,
      ...(performanceSuites.some((item) => item.name === suite.name)
        ? {
            grepInvert: new RegExp(
              performanceSuites.find((item) => item.name === suite.name)?.title ?? "",
            ),
          }
        : {}),
      use: { ...browser.device, browserName: browser.name },
    })),
  ),
  ...isolatedSplitScenarioProjects,
];

const externalBaseUrl = process.env.PLAYWRIGHT_BASE_URL;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  // Each tool and performance sample gets a fresh browser process so large
  // local-PDF fixtures cannot retain worker/canvas memory across unrelated tests.
  projects: [...isolatedPerformanceProjects, ...isolatedFeatureProjects],
  webServer: externalBaseUrl
    ? undefined
    : {
        command: "pnpm dev --hostname 127.0.0.1 --port 3100",
        url: "http://127.0.0.1:3100",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: { TOOLBOX_UI_FIXTURES: "1" },
      },
});
