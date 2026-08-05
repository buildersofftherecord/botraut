import { descargar, aBlancoYNegro, ajustarAlto } from "./procesar";
import { recortar } from "./recorte";
import { recortarASilueta } from "./silueta";
import { renderizar } from "../marca/Placa";
import { LIENZOS } from "../marca/lienzos";
import type { DatosPlaca } from "./tipos";

/**
 * El orden importa: recortar primero, porque el modelo de segmentación usa
 * el color para separar figura de fondo y sobre una imagen ya en gris pierde
 * señal. El recorte a silueta (Task 22b) va inmediatamente después, todavía
 * con el alpha intacto: es el bbox de la persona el que define cuánto vale
 * la pena procesar, así que el B/N y el resize corren sobre ese recorte más
 * chico en vez de sobre los márgenes vacíos que `recortarASilueta` descarta.
 * El resize va último para no gastar cómputo en píxeles que se tiran.
 *
 * `almacenar.ts` (Task 19, Vercel Blob) todavía no existe y su credencial no
 * está configurada — ver docs/decisiones o el brief de esta task. Esta
 * versión no persiste nada: devuelve solo el PNG. El guardado de las tres
 * etapas (original / recortada / placa) que describe el brief queda para
 * cuando Task 19 exista; el punto de enganche es este mismo `await` a
 * `renderizar`, no hace falta tocar el orden del pipeline para agregarlo.
 */
export async function generarPlaca(datos: DatosPlaca): Promise<{ png: Buffer }> {
  const original = await descargar(datos.fotoElegida.url);
  const recortada = await recortar(original);
  const silueta = await recortarASilueta(recortada);
  const gris = await aBlancoYNegro(silueta.png);
  const foto = await ajustarAlto(gris, Math.round(LIENZOS["4:5"].alto * 0.94));

  const png = await renderizar(datos, "4:5", foto);

  return { png };
}
