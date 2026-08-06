import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { COLOR, FONDO } from "../tokens";

const aca = dirname(fileURLToPath(import.meta.url));

/**
 * El fondo de la placa: monograma tileado sobre degradado, con grano y viñeta.
 *
 * Devuelve un PNG en vez de JSX porque Satori no soporta `<pattern>`, `<mask>`
 * ni `feTurbulence`. Todo lo que sea filtro o trama tiene que resolverse con
 * sharp antes de entrar al render.
 *
 * Recibe `ancho`/`alto` ya multiplicados por el supermuestreo, y todo lo que
 * dibuja es relativo a ellos: el monograma se dimensiona por `columnas` y el
 * resto son degradados y filtros. Por eso no necesita el factor de escala.
 *
 * **Si agregás una trama de líneas acá, sí lo vas a necesitar.** La placa se
 * dibuja al doble de resolución y baja a 1080 con Lanczos: un trazo de 1px
 * dibujado al doble termina siendo medio píxel y el filtro lo promedia hasta
 * borrarlo. La primera versión de este fondo llevaba scanlines y salía en
 * blanco por eso. El período y el grosor tienen que multiplicarse por el mismo
 * factor que usa `Placa.tsx`.
 */
export async function generarFondo(ancho: number, alto: number): Promise<Buffer> {
  const svgMonograma = await readFile(join(aca, "..", "marca", FONDO.monograma));
  const lado = Math.round(ancho / FONDO.columnas);

  const patron = `<pattern id="mono" width="${lado}" height="${lado}" patternUnits="userSpaceOnUse">
    <image href="data:image/svg+xml;base64,${svgMonograma.toString("base64")}"
           x="0" y="0" width="${lado}" height="${lado}" opacity="${FONDO.opacidad}"/>
  </pattern>`;

  // La franja que atenúa la trama sobre la columna del nombre. `#333` en vez de
  // negro pleno: no la apaga del todo, la baja a un quinto.
  const mascara = FONDO.atenuarNombre
    ? `<linearGradient id="franja" x1="0" x2="1">
         <stop offset="0.06" stop-color="#333"/><stop offset="0.42" stop-color="#fff"/>
       </linearGradient>
       <mask id="atenuar"><rect width="100%" height="100%" fill="url(#franja)"/></mask>`
    : "";

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <defs>
      ${patron}
      ${mascara}
      <linearGradient id="base" x1="0" y1="0" x2="0.8" y2="1">
        <stop offset="0" stop-color="${COLOR.negro}"/>
        <stop offset="1" stop-color="${COLOR.carbon}"/>
      </linearGradient>
      <filter id="grano">
        <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" stitchTiles="stitch" seed="7"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <radialGradient id="vin" cx="0.5" cy="0.45" r="0.75">
        <stop offset="0.55" stop-color="#000" stop-opacity="0"/>
        <stop offset="1" stop-color="#000" stop-opacity="${FONDO.vineta}"/>
      </radialGradient>
    </defs>
    <rect width="100%" height="100%" fill="${COLOR.negro}"/>
    <rect width="100%" height="100%" fill="url(#base)"/>
    <rect width="100%" height="100%" fill="url(#mono)"${FONDO.atenuarNombre ? ' mask="url(#atenuar)"' : ""}/>
    <rect width="100%" height="100%" filter="url(#grano)" opacity="${FONDO.grano}"/>
    <rect width="100%" height="100%" fill="url(#vin)"/>
  </svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
