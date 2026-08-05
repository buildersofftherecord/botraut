import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { generarBinario } from "./generar-binario";
import { medidas, pixelEn } from "../../test/pixel";

describe("generarBinario", () => {
  it("devuelve un PNG de las medidas pedidas", async () => {
    const png = await generarBinario(1080, 1080, 42);
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1080 });
  });

  it("genera una textura del alto del lienzo pedido, sin estirar", async () => {
    const png = await generarBinario(1080, 1350, 2026);
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1350 });
  });

  it("mantiene la misma densidad de dígitos por área en distintos lienzos", async () => {
    // Si la textura se estirara, la densidad por área cambiaría. Se compara
    // cuántos píxeles no-negros hay por cada 100.000 píxeles de lienzo.
    const densidad = async (a: number, b: number) => {
      const { data } = await sharp(await generarBinario(a, b, 2026))
        .greyscale().raw().toBuffer({ resolveWithObject: true });
      let claros = 0;
      for (const v of data) if (v > 0) claros++;
      return (claros / (a * b)) * 100_000;
    };
    const cuadrado = await densidad(1080, 1080);
    const vertical = await densidad(1080, 1350);
    expect(Math.abs(cuadrado - vertical) / cuadrado).toBeLessThan(0.1);
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
