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
 * El nombre **no va en blanco puro**. Medido sobre
 * `referencia/francisco-veiras.jpeg`, el interior de los trazos da
 * p50=163, p75=168, p90=176 — un gris, no `#ffffff`. Nuestra primera versión
 * daba 251 de media y por eso se veía dura contra el negro.
 *
 * Este valor sí se deriva de la imagen, a diferencia del resto de `COLOR`:
 * es una decisión del diseño de la placa, no un token del sistema que
 * compartimos con `landing/`.
 */
export const NOMBRE_COLOR = "#a5a5a5";

/**
 * De `.hud-corner` y `.hud-label`, más `--fs-hud` y `--tr-hud`.
 *
 * `labelTamano` es la excepción: el `11` de la landing se portó tal cual y en
 * una imagen de 1080px queda tímido. Medido sobre la referencia, sus etiquetas
 * ocupan 1.34% del ancho por carácter y las nuestras 0.74% — o sea que todo el
 * texto chico de la placa estaba a la mitad de tamaño, y con él se achicaba la
 * caja de datos, que se dimensiona por su contenido.
 *
 * 11px son razonables en un viewport de escritorio; una placa no es un
 * viewport.
 */
export const HUD = {
  esquinaLado: 26,
  esquinaBorde: 1,
  esquinaColor: "rgba(255,255,255,0.8)",
  labelTamano: 20,
  labelTracking: "0.16em",
} as const;

/** Tienen que coincidir con los `name` de `cargarFuentes()`. */
export const FUENTE = {
  display: "Archivo",
  mono: "IBMPlexMono",
} as const;
