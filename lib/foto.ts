import sharp from "sharp";
import type { Foto } from "./tipos";

/** Debajo de esto no hay silueta de medio cuerpo para llevar al borde inferior. */
const PROPORCION_MAXIMA = 1.1;
const LADO_MINIMO = 800;

export type ResultadoValidacion =
  | { ok: true; foto: Pick<Foto, "ancho" | "alto"> }
  | { ok: false; motivo: string };

const NO_LEGIBLE = "No pude abrir esa imagen. ¿Me la volvés a mandar como JPG o PNG?";

/**
 * De los cuatro requisitos de la spec §8, esto verifica uno y aproxima otro:
 * las medidas, y la proporción como proxy de "medio cuerpo". Que el fondo se
 * recorte limpio y que la persona esté bien expuesta no los puede juzgar
 * ningún filtro — los juzga el humano al elegir qué subir.
 *
 * Por eso `motivo` está escrito para leerse en Slack: es lo único que el
 * sistema puede decir sobre por qué una foto no sirve. Nunca es el error
 * crudo de `sharp` — eso describe un buffer, no le sirve a una persona.
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

  if (ancho / alto > PROPORCION_MAXIMA) {
    return {
      ok: false,
      motivo:
        `Esa foto es apaisada (${ancho}×${alto}) y la placa necesita una silueta ` +
        `vertical que llegue hasta el borde de abajo. Mandame una de medio cuerpo ` +
        `o cuerpo entero, más alta que ancha.`,
    };
  }

  return { ok: true, foto: { ancho, alto } };
}

/** El texto que el bot postea cuando pide la foto por primera vez. */
export const PEDIDO_DE_FOTO =
  "Mandame una foto de medio cuerpo o cuerpo entero, fondo lo más despejado " +
  "posible, de 800px de lado o más — así no sale pixelada ni cortada en la placa.";
