/** @jsxImportSource react */
import { HUD, COLOR, FUENTE } from "./tokens";
import type { Lienzo } from "./lienzos";

/**
 * Los cuatro corchetes de `.hud-corner` en globals.css: cada uno son dos
 * bordes de un div, no un carácter ni un SVG.
 *
 * El wrapper (en vez de un Fragment con los 4 divs sueltos) no es estético:
 * Satori resuelve mal `right`/`bottom` en hermanos absolutos que llegan por
 * un Fragment devuelto desde un componente — los corchetes de la derecha
 * desaparecen si algo con `position: right` se monta después en la placa.
 * Envolver en un solo div absoluto de tamaño completo lo evita.
 */
export function Esquinas({ lienzo, escala = 1 }: { lienzo: Lienzo; escala?: number }) {
  const m = lienzo.margen;
  const s = HUD.esquinaLado * escala;
  const b = `${HUD.esquinaBorde * escala}px solid ${HUD.esquinaColor}`;

  const posiciones = [
    { top: m, left: m, borderTop: b, borderLeft: b },
    { top: m, right: m, borderTop: b, borderRight: b },
    { bottom: m, left: m, borderBottom: b, borderLeft: b },
    { bottom: m, right: m, borderBottom: b, borderRight: b },
  ];

  return (
    <div style={{ position: "absolute", display: "flex", top: 0, left: 0, width: "100%", height: "100%" }}>
      {posiciones.map((p, i) => (
        <div key={i} style={{ position: "absolute", width: s, height: s, display: "flex", ...p }} />
      ))}
    </div>
  );
}

/** El estilo de `.hud-label`: 11px, tracking 0.16em, mayúsculas. */
export function Etiqueta({
  children,
  color = COLOR.blanco,
  escala = 1,
}: {
  children: string;
  color?: string;
  escala?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: FUENTE.mono,
        fontSize: HUD.labelTamano * escala,
        // Tracking en em: relativo al fontSize, ya escala con él. Escalarlo
        // de nuevo lo duplicaría.
        letterSpacing: HUD.labelTracking,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

export function PuntoRec({ tamano = 9, escala = 1 }: { tamano?: number; escala?: number }) {
  const t = tamano * escala;
  return (
    <div
      style={{
        display: "flex",
        width: t,
        height: t,
        borderRadius: t,
        background: COLOR.rojo,
      }}
    />
  );
}
