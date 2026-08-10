/** @jsxImportSource react */
import { HUD, COLOR, FUENTE } from "../tokens";

/**
 * El estilo de `.hud-label` en `landing/app/globals.css`: mono, mayúsculas,
 * tracking 0.16em. Es la voz de todo el texto chico de la placa — REC, el
 * timecode, la etiqueta de invitado, las filas de la caja de datos y el lema.
 *
 * `escala` es un factor (1 = tamaño de diseño), no un tamaño en px: quien
 * llama pasa el mismo factor de supermuestreo que usa el resto del template.
 */
export function Etiqueta({
  children,
  color = COLOR.hud,
  escala = 1,
  tamano = HUD.labelTamano,
}: {
  children: string;
  color?: string;
  escala?: number;
  /**
   * Cuerpo en px del tamaño de diseño. La caja de datos lo sube: fecha y hora
   * son la única información accionable de la placa, y al tamaño de las demás
   * etiquetas quedaban en 7pt sobre el feed — ilegibles sin ampliar.
   */
  tamano?: number;
}) {
  return (
    <div
      style={{
        display: "flex",
        fontFamily: FUENTE.mono,
        fontSize: tamano * escala,
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

/** El punto rojo de `.rec-dot`. Sin parpadeo: una placa es un frame quieto. */
export function PuntoRec({ tamano = 9, escala = 1 }: { tamano?: number; escala?: number }) {
  const t = tamano * escala;
  return (
    <div style={{ display: "flex", width: t, height: t, borderRadius: t, background: COLOR.rojo }} />
  );
}
