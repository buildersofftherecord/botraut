export type Lienzo = {
  ancho: number;
  alto: number;
  /** Margen del marco HUD, en px. */
  margen: number;
  /**
   * Cuerpo *máximo* del nombre del invitado, en px. `Placa.tsx` lo achica
   * por debajo de este techo cuando la palabra más larga del nombre no
   * entraría en la columna reservada — ver `tamanoNombre()` ahí.
   */
  nombreTamano: number;
  /** Cuerpo del rol, en px. */
  rolTamano: number;
  /** Fracción del ancho total que ocupa la foto. */
  fotoAncho: number;
};

/**
 * El v1 solo produce 1:1, pero `Placa.tsx` toma el lienzo como prop desde el
 * día uno: agregar un formato es agregar una fila acá, no rediseñar el
 * template. Los valores de los otros tres son un punto de partida y hay que
 * ajustarlos a ojo cuando se activen.
 */
export const LIENZOS = {
  "1:1": { ancho: 1080, alto: 1080, margen: 40, nombreTamano: 118, rolTamano: 25, fotoAncho: 0.48 },
  "4:5": { ancho: 1080, alto: 1350, margen: 44, nombreTamano: 124, rolTamano: 26, fotoAncho: 0.46 },
  "9:16": { ancho: 1080, alto: 1920, margen: 48, nombreTamano: 130, rolTamano: 28, fotoAncho: 0.5 },
  "16:9": { ancho: 1280, alto: 720, margen: 32, nombreTamano: 84, rolTamano: 20, fotoAncho: 0.38 },
} as const satisfies Record<string, Lienzo>;

export type NombreLienzo = keyof typeof LIENZOS;
