import { defineConfig } from "vitest/config";

export default defineConfig({
  // `__VERSION__` is an esbuild `define` in build.js; mirror it here so src/ui.js
  // can be imported and exercised unbundled.
  define: { __VERSION__: '"0.0.0-test"' },
  test: {
    environment: "jsdom",
    globals: true,
  },
});
