import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/**/*.test.ts", "apps/api/test/**/*.spec.ts", "apps/web/**/*.test.ts"],
    environment: "node",
    coverage: {
      enabled: false,
    },
  },
});
