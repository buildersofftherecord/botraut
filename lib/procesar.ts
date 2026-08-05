import sharp from "sharp";

/** 15 MB: una foto de prensa razonable nunca los pasa. */
const MAXIMO_BYTES = 15_000_000;

export async function descargar(url: string): Promise<Buffer> {
  const r = await fetch(url);
  if (!r.ok) throw new Error(`descarga: HTTP ${r.status} en ${url}`);

  // Corta antes de bajar el cuerpo si el header lo declara — pero el header
  // es opcional (chunked, algunos CDNs), así que un cuerpo gigante sin
  // content-length se colaría sin este segundo chequeo sobre los bytes ya
  // descargados.
  const declarado = Number(r.headers.get("content-length") ?? 0);
  if (declarado > MAXIMO_BYTES) throw new Error(`descarga: ${declarado} bytes es demasiado`);

  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAXIMO_BYTES) throw new Error(`descarga: ${bytes.length} bytes es demasiado`);

  return bytes;
}

/**
 * Satori no soporta `filter: grayscale()`, así que el B/N se hace acá.
 * `.grayscale()` solo no alcanza: colapsa a un canal y perdemos el alpha del
 * recorte, por eso el `.toColourspace("srgb")` después.
 */
export async function aBlancoYNegro(png: Buffer): Promise<Buffer> {
  return sharp(png).grayscale().toColourspace("srgb").png().toBuffer();
}

export async function ajustarAlto(png: Buffer, alto: number): Promise<Buffer> {
  return sharp(png).resize({ height: alto, fit: "inside" }).png().toBuffer();
}
