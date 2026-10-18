import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mirrors the `@/*` path alias in tsconfig.json so tests can import app modules.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    // zod@3.25.76 ships `index.js` with extensionless relative imports that
    // strict ESM cannot resolve when Vitest externalizes it; inlining lets Vite
    // transform it (same workaround as apps/worker/vitest.config.ts).
    server: { deps: { inline: ["zod"] } },
    // Playwright UI tests live in e2e/ and run with `pnpm e2e`, not Vitest.
    exclude: ["e2e/**", "node_modules/**", ".next/**"],
  },
});
