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

/** Cómo queda maquetado el nombre: en qué líneas se parte y a qué cuerpo. */
export type NombreMaquetado = {
  /** Una entrada por línea, ya partida por palabras. */
  lineas: string[];
  /** Cuerpo en px, el mayor que hace entrar la línea más ancha. */
  tamano: number;
};

/**
 * El cuerpo más grande al que `lineas` entra en `anchoDisponible`, sin pasar
 * el techo. Mide con la fuente real (el `hmtx` de Anton), no con un promedio
 * de ancho por carácter: ese promedio no distingue una M de una I ni una Ñ de
 * una N, y así se escapó el bug original con "José María Muñoz".
 */
async function cuerpoQueEntra(
  lineas: string[],
  anchoDisponible: number,
  tamanoMax: number,
): Promise<number> {
  const anchosPorPunto = await Promise.all(lineas.map((linea) => anchoTexto(linea, 1)));
  const masAncha = Math.max(...anchosPorPunto);
  return Math.min(tamanoMax, Math.floor(anchoDisponible / masAncha));
}

/**
 * Parte el nombre en dos líneas por el corte que deja las dos más parejas.
 *
 * Parejas por **ancho en píxeles**, no por cantidad de palabras ni de letras:
 * lo que decide el cuerpo final es la línea más ancha, así que el mejor corte
 * es el que minimiza ese máximo.
 */
async function partirEnDos(palabras: string[]): Promise<string[] | undefined> {
  if (palabras.length < 2) return undefined;

  let mejor: string[] | undefined;
  let mejorMaximo = Infinity;
  for (let i = 1; i < palabras.length; i++) {
    const arriba = palabras.slice(0, i).join(" ");
    const abajo = palabras.slice(i).join(" ");
    const maximo = Math.max(await anchoTexto(arriba, 1), await anchoTexto(abajo, 1));
    if (maximo < mejorMaximo) {
      mejorMaximo = maximo;
      mejor = [arriba, abajo];
    }
  }
  return mejor;
}

/**
 * Cómo maquetar el nombre del invitado.
 *
 * **Una línea es el diseño.** La placa de referencia pone "GUILLERMO RAUCH"
 * entero de lado a lado, y esa horizontal larga es la que sostiene el pie de
 * la placa. Partirlo en dos cuando entra en una es romper el diseño.
 *
 * Se parte en dos sólo cuando una línea caería por debajo de `tamanoMinimo`,
 * y el motivo no es legibilidad —a 83px se lee perfecto— sino **forma**: un
 * nombre de 24 caracteres estirado sobre los 824px queda como una cinta fina
 * y deja de leerse como titular.
 *
 * Un nombre de una sola palabra nunca se parte: no hay dónde. Si no entra,
 * entra chico, que es la única salida honesta.
 *
 * Medido sobre los 824px del 1:1 con `tamanoMinimo` 100:
 *
 *   GUILLERMO RAUCH          124 → una línea
 *   FRANCISCO VEIRAS         125 → una línea
 *   MARIA JOSE GONZALEZ      101 → una línea, justo
 *   JUAN CRUZ FERNANDEZ RUIZ  83 → dos líneas, a 101
 */
export async function maquetarNombre(
  nombre: string,
  anchoDisponible: number,
  tamanoMax: number,
  tamanoMinimo: number,
): Promise<NombreMaquetado> {
  const enUnaLinea = [nombre];
  const tamanoUnaLinea = await cuerpoQueEntra(enUnaLinea, anchoDisponible, tamanoMax);
  if (tamanoUnaLinea >= tamanoMinimo) return { lineas: enUnaLinea, tamano: tamanoUnaLinea };

  const partido = await partirEnDos(nombre.split(" ").filter(Boolean));
  if (!partido) return { lineas: enUnaLinea, tamano: tamanoUnaLinea };

  const tamanoPartido = await cuerpoQueEntra(partido, anchoDisponible, tamanoMax);

  // Sólo si partir realmente mejora. Con dos palabras muy desparejas
  // —"JUAN BAUTISTAAAAA X"— la línea larga manda igual y el corte no compra
  // nada, salvo una línea suelta de una palabra.
  return tamanoPartido > tamanoUnaLinea
    ? { lineas: partido, tamano: tamanoPartido }
    : { lineas: enUnaLinea, tamano: tamanoUnaLinea };
}
