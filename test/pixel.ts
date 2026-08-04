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
