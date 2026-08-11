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

  // Medido sobre las cinco placas reales: el tercio izquierdo, donde va el
  // nombre, es negro limpio (0% de cobertura entre el 12% y el 37% del ancho).
  // La trama es una franja ubicada detrás de la foto, no un fondo parejo — una
  // pareja compite con la tipografía por más que la densidad total coincida.
  it("deja limpio el tercio izquierdo, donde va el nombre", async () => {
    const png = await generarBinario(1080, 1080, 7);
    const { data, info } = await sharp(png)
      .extract({ left: 130, top: 0, width: 270, height: 1080 })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const encendidos = data.filter((v) => v > 25).length;
    expect(encendidos / (info.width * info.height)).toBeLessThan(0.005);
  });

  // Y del otro lado sí tiene que haber trama, si no esto pasaría con un PNG
  // completamente negro.
  it("tiene trama en la franja de la derecha", async () => {
    const png = await generarBinario(1080, 1080, 7);
    const { data, info } = await sharp(png)
      .extract({ left: 660, top: 0, width: 270, height: 1080 })
      .greyscale()
      .raw()
      .toBuffer({ resolveWithObject: true });
    const encendidos = data.filter((v) => v > 25).length;
    expect(encendidos / (info.width * info.height)).toBeGreaterThan(0.02);
  });
});
