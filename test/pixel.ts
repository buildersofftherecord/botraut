import sharp from "sharp";

/** Devuelve el RGB de un píxel del PNG. */
export async function pixelEn(
  png: Buffer,
  x: number,
  y: number,
): Promise<[number, number, number]> {
  const { data } = await sharp(png)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return [data[0], data[1], data[2]];
}

export async function medidas(png: Buffer): Promise<{ ancho: number; alto: number }> {
  const m = await sharp(png).metadata();
  return { ancho: m.width!, alto: m.height! };
}

/**
 * ¿Hay algún píxel con canal rojo por encima de `umbral` dentro del
 * rectángulo? Una sola extracción de sharp sobre toda la región en vez de
 * `pixelEn` por cada punto: escanear una franja ancha píxel a píxel es
 * demasiado lento para un test (miles de llamadas async a sharp).
 */
export async function regionTieneClaros(
  png: Buffer,
  rect: { left: number; top: number; width: number; height: number },
  umbral = 200,
): Promise<boolean> {
  const { data, info } = await sharp(png)
    .extract(rect)
    .raw()
    .toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += info.channels) {
    if (data[i] > umbral) return true;
  }
  return false;
}
