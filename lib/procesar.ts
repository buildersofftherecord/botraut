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
 *
 * El `.toColourspace("srgb")` es seguro de portabilidad, no una corrección
 * necesaria: en sharp 0.35.3 / libvips 8.18.3 (el build de este repo),
 * `.grayscale()` solo ya conserva las 4 bandas y el alpha intacto — lo
 * verificamos byte a byte, con y sin esta línea el PNG de salida es
 * idéntico. La dejamos igual porque este repo carga dos builds de libvips
 * distintos (`@vercel/og` trae el suyo) y no está garantizado que ambos se
 * comporten igual acá.
 */
export async function aBlancoYNegro(png: Buffer): Promise<Buffer> {
  return sharp(png).grayscale().toColourspace("srgb").png().toBuffer();
}

export async function ajustarAlto(png: Buffer, alto: number): Promise<Buffer> {
  return sharp(png).resize({ height: alto, fit: "inside" }).png().toBuffer();
}
