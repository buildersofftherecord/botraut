import sharp from "sharp";
import { validarDatos } from "../placas/datos";
import { renderizar } from "../placas/Placa";
import { prepararRetrato } from "../placas/primitivos/Retrato";
import { LIENZOS, altoDeFoto } from "../placas/lienzos";

/**
 * El único lienzo calibrado. Los otros tres existen en `placas/lienzos.ts` pero
 * sus números nunca se ajustaron — en 9:16 el invitado sale diminuto arriba a
 * la derecha. El contrato de `placas/README.md` es explícito en no exponerlos.
 */
const LIENZO = "1:1" as const;

/**
 * El supermuestreo del template. La foto se prepara al doble y `renderizar`
 * baja todo junto con Lanczos al final.
 */
const SUPERMUESTREO = 2;

/**
 * Mínimo de píxeles transparentes para creerle a una foto que viene recortada.
 *
 * `placas/` no verifica el recorte y no se da cuenta si falta: con un JPEG
 * crudo genera la placa igual, con el rectángulo visible alrededor de la
 * persona. Como el recorte es problema de quien llama, el chequeo vive acá.
 *
 * 8% es holgado a propósito. Un retrato recortado de verdad deja bastante más
 * —el aire alrededor de la silueta— y lo que se busca es descartar el caso
 * evidente (un JPEG sin canal alfa, o un PNG opaco), no calificar la calidad
 * del recorte.
 */
const TRANSPARENCIA_MINIMA = 0.08;

export type ResultadoPlaca =
  | { ok: true; png: Buffer }
  | { ok: false; motivo: string };

const SIN_RECORTAR =
  "Esa foto no está recortada: todavía tiene el fondo. Necesito un PNG con el " +
  "fondo transparente, si no la placa sale con el rectángulo de la foto a la vista.";

const NO_LEGIBLE =
  "No pude abrir esa imagen. ¿Me la pasás como PNG?";

/**
 * ¿Tiene fondo transparente de verdad?
 *
 * Se mira el canal alfa y no el formato: un PNG puede venir perfectamente opaco
 * y sería igual de inútil que un JPEG.
 */
async function vieneRecortada(foto: Buffer): Promise<boolean> {
  const metadatos = await sharp(foto).metadata();
  if (!metadatos.hasAlpha) return false;

  const { data, info } = await sharp(foto).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let transparentes = 0;
  let total = 0;
  for (let i = info.channels - 1; i < data.length; i += info.channels) {
    total++;
    if (data[i] < 20) transparentes++;
  }
  return transparentes / total >= TRANSPARENCIA_MINIMA;
}

/**
 * Datos + foto recortada → PNG de 1080×1080.
 *
 * Nunca tira: todo lo que puede salir mal vuelve como `motivo`, un texto que el
 * agente le puede mostrar a una persona tal cual. Un stack trace en un canal de
 * Slack no le sirve a nadie.
 */
export async function armarPlaca(
  datosCrudos: unknown,
  foto: Buffer,
  opciones: { escalaSujeto?: number } = {},
): Promise<ResultadoPlaca> {
  let datos;
  try {
    // `validarDatos` junta todos los problemas en un mensaje pensado para
    // leerse, no para depurarse. Se publica tal cual.
    datos = validarDatos(datosCrudos);
  } catch (e) {
    return { ok: false, motivo: e instanceof Error ? e.message : "Los datos de la placa no son válidos." };
  }

  let recortada: boolean;
  try {
    recortada = await vieneRecortada(foto);
  } catch (e) {
    console.error("no se pudo leer la foto", e);
    return { ok: false, motivo: NO_LEGIBLE };
  }
  if (!recortada) return { ok: false, motivo: SIN_RECORTAR };

  try {
    const l = LIENZOS[LIENZO];
    const retrato = await prepararRetrato(foto, {
      ancho: Math.round(l.ancho * l.fotoAncho * SUPERMUESTREO),
      alto: altoDeFoto(l) * SUPERMUESTREO,
      ...(opciones.escalaSujeto !== undefined ? { escalaSujeto: opciones.escalaSujeto } : {}),
    });
    return { ok: true, png: await renderizar(datos, LIENZO, retrato) };
  } catch (e) {
    // Acá se corta cualquier texto técnico: lo que devuelve esta función lo
    // repite el agente en el canal.
    console.error("falló el render de la placa", e);
    return {
      ok: false,
      motivo: "No pude armar la placa con esa foto. Probá con otra.",
    };
  }
}
