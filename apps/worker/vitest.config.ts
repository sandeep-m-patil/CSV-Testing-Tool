import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // zod@3.25.76 ships `index.js` with extensionless relative imports
    // (`./v3/external`). Bundlers and tsx resolve those, but Vitest externalizes
    // node_modules by default and strict ESM does not. Inlining makes Vite
    // transform zod so the extensionless specifier resolves.
    server: { deps: { inline: ["zod"] } },
  },
});