import sharp from "sharp";
import { recortar } from "./recorte";
import { recortarASilueta, type Silueta } from "./silueta";
import { mirarSilueta, type Veredicto } from "./mirar";
import { LIENZOS, altoDeFoto } from "../placas/lienzos";
import type { Foto } from "./tipos";

/**
 * Filtro barato, antes de correr ningún modelo: descarta lo que evidentemente
 * no sirve sin pagar los segundos de `recortar()`. No es la validación real,
 * que mide la silueta (ver `ALTO_MINIMO_SILUETA`).
 *
 * Estaba en 800 y eso rechazaba la foto del propio diseño aprobado, que mide
 * 561×505. Un filtro previo que descarta la referencia del sistema no es un
 * filtro, es un bug.
 */
export const LADO_MINIMO = 420;

/**
 * Task 22b: ya no se mide la proporción del archivo — una foto apaisada puede
 * tener adentro una persona perfectamente vertical. Lo que importa es cuánta
 * resolución real tiene el sujeto una vez separado del fondo.
 *
 * No es el alto al que el render lleva la silueta, sino **cuánto se le puede
 * agrandar sin que se note**. Exigir el alto exacto de destino rechazaba fotos
 * que salen bien: una silueta de 982px llevada a 1269 es un aumento de 1.29×,
 * y con Lanczos eso no se ve. Rechazarla mandaba al humano a buscar otra foto
 * por nada — el mismo sobre-rechazo que motivó la Task 22b.
 *
 * El tope sale de la placa aprobada, no de una teoría: `placas/muestra/gr.png`
 * —la foto que produce `placa-actual.png`— tiene un sujeto de 436×505 y el
 * render lo lleva a 1015, o sea 2.01×. Con el 1.45× que había antes, esa misma
 * foto habría sido rechazada por el sistema que la usa como referencia.
 *
 * El grano y la curva de negros de `prepararRetrato` disimulan bastante el
 * escalado a tamaño de Instagram; el README de `placas/` lo dice explícito.
 */
const AUMENTO_MAXIMO = 2.1;
export const ALTO_MINIMO_SILUETA = Math.round(altoDeFoto(LIENZOS["1:1"]) / AUMENTO_MAXIMO);

export type ResultadoValidacion =
  | { ok: true; foto: Pick<Foto, "ancho" | "alto"> }
  | { ok: false; motivo: string };

const NO_LEGIBLE = "No pude abrir esa imagen. ¿Me la volvés a mandar como JPG o PNG?";

/** Algo en la cadena tiró un error sin `message` legible — no debería pasar. */
const NO_VALIDABLE = "No pude terminar de validar esa foto. Probá de nuevo en un rato.";

/**
 * `mirarSilueta` (Gemini) falló por su cuenta, no por la foto — mismo
 * estándar que `mensajeErrorBusqueda` en `lib/mensajes.ts` para
 * `buscarCopy`/`rehacerCopy`: se rechaza y se pide reintentar en vez de
 * aceptar a ciegas porque el chequeo no pudo correr.
 */
const FALLO_EL_MODELO =
  "No pude terminar de validar esa foto: se cayó el chequeo (Gemini, cuota o red). Probá de nuevo en un rato.";

/**
 * De los cuatro requisitos de la spec §8, esto ahora cubre los cuatro:
 *
 * 1. Medio cuerpo o cuerpo entero — lo juzga `mirarSilueta` (era "aproximado
 *    por la proporción"; Task 22b saca ese proxy, ver abajo)
 * 2. Fondo separable — lo juzga `mirarSilueta`, mirando el recorte mismo
 * 3. Mínimo de resolución — geometría, acá abajo (archivo y silueta)
 * 4. Persona identificable y bien expuesta — lo juzga `mirarSilueta`
 *
 * Antes de Task 22b los requisitos 1 y 2 se daban por perdidos ("no
 * verificable en código", spec §8) y el requisito 1 se aproximaba con la
 * proporción del archivo — que rechazaba fotos apaisadas con una persona
 * perfectamente vertical adentro, el bug que motivó esta task. La
 * proporción del archivo ya NO se mide: lo que importa es la silueta que
 * deja `recortar()` (el cutout de fondo), no la forma del archivo.
 *
 * El orden importa y es a propósito, barato-a-caro: metadata → `LADO_MINIMO`
 * → `recortar()` (carga un modelo de 155MB) → `recortarASilueta` →
 * `ALTO_MINIMO_SILUETA` → `mirarSilueta` (llamada a Gemini). Cada paso solo
 * corre si el anterior no rechazó ya la foto.
 */
export async function validarFoto(bytes: Buffer): Promise<ResultadoValidacion> {
  let ancho: number | undefined;
  let alto: number | undefined;

  try {
    ({ width: ancho, height: alto } = await sharp(bytes).metadata());
  } catch {
    return { ok: false, motivo: NO_LEGIBLE };
  }

  if (!ancho || !alto) {
    return { ok: false, motivo: NO_LEGIBLE };
  }

  if (ancho < LADO_MINIMO || alto < LADO_MINIMO) {
    return {
      ok: false,
      motivo:
        `Esa foto es de ${ancho}×${alto} y va a salir pixelada en la placa. ` +
        `Necesito al menos ${LADO_MINIMO}px de lado, idealmente 1200 o más.`,
    };
  }

  let recorte: Buffer;
  try {
    recorte = await recortar(bytes);
  } catch (e) {
    // `recortar` ya envuelve su error con un mensaje humano (ver
    // recorte.ts) — se publica tal cual, no se vuelve a traducir acá.
    console.error("recortar falló validando una foto", e);
    return { ok: false, motivo: e instanceof Error ? e.message : NO_VALIDABLE };
  }

  let silueta: Silueta;
  try {
    silueta = await recortarASilueta(recorte);
  } catch (e) {
    // Mismo criterio: `recortarASilueta` ya deja un mensaje humano (imagen
    // totalmente transparente, sin sujeto detectado).
    console.error("recortarASilueta falló validando una foto", e);
    return { ok: false, motivo: e instanceof Error ? e.message : NO_VALIDABLE };
  }

  if (silueta.alto < ALTO_MINIMO_SILUETA) {
    return {
      ok: false,
      motivo:
        `La persona en esa foto queda en ${silueta.alto}px de alto una vez separada ` +
        `del fondo, y necesito al menos ${ALTO_MINIMO_SILUETA}px para que no salga ` +
        `blanda al agrandarla. Mandame una donde ocupe más del cuadro, o de mayor resolución.`,
    };
  }

  let veredicto: Veredicto;
  try {
    veredicto = await mirarSilueta(silueta.png);
  } catch (e) {
    console.error("mirarSilueta falló validando una foto", e);
    return { ok: false, motivo: FALLO_EL_MODELO };
  }

  if (!veredicto.sirve) {
    return { ok: false, motivo: veredicto.motivo };
  }

  return { ok: true, foto: { ancho, alto } };
}

/** El texto que el bot postea cuando pide la foto por primera vez. */
export const PEDIDO_DE_FOTO =
  "Mandame una foto donde se te vea de medio cuerpo para arriba, con el fondo lo más " +
  "despejado posible. Cuanta más resolución, mejor: si la persona ocupa poco del cuadro, la silueta queda blanda al agrandarla.";
