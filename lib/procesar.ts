import sharp from "sharp";

/** 15 MB: una foto de prensa razonable nunca los pasa. */
const MAXIMO_BYTES = 15_000_000;

/**
 * `headers` existe por las URLs de archivo de Slack: son privadas, y sin
 * `Authorization: Bearer $SLACK_BOT_TOKEN` Slack responde **200 con el HTML
 * de la página de login**, no un 401. Sin el chequeo de `content-type` de
 * abajo, esa respuesta pasaría como si fueran los bytes de la foto y el
 * error recién aparecería tres pasos después, adentro de `sharp`, con un
 * mensaje que no señala la causa real.
 */
export async function descargar(url: string, headers?: HeadersInit): Promise<Buffer> {
  const r = headers ? await fetch(url, { headers }) : await fetch(url);
  if (!r.ok) throw new Error(`descarga: HTTP ${r.status} en ${url}`);

  const tipo = r.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) {
    throw new Error(
      `descarga: la respuesta de ${url} no es una imagen (content-type "${tipo || "vacío"}") — ` +
        `probablemente falta o venció la autenticación`,
    );
  }

  // Corta antes de bajar el cuerpo si el header lo declara — pero el header
  // es opcional (chunked, algunos CDNs), así que un cuerpo gigante sin
  // content-length se colaría sin este segundo chequeo sobre los bytes ya
  // descargados.
  const declarado = Number(r.headers.get("content-length") ?? 0);
  if (declarado > MAXIMO_BYTES) throw new Error(`descarga: ${declarado} bytes es demasiado`);

  const bytes = Buffer.from(await r.arrayBuffer());
  if (bytes.length > MAXIMO_BYTES) throw new Error(`descarga: ${bytes.length} bytes es demasiado`);

  // El `content-type` lo declara el servidor y puede mentir; los bytes no. Se
  // mira el arranque real del cuerpo porque el caso que importa —la página de
  // login de Slack— es HTML, y así el chequeo no depende de un header.
  if (pareceHtml(bytes)) {
    throw new Error(
      `descarga: ${url} devolvió HTML en vez de una imagen — ` +
        `probablemente falta o venció la autenticación`,
    );
  }

  return bytes;
}

/**
 * Los formatos de imagen que aceptamos son binarios y ninguno arranca con
 * `<`. Alcanza con mirar el primer carácter no blanco.
 */
function pareceHtml(bytes: Buffer): boolean {
  return bytes.subarray(0, 64).toString("latin1").trimStart().startsWith("<");
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
