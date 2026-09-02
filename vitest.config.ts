import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  root: resolve(import.meta.dirname),
  resolve: {
    alias: {
      "@career-os/ai": resolve(import.meta.dirname, "packages/ai/src/index.ts"),
      "@career-os/analytics": resolve(import.meta.dirname, "packages/analytics/src/index.ts"),
      "@career-os/applications": resolve(import.meta.dirname, "packages/applications/src/index.ts"),
      "@career-os/auth": resolve(import.meta.dirname, "packages/auth/src/index.ts"),
      "@career-os/career": resolve(import.meta.dirname, "packages/career/src/index.ts"),
      "@career-os/compensation": resolve(import.meta.dirname, "packages/compensation/src/index.ts"),
      "@career-os/config": resolve(import.meta.dirname, "packages/config/src/index.ts"),
      "@career-os/contracts": resolve(import.meta.dirname, "packages/contracts/src/index.ts"),
      "@career-os/database": resolve(import.meta.dirname, "packages/database/src/index.ts"),
      "@career-os/documents": resolve(import.meta.dirname, "packages/documents/src/index.ts"),
      "@career-os/interviews": resolve(import.meta.dirname, "packages/interviews/src/index.ts"),
      "@career-os/jobs": resolve(import.meta.dirname, "packages/jobs/src/index.ts"),
      "@career-os/knowledge": resolve(import.meta.dirname, "packages/knowledge/src/index.ts"),
      "@career-os/observability": resolve(
        import.meta.dirname,
        "packages/observability/src/index.ts"
      ),
      "@career-os/ui": resolve(import.meta.dirname, "packages/ui/src/index.ts")
    }
  },
  test: {
    environment: "node",
    include: ["packages/**/*.test.ts", "tests/**/*.test.ts", "apps/web/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/.next/**", "tests/e2e/**", "tests/accessibility/**"],
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"]
    }
  }
});
