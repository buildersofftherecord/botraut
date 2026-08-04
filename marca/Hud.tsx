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
export function Esquinas({ lienzo }: { lienzo: Lienzo }) {
  const m = lienzo.margen;
  const s = HUD.esquinaLado;
  const b = `${HUD.esquinaBorde}px solid ${HUD.esquinaColor}`;

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
}: {
  children: string;
  color?: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: FUENTE.mono,
        fontSize: HUD.labelTamano,
        letterSpacing: HUD.labelTracking,
        textTransform: "uppercase",
        color,
      }}
    >
      {children}
    </div>
  );
}

export function PuntoRec({ tamano = 9 }: { tamano?: number }) {
  return (
    <div
      style={{
        display: "flex",
        width: tamano,
        height: tamano,
        borderRadius: tamano,
        background: COLOR.rojo,
      }}
    />
  );
}
