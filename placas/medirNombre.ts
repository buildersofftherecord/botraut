import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parse, type Font } from "@shuding/opentype.js";

const aca = dirname(fileURLToPath(import.meta.url));

/**
 * El mismo `-0.01em` que lleva el div del nombre en Placa.tsx. Vive acá
 * también porque medir el ancho tiene que aplicar el mismo letterSpacing
 * que Satori usa al dibujar — si no, la medición no coincide con el render.
 */
export const NOMBRE_LETTER_SPACING_EM = -0.01;

let fontePromise: Promise<Font> | undefined;

/**
 * Parsea Anton-Regular.ttf con `@shuding/opentype.js`: la misma librería
 * que Satori usa por debajo para medir texto (es una dependencia transitiva
 * suya vía `satori`, acá declarada directa). Esto lee el `hmtx` real de la
 * fuente — el ancho de cada glyph, incluidos acentos y eñes — en vez de
 * asumir un ancho medio por caracter. Se cachea: parsear el .ttf tiene
 * costo y `renderizar()` puede llamarse muchas veces en el mismo proceso.
 */
function cargarFontDisplay(): Promise<Font> {
  if (!fontePromise) {
    fontePromise = readFile(join(aca, "fuentes/Anton-Regular.ttf")).then((buf) => {
      const arrayBuffer = buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
      return parse(arrayBuffer);
    });
  }
  return fontePromise;
}

/**
 * Ancho real, en píxeles, que ocupa `texto` en Anton a `fontSize`, en
 * mayúsculas (el template aplica `textTransform: uppercase`) y con el
 * letterSpacing del bloque de nombre. Es el mismo cálculo que hace Satori
 * al dibujar (`font.getAdvanceWidth(texto, fontSize, { letterSpacing })`),
 * no una aproximación.
 */
export async function anchoTexto(texto: string, fontSize: number): Promise<number> {
  const font = await cargarFontDisplay();
  return font.getAdvanceWidth(texto.toUpperCase(), fontSize, {
    letterSpacing: NOMBRE_LETTER_SPACING_EM,
  });
}

/**
 * Satori no corta una palabra a mitad de línea: si la palabra más larga del
 * nombre no entra en el ancho disponible al tamaño de diseño, sigue de
 * largo más allá del contenedor en vez de ajustarse (así se descubrió el
 * bug original con "Guillermo Rauch" y, después, con nombres acentuados
 * como "José María Muñoz" — un promedio de ancho de glyph por caracter no
 * distingue una M de una I, ni una Ñ de una N). Por eso el tamaño real es
 * dinámico: el más grande que hace entrar, medida con la fuente real, la
 * palabra *más ancha en píxeles* del nombre (no la de más caracteres), sin
 * superar el techo de diseño `tamanoMax`.
 */
export async function tamanoNombre(
  nombre: string,
  anchoDisponible: number,
  tamanoMax: number,
): Promise<number> {
  const anchosPorPunto = await Promise.all(
    nombre.split(" ").map((palabra) => anchoTexto(palabra, 1)),
  );
  const anchoPorPuntoMasAncho = Math.max(...anchosPorPunto);
  const maximoQueEntra = anchoDisponible / anchoPorPuntoMasAncho;
  return Math.min(tamanoMax, Math.floor(maximoQueEntra));
}
