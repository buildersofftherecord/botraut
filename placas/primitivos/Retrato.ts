import sharp from "sharp";

/**
 * Prepara la foto del invitado para el template.
 *
 * Vive fuera de `Placa.tsx` porque Satori no soporta `filter`: todo lo que sea
 * blanco y negro, curva de contraste o degradado tiene que estar horneado en
 * los píxeles antes de entrar al render.
 *
 * La foto tiene que llegar **ya recortada**, con fondo transparente. Esto no
 * recorta.
 */
export type OpcionesRetrato = {
  /** Ancho del cuadro de destino, en píxeles ya multiplicados por el supermuestreo. */
  ancho: number;
  /** Alto del cuadro de destino, ídem. */
  alto: number;
  /**
   * Qué fracción del ancho del cuadro ocupa el sujeto. Arriba de 1 el sujeto
   * se sale por los costados, que es lo que hacen las placas de referencia:
   * la persona sangra por el borde derecho en vez de quedar contenida en una
   * columna. Contenida se lee como recorte pegado encima.
   *
   * El default tiene que coincidir con el de `--escala` en `generar.ts`. Estuvo
   * en 1 mientras el CLI pasaba 1.15, y el resultado fue que un script que
   * llamaba a esta función sin el parámetro producía una placa distinta a la
   * del CLI con los mismos datos.
   */
  escalaSujeto?: number;
  /**
   * Cuánto se hunden los negros, en gamma. Arriba de 1 oscurece los medios.
   *
   * Es lo que integra la foto: en las placas de referencia no se ve dónde
   * termina la persona porque va de negro sobre negro, y el corte desaparece
   * solo. Sin esto, una remera negra fotografiada queda en gris 40 y el
   * recorte se lee como una figurita pegada.
   */
  gamma?: number;
  /**
   * Ancho del desvanecido sobre el borde izquierdo, en fracción del cuadro.
   * La persona emerge de la oscuridad en vez de arrancar con un canto duro
   * contra la columna del nombre.
   */
  desvanecido?: number;
  /**
   * Alto del desvanecido sobre el borde inferior, en fracción del cuadro.
   *
   * En las placas originales la base de la persona la tapa la bandera de tela,
   * que cruza en diagonal por abajo. Nosotros usamos el wordmark limpio, que es
   * un rectángulo mucho más chico y no llega a cubrir: el invitado queda
   * cortado a filo por el borde del lienzo. Esto lo disuelve en el negro en vez
   * de cortarlo.
   */
  desvanecidoBase?: number;
};

export async function prepararRetrato(
  entrada: Buffer,
  { ancho, alto, escalaSujeto = 1.15, gamma = 1.35, desvanecido = 0.14, desvanecidoBase = 0.28 }: OpcionesRetrato,
): Promise<Buffer> {
  // 1. Recorte al sujeto. `trim` sobre el alfa saca el aire que dejó el
  //    recortador, que si no se cuenta como parte de la foto y descentra todo
  //    el encuadre — el sujeto termina corrido y más chico de lo pedido.
  const alSujeto = await sharp(entrada).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();

  // 2. Escala. El alto se deriva del ancho para no deformar; que sobre o falte
  //    alto respecto del cuadro se resuelve en el pegado, no estirando.
  const anchoSujeto = Math.round(ancho * escalaSujeto);
  const escalado = await sharp(alSujeto)
    .resize({ width: anchoSujeto, kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .gamma(gamma)
    .png()
    .toBuffer();
  const m = await sharp(escalado).metadata();
  const altoSujeto = m.height ?? alto;

  // 3. Pegado al cuadro: anclado **arriba** y a la derecha.
  //
  //    Arriba, no abajo. La primera versión anclaba al piso y el invitado
  //    quedaba colgando: medido, la cara arrancaba al 27% del alto de la placa
  //    contra el 12%-17% de las cinco referencias. Anclado arriba la cabeza
  //    llega donde tiene que llegar y el torso se va por el borde inferior, que
  //    es lo que en las originales lo mete **detrás** de la bandera en vez de
  //    dejarlo al lado.
  //
  //    Lo que sobra se recorta antes de pegar, no se pega con offset negativo:
  //    `composite` de sharp sólo acepta offsets positivos, así que el desborde
  //    se resuelve con `extract`. Se recorta por abajo y por la izquierda, que
  //    es lo que sangra en la referencia.
  const anchoVisible = Math.min(anchoSujeto, ancho);
  const altoVisible = Math.min(altoSujeto, alto);
  const visible =
    anchoVisible === anchoSujeto && altoVisible === altoSujeto
      ? escalado
      : await sharp(escalado)
          .extract({
            left: anchoSujeto - anchoVisible,
            top: 0,
            width: anchoVisible,
            height: altoVisible,
          })
          .png()
          .toBuffer();

  const cuadro = await sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: visible, left: ancho - anchoVisible, top: 0 }])
    .png()
    .toBuffer();

  if (desvanecido <= 0 && desvanecidoBase <= 0) return cuadro;

  // 4. Desvanecidos, aplicados sobre el alfa. `dest-in` con un degradado
  //    blanco→transparente multiplica la máscara contra el alfa que ya trae el
  //    recorte, así que respeta la silueta en vez de pintar un rectángulo negro
  //    encima.
  //
  //    **Una pasada de `dest-in` por degradado, no los dos en el mismo SVG.**
  //    El intento de meterlos juntos usaba `mix-blend-mode:multiply` sobre un
  //    `<g>`, y librsvg lo ignora: el segundo degradado terminaba pintando
  //    encima del primero en vez de multiplicarlo, y donde llegaba a blanco
  //    pleno reaparecía el rectángulo del cuadro con un canto duro a media
  //    foto. Cada `dest-in` es un round-trip de PNG más y vale la pena.
  const envolver = (contenido: string) =>
    Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">${contenido}</svg>`,
    );

  let salida = cuadro;

  if (desvanecido > 0) {
    salida = await sharp(salida)
      .composite([
        {
          input: envolver(
            `<linearGradient id="g" x1="0" x2="1">
               <stop offset="0" stop-color="#fff" stop-opacity="0"/>
               <stop offset="${desvanecido}" stop-color="#fff" stop-opacity="1"/>
             </linearGradient>
             <rect width="100%" height="100%" fill="url(#g)"/>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
  }

  if (desvanecidoBase > 0) {
    // El degradado va anclado al **borde inferior del sujeto**, no al del
    // cuadro. Salvo que la persona llegue justo al piso, entre las dos hay
    // transparencia, y un degradado desde el piso del cuadro se gasta entero
    // sobre esa nada: el canto de la foto queda intacto más arriba.
    //
    // Y ese canto siempre existe: la foto de origen está cortada al pecho, así
    // que el sujeto termina en una línea horizontal recta a cualquier escala.
    // Es exactamente lo que hay que disolver.
    const largo = Math.round(alto * desvanecidoBase);
    const desde = Math.max(0, altoVisible - largo);
    salida = await sharp(salida)
      .composite([
        {
          input: envolver(
            `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${altoVisible}" x2="0" y2="${desde}">
               <stop offset="0" stop-color="#fff" stop-opacity="0"/>
               <stop offset="1" stop-color="#fff" stop-opacity="1"/>
             </linearGradient>
             <rect x="0" y="${desde}" width="100%" height="${altoVisible - desde}" fill="url(#g)"/>
             <rect x="0" y="0" width="100%" height="${desde}" fill="#fff"/>`,
          ),
          blend: "dest-in",
        },
      ])
      .png()
      .toBuffer();
  }

  return salida;
}
