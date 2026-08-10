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

/**
 * Cuánto de la base del invitado se disuelve en el negro.
 *
 * `prepararRetrato` usa 0.28 por defecto, y existe porque el wordmark es más
 * chico que la bandera de tela de las placas originales: sin degradado, el
 * invitado queda cortado a filo contra el borde inferior.
 *
 * A 0.28 se come los brazos. Se bajó a 0.12 mirando el resultado — alcanza para
 * que el corte no se note y deja ver la mitad de abajo del invitado, que es
 * donde suele estar la postura.
 */
const DESVANECIDO_BASE = 0.12;

/**
 * Cuánto ocupa el invitado, por encima del 1.15 que trae `prepararRetrato`.
 *
 * Ese default está calibrado para un plano de busto y deja al invitado un poco
 * chico contra el peso del nombre. 1.3 le da presencia sin convertirlo en un
 * primer plano: llevarlo a llenar el alto del cuadro se probó y sale una cabeza
 * gigante.
 *
 * Sigue siendo un default, no una regla. El encuadre de cada foto es distinto y
 * el agente puede subirlo o bajarlo si el humano se lo pide.
 *
 * Se intentó calcularlo dos veces y las dos salieron peor:
 *
 * - Escalando para que la silueta llene el alto del cuadro: el número
 *   coincidía con la referencia pero salía una cabeza gigante, porque el alto
 *   ocupado no es lo mismo que el encuadre.
 * - Normalizando por el ancho de la cabeza, para compensar cuánto cuerpo hay
 *   en cuadro: la medida agarra el pelo, que en un peinado angosto infla la
 *   escala y termina cortando la cabeza.
 *
 * 1.3 fijo funciona en las dos fotos de prueba, con encuadres distintos. Si
 * alguna vez falla, el camino no es un tercer heurístico sino que el agente lo
 * ajuste, que es lo que ya puede hacer.
 */
const ESCALA_SUJETO = 1.3;

/**
 * Curva de tonos del invitado. `prepararRetrato` usa 1.35 por defecto.
 *
 * A 1.35 el torso quedaba en luminancia ~7 sobre un fondo de ~9: la persona era
 * **más oscura que lo que la rodea**, así que no tenía silueta ni hombros y se
 * leía como una cabeza flotando, pegada encima del fondo en vez de integrada.
 *
 * A 1.8 el cuerpo aparece: se ven los hombros, la ropa y los brazos, y el
 * invitado se apoya en la placa.
 *
 * Bajar el fondo en vez de levantar al invitado se probó primero y no alcanza:
 * el piso no lo pone el mosaico sino el degradado de base del lienzo, así que
 * atenuar la trama detrás del sujeto movió la luminancia 0.4 y nada más.
 */
const GAMMA_SUJETO = 1.8;

/**
 * Cuánto se baja el invitado dentro de su cuadro, en fracción del alto.
 *
 * `prepararRetrato` lo ancla arriba con `top: 0` y no expone offset. Lo hace a
 * propósito y está documentado: anclado al piso, la cara arrancaba al 27% del
 * alto contra el 12-17% de las cinco placas originales, y el invitado quedaba
 * colgando.
 *
 * El 6% despega la cabeza del borde superior sin volver a ese problema. Se
 * eligió comparando renders (0%, 3%, 6% y 10%), no por teoría.
 *
 * Lo que se va por abajo se recorta, pero ahí está el degradado de la base, así
 * que no aparece un corte duro.
 */
const BAJAR_INVITADO = 0.06;

/** Desplaza el retrato hacia abajo dentro de su cuadro, sin cambiarle el tamaño. */
async function bajarEnElCuadro(retrato: Buffer, ancho: number, alto: number): Promise<Buffer> {
  const bajar = Math.round(alto * BAJAR_INVITADO);
  if (bajar <= 0) return retrato;

  const recortado = await sharp(retrato)
    .extract({ left: 0, top: 0, width: ancho, height: alto - bajar })
    .png()
    .toBuffer();

  return sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: recortado, left: 0, top: bajar }])
    .png()
    .toBuffer();
}

/**
 * Le saca a la foto la definición que ya tiene, antes de que el pipeline la
 * agrande.
 *
 * **No agrega detalle.** Lo que hace un modelo de superresolución —inventar
 * textura plausible que no está en el original— es otra cosa y necesita o un
 * modelo local de ~100MB o una API paga. Esto es lo que se puede hacer gratis
 * y determinista.
 *
 * El orden importa y se eligió comparando renders:
 *
 * 1. Duplicar primero. Le da al realce el doble de píxeles con que trabajar; a
 *    tamaño original el efecto es mucho más pobre.
 * 2. `clahe` — contraste local por baldosas. Es lo que hace que se lea la
 *    textura de la ropa y las facciones, y buena parte de lo que se percibe
 *    como "HD".
 * 3. Afilar al final, sobre la imagen ya realzada.
 *
 * Va sobre la foto recortada y nunca sobre la placa, para no tocar la
 * tipografía ni el fondo.
 */
async function realzar(foto: Buffer): Promise<Buffer> {
  const { width } = await sharp(foto).metadata();
  if (!width) return foto;

  const doble = await sharp(foto)
    .resize({ width: width * 2, kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();

  return sharp(doble)
    .clahe({ width: 96, height: 96, maxSlope: 3 })
    .sharpen({ sigma: 1.2, m1: 0.5, m2: 2 })
    .png()
    .toBuffer();
}

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
    const ancho = Math.round(l.ancho * l.fotoAncho * SUPERMUESTREO);
    const alto = altoDeFoto(l) * SUPERMUESTREO;
    const afilada = await realzar(foto);

    const retrato = await prepararRetrato(afilada, {
      ancho,
      alto,
      // Sin default propio: el 1.15 de `prepararRetrato` está calibrado para
      // un plano de busto y funciona para la mayoría. Calcular la escala para
      // que la silueta llene el alto se probó y da peor: el número coincide
      // con la referencia pero el resultado es una cabeza gigante, porque el
      // alto ocupado no es lo mismo que el encuadre. El README de `placas/`
      // ya lo decía; esto lo confirma.
      desvanecidoBase: DESVANECIDO_BASE,
      gamma: GAMMA_SUJETO,
      escalaSujeto: opciones.escalaSujeto ?? ESCALA_SUJETO,
    });
    return { ok: true, png: await renderizar(datos, LIENZO, await bajarEnElCuadro(retrato, ancho, alto)) };
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
