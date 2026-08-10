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
  /**
   * Escalones por debajo del nombre. Antes el rol y la caja usaban `t75`
   * (191) y el HUD blanco puro, así que el texto chico gritaba más que el
   * nombre. Estos valores los ordenan por importancia real.
   */
  rol: "#8a8a8a",
  datos: "#9a9a9a",
  hud: "#6e6e6e",
} as const;

/**
 * El nombre es **el único elemento a blanco puro de toda la placa**.
 *
 * Estuvo en `#a5a5a5` (171), derivado de medir placas viejas. Pero medido
 * adentro de esta placa, el midtone de la cara da 174: el nombre y el retrato
 * quedaban al mismo valor, compitiendo empatados, sin figura ni fondo. Y las
 * etiquetas de 15px estaban en 255 — el doble de contraste que el nombre del
 * invitado.
 *
 * La regla ahora es una sola: un solo elemento a 255, y es el nombre. Todo lo
 * demás baja para dejarle lugar.
 */
export const NOMBRE_COLOR = "#ffffff";

/**
 * El wordmark ya no sigue al nombre: con el nombre en 255, igualarlo pondría
 * dos elementos peleando por el máximo. Queda en el gris que el nombre tenía
 * antes, que es donde funcionaba.
 */
export const LOGO_COLOR = "#a5a5a5";

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
  /**
   * Fecha y hora. Más grande que el resto de las etiquetas a propósito: es lo
   * único de la placa que alguien tiene que poder leer para actuar, y a 20px
   * quedaba en 7pt sobre el ancho real del feed.
   *
   * 23 y no más, y el techo no lo fija el gusto: lo fija el contenido.
   *
   * La fecha más larga que el sistema acepta es "JUEVES 30 DE SEPTIEMBRE", 23
   * caracteres, y tiene que entrar en una línea. La caja no puede pasar de
   * 550px sin montarse sobre la foto. Con esas dos restricciones, 23 es el
   * cuerpo más grande posible: a 24 la fecha de septiembre ya no entra.
   *
   * La crítica de diseño pedía 34-38 para que fuera legible en el feed. Ese
   * número es incompatible con las dos restricciones de arriba — a 28 sólo
   * entran 19 caracteres. Si hiciera falta más cuerpo, habría que abreviar la
   * fecha o mover la caja, no forzar el tamaño.
   */
  datosTamano: 23,
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
 * - `opacidad: 0.02` — al 10% las bandas BO/TR cruzan por el nombre y le comen
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
  opacidad: 0.02,
  columnas: 6,
  atenuarNombre: true,
  /** Alfa del grano de `.tv-overlay`, mismo feTurbulence que la landing. */
  grano: 0.055,
  /** Cuánto negro come la viñeta en las esquinas. */
  vineta: 0.55,
} as const;
