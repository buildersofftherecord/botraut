import { describe, it, expect } from "vitest";
import { generarBinario } from "./generar-binario";
import { medidas, pixelEn } from "../../test/pixel";

describe("generarBinario", () => {
  it("devuelve un PNG de las medidas pedidas", async () => {
    const png = await generarBinario(1080, 1080, 42);
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1080 });
  });

  it("es determinista con la misma semilla", async () => {
    const [a, b] = await Promise.all([
      generarBinario(200, 200, 7),
      generarBinario(200, 200, 7),
    ]);
    expect(a.equals(b)).toBe(true);
  });

  it("es de bajo contraste: nunca supera el gris del token", async () => {
    const png = await generarBinario(200, 200, 7);
    for (let y = 0; y < 200; y += 17) {
      for (let x = 0; x < 200; x += 17) {
        const [r] = await pixelEn(png, x, y);
        expect(r).toBeLessThanOrEqual(40);
      }
    }
  });
});
