/** @jsxImportSource react */
import { COLOR } from "./tokens";

type PropsIcono = { escala?: number };

// Satori renderiza SVG inline. Se dibujan con `stroke` para que sigan el
// peso del HUD en vez del relleno sólido de un icon set genérico. `escala`
// es un factor (1 = tamaño de diseño), no un tamaño en px: quien llama pasa
// el mismo factor de supersampling que usa el resto del template.
function base(escala: number) {
  return {
    width: 22 * escala,
    height: 22 * escala,
    fill: "none",
    stroke: COLOR.t75,
    strokeWidth: 1.4 * escala,
  };
}

export function IconoCalendario({ escala = 1 }: PropsIcono) {
  return (
    <svg {...base(escala)} viewBox="0 0 24 24">
      <rect x="3" y="5" width="18" height="16" rx="1" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </svg>
  );
}

export function IconoReloj({ escala = 1 }: PropsIcono) {
  return (
    <svg {...base(escala)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

export function IconoSenal({ escala = 1 }: PropsIcono) {
  return (
    <svg {...base(escala)} viewBox="0 0 24 24">
      <circle cx="12" cy="12" r="2.5" />
      <path d="M7.5 7.5a6.4 6.4 0 000 9M16.5 7.5a6.4 6.4 0 010 9" />
      <path d="M4.5 4.5a10.6 10.6 0 000 15M19.5 4.5a10.6 10.6 0 010 15" />
    </svg>
  );
}
