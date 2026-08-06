import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { LOGO_COLOR } from "../tokens";

const aca = dirname(fileURLToPath(import.meta.url));

/**
 * Carga `botr-wordmark-neg.svg` y le baja el wordmark a gris.
 *
 * Se recolorea al vuelo en vez de editar el archivo porque el SVG de `marca/`
 * es el primitivo de marca tal como sale de la fuente: si alguien lo abre para
 * usarlo en otro lado tiene que encontrar el logo, no nuestra variante para
 * placas. La versión gris es una aplicación, no el logo.
 *
 * ── Por qué la versión sin placa ──
 *
 * Antes iba `botr-wordmark-placa.svg`, que trae un rect negro redondeado detrás
 * del wordmark. Tenía una función real mientras la foto del invitado llegaba
 * cortada a filo: el rect le tapaba el canto y le daba campo propio al logo.
 * Con `desvanecidoBase` en `Retrato.ts` la base se disuelve sola, así que el
 * rect dejó de tapar nada y pasó a ser una caja negra que interrumpe la trama
 * del monograma del fondo sin motivo.
 *
 * De paso las letras salen un 4% más grandes al mismo ancho declarado: el
 * viewBox de la versión con placa se lleva 17% del alto en aire alrededor del
 * rect (6435×1365 contra 6202×1132).
 *
 * Sólo cambia el blanco del wordmark. El punto rojo queda como está: es el
 * único acento de la placa.
 */
export async function cargarLogo(): Promise<Buffer> {
  const svg = await readFile(join(aca, "..", "marca", "botr-wordmark-neg.svg"), "utf8");
  return Buffer.from(svg.replaceAll('fill="#ffffff"', `fill="${LOGO_COLOR}"`), "utf8");
}
