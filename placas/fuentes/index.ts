import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aca = dirname(fileURLToPath(import.meta.url));

export type Fuente = {
  name: string;
  data: Buffer;
  weight: 400;
  style: "normal";
};

/**
 * Satori necesita los bytes de la fuente, no un nombre de familia: no tiene
 * acceso a las fuentes del sistema ni a next/font. Por eso los .ttf se
 * versionan acá, con su licencia OFL al lado.
 *
 * ── Por qué Anton y no Archivo ──
 *
 * La landing usa Archivo llevada al extremo **ancho** de su eje (wdth 125), y
 * durante un tiempo la placa la heredó por consistencia. En una placa no
 * funciona, y el motivo es medible: lo único que importa cuando el nombre vive
 * en una columna de ancho fijo es cuánta altura de mayúscula te da la fuente
 * por unidad de ancho de palabra.
 *
 *   placas de referencia (medido)   0.238
 *   Anton                           0.216
 *   Archivo wdth 75                 0.136
 *   Archivo wdth 125                0.087   ← lo que usábamos
 *
 * Con Archivo 125 el nombre ocupaba 10.9% del alto de la placa contra 18.7% de
 * la referencia, y `tamanoNombre()` no podía hacer nada: achicar la fuente para
 * que la palabra más larga entrara en la columna era todo lo que quedaba. Con
 * Anton llega a 16.3% sin mover una sola medida del layout.
 *
 * Anton es además, casi con seguridad, la fuente de las placas originales: cae
 * encima de su medición y las formas coinciden. Ya estaba en el repo, en
 * `landing/production/placa/fonts/`, como display del generador de placas de
 * video.
 *
 * El costo consciente: la placa **dejó de compartir tipografía display con la
 * landing**. Es la única excepción a la regla de `tokens.ts` de que placa y
 * sitio comparten valores, y es deliberada — un cuadrado de 1080 y un viewport
 * de escritorio no son el mismo problema tipográfico. El resto de los tokens
 * (color, tracking, escala del HUD) sigue viniendo de `globals.css`.
 */
export async function cargarFuentes(): Promise<Fuente[]> {
  const [display, mono] = await Promise.all([
    readFile(join(aca, "Anton-Regular.ttf")),
    readFile(join(aca, "IBMPlexMono-Regular.ttf")),
  ]);

  return [
    { name: "Anton", data: display, weight: 400, style: "normal" },
    { name: "IBMPlexMono", data: mono, weight: 400, style: "normal" },
  ];
}
