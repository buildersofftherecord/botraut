import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { recortarASilueta } from "./silueta";

/**
 * Lienzo transparente del tamaño pedido con un rectángulo compuesto encima.
 * `alpha` es 0–1 (la convención de `background` en sharp, ver `recorte.test.ts`).
 * Es la entrada que el brief pide generar con sharp en vez de fixtures binarios.
 */
async function lienzoConRectangulo(
  lienzo: { ancho: number; alto: number },
  rect: { left: number; top: number; width: number; height: number },
  alpha = 1,
): Promise<Buffer> {
  const parche = await sharp({
    create: { width: rect.width, height: rect.height, channels: 4, background: { r: 180, g: 120, b: 60, alpha } },
  })
    .png()
    .toBuffer();

  return sharp({
    create: { width: lienzo.ancho, height: lienzo.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: parche, left: rect.left, top: rect.top }])
    .png()
    .toBuffer();
}

async function medidas(png: Buffer) {
  const m = await sharp(png).metadata();
  return { ancho: m.width!, alto: m.height! };
}

describe("recortarASilueta", () => {
  it("recorta al bbox de un sujeto centrado con aire alrededor", async () => {
    const rect = { left: 100, top: 150, width: 200, height: 400 };
    const png = await lienzoConRectangulo({ ancho: 500, alto: 700 }, rect);

    const silueta = await recortarASilueta(png);

    expect(silueta.ancho).toBe(rect.width);
    expect(silueta.alto).toBe(rect.height);
    expect(await medidas(silueta.png)).toEqual({ ancho: rect.width, alto: rect.height });
  });

  it("recorta un sujeto pegado al borde superior izquierdo sin desplazarlo", async () => {
    const rect = { left: 0, top: 0, width: 120, height: 300 };
    const png = await lienzoConRectangulo({ ancho: 400, alto: 400 }, rect);

    const silueta = await recortarASilueta(png);

    expect(silueta).toMatchObject({ ancho: 120, alto: 300 });
  });

  it("recorta un sujeto pegado al borde inferior derecho, con el bbox exacto", async () => {
    // El caso de off-by-one que un `width - 1` en vez de `width` no detectaría
    // si el sujeto estuviera centrado: acá el borde derecho/inferior del
    // sujeto coincide con el borde del lienzo.
    const lienzo = { ancho: 300, alto: 250 };
    const rect = { left: 200, top: 150, width: 100, height: 100 };
    const png = await lienzoConRectangulo(lienzo, rect);

    const silueta = await recortarASilueta(png);

    expect(silueta.ancho).toBe(100);
    expect(silueta.alto).toBe(100);
  });

  it("cuando el sujeto ocupa todo el lienzo, el bbox es la imagen entera", async () => {
    const lienzo = { ancho: 150, alto: 220 };
    const png = await lienzoConRectangulo(lienzo, { left: 0, top: 0, width: lienzo.ancho, height: lienzo.alto });

    const silueta = await recortarASilueta(png);

    expect(silueta).toMatchObject({ ancho: lienzo.ancho, alto: lienzo.alto });
  });

  it("una imagen totalmente transparente tira un error claro, no un recorte de 0×0", async () => {
    const png = await sharp({
      create: { width: 200, height: 200, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();

    await expect(recortarASilueta(png)).rejects.toThrow(/no encontré a la persona/i);
  });

  it("ignora el halo de alpha parcial del borde: el bbox es el núcleo opaco, no el halo", async () => {
    // Simula el antialiasing real de `recortar()`: un borde de alpha bajo
    // (ruido de segmentación) más ancho que el sujeto opaco que rodea.
    const lienzo = { ancho: 400, alto: 400 };
    const halo = { left: 100, top: 100, width: 200, height: 200 };
    const nucleo = { left: 130, top: 130, width: 140, height: 140 };

    const conHalo = await sharp({
      create: { width: lienzo.ancho, height: lienzo.alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([
        {
          input: await sharp({
            create: { width: halo.width, height: halo.height, channels: 4, background: { r: 180, g: 120, b: 60, alpha: 0.05 } },
          })
            .png()
            .toBuffer(),
          left: halo.left,
          top: halo.top,
        },
        {
          input: await sharp({
            create: { width: nucleo.width, height: nucleo.height, channels: 4, background: { r: 180, g: 120, b: 60, alpha: 1 } },
          })
            .png()
            .toBuffer(),
          left: nucleo.left,
          top: nucleo.top,
        },
      ])
      .png()
      .toBuffer();

    const silueta = await recortarASilueta(conHalo);

    // Si el umbral fuera "alpha !== 0" en vez de un piso, esto daría 200×200
    // (el halo completo) en vez de 140×140 (solo el núcleo opaco).
    expect(silueta.ancho).toBe(nucleo.width);
    expect(silueta.alto).toBe(nucleo.height);
  });
});
