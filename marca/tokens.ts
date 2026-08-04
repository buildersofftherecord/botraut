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

/** De `.hud-corner` y `.hud-label`, más `--fs-hud` y `--tr-hud`. */
export const HUD = {
  esquinaLado: 26,
  esquinaBorde: 1,
  esquinaColor: "rgba(255,255,255,0.8)",
  labelTamano: 11,
  labelTracking: "0.16em",
} as const;

/** Tienen que coincidir con los `name` de `cargarFuentes()`. */
export const FUENTE = {
  display: "Archivo",
  mono: "IBMPlexMono",
} as const;
