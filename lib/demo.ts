import type { DatosPlaca } from "./tipos";

/**
 * Movido acá desde `marca/Placa.tsx` (Task 20): lo usan tanto los tests de
 * `marca/` como los de `lib/`, y `lib/` no puede depender de `marca/` sin
 * crear un ciclo (`marca/Placa.tsx` importa de `lib/tipos.ts`).
 */
export const DATOS_DEMO: DatosPlaca = {
  invitado: {
    nombre: "Naomi Couriel",
    rol: "AI Engineering en UdeSA y Data & AI en Ualá",
    genero: "f",
    fuentes: ["https://ejemplo.com/naomi"],
  },
  fotoElegida: {
    url: "https://ejemplo.com/foto.jpg",
    fuente: "https://ejemplo.com/nota",
    ancho: 1200,
    alto: 1600,
  },
  fecha: "JUEVES 30 DE JULIO",
  hora: "21:00 HS",
  enVivo: true,
};
