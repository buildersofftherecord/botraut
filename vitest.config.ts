import { defineConfig } from "vitest/config";

/**
 * El JSX no se configura acá: lo toma de tsconfig.json. Vitest 4 transforma
 * con oxc, así que un bloque `esbuild` se ignora en silencio.
 *
 * Este proyecto tiene DOS runtimes de JSX conviviendo:
 *   - `chat` (el default de tsconfig) para las cards de Slack en bot.tsx
 *   - `react` para el template, porque Satori consume elementos de React
 *
 * Los archivos de `marca/` llevan `@jsxImportSource react` como pragma en la
 * primera línea. Sin eso, Satori recibe elementos del runtime del Chat SDK y
 * el render falla con un error que no dice nada.
 */
export default defineConfig({
  test: {
    environment: "node",
    // Sin esto, el historial de llamadas de un mock sobrevive de un test al
    // siguiente y la independencia entre tests queda librada al orden de
    // ejecución. Se descubrió en `recorte.test.ts`: un test pasaba por la razón
    // correcta, pero por casualidad.
    clearMocks: true,
    include: ["**/*.test.ts", "**/*.test.tsx"],
    // `placas/` es un paquete autocontenido con su propio vitest.config.ts y
    // su propio runtime de JSX (react, no chat). Corriéndolo con esta config
    // fallan sus 16 tests por el JSX. Se corre aparte: `npm run test:placas`.
    exclude: ["node_modules/**", ".next/**", "placas/**"],
  },
});
