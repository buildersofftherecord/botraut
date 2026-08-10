export type Lienzo = {
  ancho: number;
  alto: number;
  /** Margen del marco HUD, en px. */
  margen: number;
  /**
   * Cuerpo *máximo* del nombre del invitado, en px. `tamanoNombre()` lo achica
   * por debajo de este techo cuando la palabra más larga del nombre no entraría
   * en la columna reservada.
   *
   * Con Anton, el techo sólo manda en los nombres **cortos**. Medido sobre la
   * columna de 481px del 1:1: GUILLERMO entra a 120px y FRANCISCO a 123 — los
   * ata la columna, no el techo. NAOMI entra a 201 y ONEGA a 207, y ahí sí
   * manda el techo. O sea que este número decide cuán grande se ve un nombre
   * corto, no el tamaño general.
   */
  nombreTamano: number;
  /** Cuerpo del rol, en px. */
  rolTamano: number;
  /** Fracción del ancho total que ocupa la foto. */
  fotoAncho: number;
  /**
   * Ancho del logo de abajo a la derecha, en px.
   *
   * No es decorativo: en las placas de referencia la bandera **cruza el borde
   * donde arranca la foto**, y eso es lo que ata a la persona a la placa en vez
   * de dejarla flotando como un recorte pegado. Para que cumpla esa función
   * tiene que ser más ancho que la distancia entre su borde derecho y el
   * comienzo de la foto: con `fotoAncho` 0.48 y márgenes de 40+20, eso es
   * cualquier valor arriba de ~460 en 1080.
   */
  /**
   * Ancho del wordmark, en px.
   *
   * El 1:1 usa 320 y los demás siguen en 400-460: se bajó mirando renders
   * reales. A 440 el logo competía con la caja de datos por el peso de la
   * mitad inferior. Los otros lienzos no están calibrados, así que se dejaron
   * como estaban en vez de arrastrarles un número elegido para el cuadrado.
   */
  logoAncho: number;
  /**
   * Ancho fijo de la caja de datos, en px.
   *
   * Fijo, no derivado del contenido. Antes la caja se dimensionaba por su texto
   * más largo, así que `"JUEVES 6 DE AGOSTO"` y `"JUEVES 30 DE SEPTIEMBRE"`
   * daban cajas de ancho distinto y la composición se corría de semana a
   * semana. Un ancho fijo es lo que permite hornear el marco en la capa fija, y
   * además es lo que hace que la placa sea el mismo template todas las veces.
   *
   * El 480 sale del peor caso realista: el programa es siempre un jueves, y
   * `"JUEVES 30 DE SEPTIEMBRE"` mide 346px en IBM Plex Mono a 20px con el
   * tracking del HUD. Más el ícono, el separador, los gaps y el padding da 480,
   * y hasta donde arranca la foto hay 494.
   */
  cajaAncho: number;
};

/**
 * El v1 solo produce 1:1, pero `Placa.tsx` toma el lienzo como prop desde el
 * día uno: agregar un formato es agregar una fila acá, no rediseñar el
 * template. Los valores de los otros tres son un punto de partida y hay que
 * ajustarlos a ojo cuando se activen.
 */
export const LIENZOS = {
  "1:1": { ancho: 1080, alto: 1080, margen: 40, nombreTamano: 200, rolTamano: 25, fotoAncho: 0.48, logoAncho: 320, cajaAncho: 550 },
  "4:5": { ancho: 1080, alto: 1350, margen: 44, nombreTamano: 210, rolTamano: 26, fotoAncho: 0.46, logoAncho: 440, cajaAncho: 480 },
  "9:16": { ancho: 1080, alto: 1920, margen: 48, nombreTamano: 220, rolTamano: 28, fotoAncho: 0.5, logoAncho: 460, cajaAncho: 500 },
  "16:9": { ancho: 1280, alto: 720, margen: 32, nombreTamano: 142, rolTamano: 20, fotoAncho: 0.38, logoAncho: 400, cajaAncho: 380 },
} as const satisfies Record<string, Lienzo>;

export type NombreLienzo = keyof typeof LIENZOS;

/**
 * La silueta no llega al alto completo del lienzo: queda por debajo del borde
 * superior para que el marco HUD respire.
 */
const PROPORCION_ALTO_FOTO = 0.94;

/**
 * A qué alto real se lleva la silueta en un lienzo dado.
 *
 * Vive acá y no en `generar.ts` porque `lib/foto.ts` necesita el mismo número
 * para decidir si una silueta tiene resolución suficiente. Cuando estaban
 * separados, la validación exigía el alto crudo del lienzo y rechazaba fotos
 * que el render iba a achicar igual.
 */
export function altoDeFoto(lienzo: Lienzo): number {
  return Math.round(lienzo.alto * PROPORCION_ALTO_FOTO);
}
