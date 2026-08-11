export type Lienzo = {
  ancho: number;
  alto: number;
  /**
   * Margen del HUD contra el borde del lienzo, en px. Sólo lo usan `REC ●` y
   * el timecode: son marcas de encuadre y tienen que ir pegadas al filo.
   *
   * El contenido usa `contenidoMargen`, que es mucho mayor. Que sean dos
   * márgenes distintos es deliberado: el HUD pertenece al borde, el contenido
   * a la caja de texto.
   */
  margen: number;
  /**
   * Margen lateral del bloque de contenido, en px.
   *
   * Nombre, rol y barra de datos comparten **el mismo ancho**, y este número
   * es lo que lo define. Que compartan ancho no es cosmético: es lo que hace
   * que el pie lea como un bloque y no como tres elementos sueltos que
   * casualmente están cerca.
   *
   * También es el ancho contra el que se mide el nombre. Antes el nombre se
   * medía contra la columna izquierda y la caja de datos tenía su propio ancho
   * fijo, así que nada garantizaba que se alinearan.
   */
  contenidoMargen: number;
  /**
   * Cuerpo *máximo* del nombre, en px.
   *
   * Con el nombre en una línea sobre 824px, el techo sólo manda en los nombres
   * cortos: "GUILLERMO RAUCH" entra a 124 y "FRANCISCO VEIRAS" a 125 — los ata
   * el ancho, no el techo. "NAOMI ONEGA" entra a 167 y "BOB" a 583, y ahí sí
   * manda. O sea que este número decide cuánto puede crecer un nombre corto.
   *
   * 150 y no más: arriba de eso un apellido corto se come el rol y la barra.
   */
  nombreTamano: number;
  /**
   * Piso del nombre en una línea, en px. Por debajo de esto se parte en dos.
   *
   * No es un mínimo de legibilidad —a 83px se lee perfecto— sino de **forma**:
   * un nombre de 24 caracteres estirado sobre los 824px queda como una cinta
   * fina y deja de leerse como titular. Medido: "Juan Cruz Fernandez Ruiz" da
   * 83 en una línea y 101 partido en dos.
   *
   * 100 es el corte: deja en una línea todo lo que llega hasta ~19 caracteres
   * —que incluye los dos casos reales, Rauch y Veiras— y parte lo que no.
   */
  nombreMinimo: number;
  /** Cuerpo del rol, en px. */
  rolTamano: number;
  /** Ancho del wordmark centrado al pie, en px. */
  logoAncho: number;
  /** Alto de la barra de datos, en px. */
  barraAlto: number;
};

/**
 * El v1 solo produce 1:1, pero `Placa.tsx` toma el lienzo como prop desde el
 * día uno: agregar un formato es agregar una fila acá, no rediseñar el
 * template. Los valores de los otros tres son un punto de partida y hay que
 * ajustarlos a ojo cuando se activen.
 *
 * Los números del 1:1 salen de medir la placa de referencia normalizada a
 * 1080, no de estimar: la barra de datos arranca al 12.3% del ancho (→ 128 de
 * margen) y el nombre ocupa el 75.6% (→ 824, que es exactamente el ancho de
 * contenido). Que el nombre y la barra midan lo mismo en la referencia es lo
 * que confirmó que comparten margen.
 */
export const LIENZOS = {
  "1:1":  { ancho: 1080, alto: 1080, margen: 40, contenidoMargen: 128, nombreTamano: 150, nombreMinimo: 100, rolTamano: 26, logoAncho: 300, barraAlto: 62 },
  "4:5":  { ancho: 1080, alto: 1350, margen: 44, contenidoMargen: 128, nombreTamano: 150, nombreMinimo: 100, rolTamano: 27, logoAncho: 310, barraAlto: 64 },
  "9:16": { ancho: 1080, alto: 1920, margen: 48, contenidoMargen: 132, nombreTamano: 155, nombreMinimo: 104, rolTamano: 28, logoAncho: 320, barraAlto: 66 },
  "16:9": { ancho: 1280, alto: 720,  margen: 32, contenidoMargen: 150, nombreTamano: 108, nombreMinimo: 74,  rolTamano: 20, logoAncho: 240, barraAlto: 50 },
} as const satisfies Record<string, Lienzo>;

export type NombreLienzo = keyof typeof LIENZOS;

/** Ancho que comparten el nombre, el rol y la barra de datos. */
export function anchoContenido(lienzo: Lienzo): number {
  return lienzo.ancho - lienzo.contenidoMargen * 2;
}

/**
 * El cuadro de la foto es **todo el lienzo**.
 *
 * Estuvo en 0.94 para dejar aire arriba de la coronilla, y ese aire ahora lo
 * pone `desplazamiento.y` en `prepararRetrato`, que es donde corresponde: es
 * una decisión de dónde va la cara, no del tamaño del cuadro.
 *
 * La razón de fondo es que el encuadre por visión trabaja en fracciones —"los
 * ojos van al 25.7% del alto"— y con un cuadro más chico que el lienzo cada
 * fracción hay que convertirla entre los dos sistemas. Esa conversión ya se
 * escribió a mano en un test como `(0.7 - 0.06) / 0.94`. Con el cuadro igual al
 * lienzo no hay dos sistemas.
 */
const PROPORCION_ALTO_FOTO = 1;

/**
 * A qué alto real se lleva el cuadro de la foto en un lienzo dado.
 *
 * Vive acá y no en `generar.ts` porque `lib/foto.ts` necesita el mismo número
 * para decidir si una silueta tiene resolución suficiente. Cuando estaban
 * separados, la validación exigía el alto crudo del lienzo y rechazaba fotos
 * que el render iba a achicar igual.
 */
export function altoDeFoto(lienzo: Lienzo): number {
  return Math.round(lienzo.alto * PROPORCION_ALTO_FOTO);
}
