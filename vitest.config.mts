import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL:
        process.env.TEST_DATABASE_URL ?? "postgres://postgres@localhost:5432/stockly_test",
    },
    fileParallelism: false,
    testTimeout: 20000,
  },
});
