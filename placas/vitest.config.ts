import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic", jsxImportSource: "react" },
  test: {
    include: ["pruebas/**/*.test.ts"],
    // Los tests renderizan placas de 2160² con Satori y sharp. En paralelo se
    // pelean por CPU y los timeouts se vuelven ruido.
    fileParallelism: false,
    testTimeout: 120_000,
  },
});
