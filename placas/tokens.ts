/**
 * Portados de `landing/app/globals.css`. Que la placa y el sitio compartan
 * estos valores es lo que los hace un sistema y no dos cosas parecidas.
 * No se re-derivan a ojo desde una imagen.
 */
export const COLOR = {
  negro: "#000000",
  carbon: "#0a0a0a",
  gris: "#141414",
  blanco: "#ffffff",
  rojo: "#ff2b2b",
  rojoHondo: "#c81a1a",
  linea: "rgba(255,255,255,0.1)",
  lineaViva: "rgba(255,255,255,0.24)",
  t75: "rgba(255,255,255,0.75)",
  t55: "rgba(255,255,255,0.55)",
  t35: "rgba(255,255,255,0.35)",
} as const;

/**
 * El nombre **no va en blanco puro**. Medido sobre las placas de referencia,
 * el interior de los trazos da p50=163, p75=168, p90=176 — un gris, no
 * `#ffffff`. La primera versión daba 251 de media y por eso se veía dura
 * contra el negro.
 *
 * Este valor sí se deriva de la imagen, a diferencia del resto de `COLOR`:
 * es una decisión del diseño de la placa, no un token del sistema que
 * compartimos con `landing/`.
 */
export const NOMBRE_COLOR = "#a5a5a5";

/**
 * El wordmark de abajo a la derecha va **al mismo gris que el nombre**, no en
 * blanco.
 *
 * No es una preferencia: medido sobre las placas de referencia, la tinta clara
 * de la bandera da p50 148 / 174 / 172 en Veiras, Naomi y Ariana — mediana ~165,
 * que es exactamente `NOMBRE_COLOR`. En las originales el nombre y la bandera
 * están en el mismo valor, y la jerarquía entre ellos la lleva el **tamaño**,
 * no el brillo. Lo único blanco puro es el texto chico del HUD, que por chico
 * no pesa.
 *
 * En blanco (255) el logo era lo más contrastado de la placa: el elemento menos
 * importante ganaba la primera mirada.
 */
export const LOGO_COLOR = NOMBRE_COLOR;

/**
 * De `.hud-label` en globals.css, más `--fs-hud` y `--tr-hud`.
 *
 * `labelTamano` es la excepción: el `11` de la landing se portó tal cual y en
 * una imagen de 1080px queda tímido. Medido sobre la referencia, sus etiquetas
 * ocupan 1.34% del ancho por carácter y las nuestras 0.74% — o sea que todo el
 * texto chico de la placa estaba a la mitad de tamaño, y con él se achicaba la
 * caja de datos, que se dimensiona por su contenido.
 *
 * 11px son razonables en un viewport de escritorio; una placa no es un
 * viewport.
 *
 * Acá no hay tokens de esquineros: la versión anterior tenía cuatro corchetes
 * en las esquinas (`.hud-corner`) y se sacaron. Sujetaban `REC` y el timecode
 * contra el borde, pero encerraban la placa en un "visor de cámara" y le
 * quitaban aire. Sin ellos la lectura es editorial. Es una decisión de marca,
 * no un ajuste — si vuelven, vuelven a `landing/app/globals.css` como fuente.
 */
export const HUD = {
  labelTamano: 20,
  labelTracking: "0.16em",
} as const;

/**
 * Tienen que coincidir con los `name` de `cargarFuentes()`.
 *
 * `display` es Anton, no Archivo: es la única pieza donde la placa se separa a
 * propósito de la landing. El porqué, con los números, está en `fuentes/index.ts`.
 */
export const FUENTE = {
  display: "Anton",
  mono: "IBMPlexMono",
} as const;

/**
 * El fondo. Es el monograma cuadrado de la marca tileado en cuadrícula, tan
 * bajo que se lee como trama y no como logo repetido.
 *
 * Reemplaza a la lluvia de ceros y unos que usaban las placas viejas. Los
 * números salen de comparar renders reales, no de teoría:
 *
 * - `opacidad: 0.025` — al 10% las bandas BO/TR cruzan por el nombre y le comen
 *   el peso; al 2% solo asoma en las zonas oscuras y se lee como ruido de
 *   compresión. Estuvo en 0.03 y se bajó mirando placas reales en Slack: a ese
 *   valor la trama competía de más con la foto del invitado.
 * - `columnas: 6` — a 10 columnas deja de reconocerse "BOTR" y el punto de
 *   usar el logo se pierde.
 * - `atenuarNombre` — la trama baja sobre el tercio izquierdo. La curva está
 *   medida sobre las cinco placas de referencia: entre el 12% y el 37% del
 *   ancho son negro limpio, porque ahí va el nombre.
 *
 * El asset trae el punto rojo del monograma, así que el fondo reparte
 * `COLOR.rojo` por toda la placa sin que haya que pintarlo aparte.
 */
export const FONDO = {
  monograma: "botr-monograma-cuadrado-sin-placa-neg.svg",
  opacidad: 0.025,
  columnas: 6,
  atenuarNombre: true,
  /** Alfa del grano de `.tv-overlay`, mismo feTurbulence que la landing. */
  grano: 0.055,
  /** Cuánto negro come la viñeta en las esquinas. */
  vineta: 0.55,
} as const;
