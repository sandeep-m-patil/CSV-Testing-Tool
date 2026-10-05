import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    server: {
      // zod@3.25.76 ships extensionless relative imports, which strict ESM in
      // Vitest cannot resolve once node_modules is externalised.
      deps: { inline: ["zod"] },
    },
  },
});
