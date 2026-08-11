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
 *
 * ── El encuadre cambió con el layout centrado ──
 *
 * Antes el invitado era una columna a la derecha y se escalaba por el **ancho**
 * del cuadro. Ahora es el elemento dominante, centrado y a sangre por abajo, y
 * se escala por el **alto**. No es lo mismo: escalar por ancho hacía que el
 * tamaño final dependiera de cuán abierto estuviera el plano de origen —con los
 * brazos cruzados la silueta es ancha, se achicaba para entrar, y la persona
 * quedaba baja. Por alto, una foto de busto y otra de medio cuerpo llegan las
 * dos a la misma altura de cabeza.
 *
 * Lo que **no** resuelve escalar por alto es de dónde a dónde va el encuadre:
 * un plano entero llevado al alto del cuadro da una cabeza chica, y uno de
 * busto da una cabeza grande. Eso es criterio, no aritmética, y es lo que va a
 * decidir el modelo de visión: mira la foto y devuelve dónde está la cabeza.
 * Hasta entonces `escalaSujeto` se pasa desde afuera.
 */
export type OpcionesRetrato = {
  /** Ancho del cuadro de destino, en píxeles ya multiplicados por el supermuestreo. */
  ancho: number;
  /** Alto del cuadro de destino, ídem. */
  alto: number;
  /**
   * Qué fracción del **alto** del cuadro ocupa la silueta.
   *
   * En 1 la persona va del borde superior del cuadro al inferior. Arriba de 1
   * se sale por abajo, que es lo que hace la referencia: el torso sangra por el
   * borde en vez de terminar adentro. Terminado adentro se lee como recorte
   * pegado encima.
   *
   * El default 0.75 sale de comparar renders a 0.65, 0.75 y 0.85 con la foto de
   * muestra: a 0.65 el invitado flota en el aire de arriba, a 0.85 la cabeza se
   * sube y el nombre le cruza el brazo en vez del pecho.
   *
   * **Tiene que coincidir con `ESCALA_SUJETO` en `lib/placa.ts`.** Cuando no
   * coincidían, un script que llamaba a esta función sin el parámetro producía
   * una placa distinta a la del bot con los mismos datos.
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
   * Ancho del desvanecido sobre **cada** borde lateral, en fracción del cuadro.
   *
   * Simétrico, porque el sujeto ahora está centrado. Antes era sólo el borde
   * izquierdo, contra la columna del nombre; en un plano centrado los dos lados
   * son el mismo caso — los hombros que sangran por izquierda y por derecha
   * tienen que disolverse igual.
   */
  desvanecido?: number;
  /**
   * Alto del desvanecido sobre el borde inferior, en fracción del cuadro.
   *
   * Es la pieza que hace que el invitado no flote. El nombre se le apoya encima
   * del torso y de ahí para abajo el cuerpo se disuelve en negro: por eso no
   * hace falta ningún objeto —bandera ni nada— tapando la base. Sin esto, la
   * foto de origen (cortada al pecho) termina en una línea horizontal recta a
   * cualquier escala, y esa línea es exactamente lo que delata el recorte.
   */
  desvanecidoBase?: number;
  /**
   * A partir de qué fracción del cuadro el sujeto tiene que ser **totalmente
   * transparente**, pase lo que pase con la escala.
   *
   * Existe porque el desvanecido solo no alcanza. Estaba anclado al borde
   * inferior del sujeto, así que su posición se movía con `escalaSujeto`: a
   * 0.75 el cuerpo estaba disuelto donde cae el rol (alfa 1%) y a 1.15 estaba
   * entero (alfa 85%), con el rol y la fecha ilegibles encima. El agente puede
   * cambiar la escala, así que la legibilidad del texto no puede depender de
   * ella.
   *
   * Esto es un dato del **layout**, no de la foto: abajo de esta línea van el
   * rol, la barra y el wordmark, y ahí no puede haber nada. Arriba sí —el
   * nombre se apoya sobre el pecho a propósito— y por eso el desvanecido
   * empieza más arriba en vez de cortar seco.
   *
   * 0.76 es donde arranca el rol. Ahora el cuadro **es** el lienzo, así que la
   * fracción es directa y no hay que convertirla — antes el cuadro medía el 94%
   * y este número era 0.74, con la conversión escrita a mano.
   */
  pisoTexto?: number;
  /**
   * Dónde se apoya la esquina superior izquierda del sujeto, en fracciones del
   * cuadro. `y` es el aire arriba de la coronilla; `x` se suma al centrado.
   *
   * El 0.06 de `y` es el aire que antes daba `PROPORCION_ALTO_FOTO = 0.94` en
   * `lienzos.ts`. Se movió acá porque es una decisión de dónde va la cara, no
   * del tamaño del cuadro — y teniéndolo acá, el cuadro puede ser el lienzo
   * entero y desaparece la conversión entre dos sistemas de fracciones.
   *
   * Lo pisa `cara` cuando hay medición.
   */
  desplazamiento?: { x: number; y: number };
  /**
   * Encuadre por medición: dónde está la cara en la foto y dónde tiene que
   * quedar en el cuadro, todo en fracciones.
   *
   * Cuando está, manda sobre `desplazamiento`: la posición sale de hacer
   * coincidir la línea de los ojos con su objetivo, en vez de dejar un aire
   * fijo arriba. Es la diferencia entre "todas las fotos arrancan al 6%" y
   * "todas las caras quedan en el mismo lugar" — que no es lo mismo, porque el
   * pelo mide distinto en cada persona.
   *
   * Lo calcula `encuadrar()` en `../encuadre.ts` a partir de lo que midió el
   * modelo de visión. Sin medición no viene, y el retrato cae en el
   * `desplazamiento` fijo, que siempre produce algo publicable.
   */
  cara?: { ojos: number; centro: number; ojosEn: number; centroEn: number };
};

export async function prepararRetrato(
  entrada: Buffer,
  { ancho, alto, escalaSujeto = 0.75, gamma = 1.35, desvanecido = 0.06,
    desvanecidoBase = 0.15,
    pisoTexto = 0.76,
    desplazamiento = { x: 0, y: 0.06 },
    cara,
  }: OpcionesRetrato,
): Promise<Buffer> {
  // 1. Recorte al sujeto. `trim` sobre el alfa saca el aire que dejó el
  //    recortador, que si no se cuenta como parte de la foto y descentra todo
  //    el encuadre — el sujeto termina corrido y más chico de lo pedido.
  //
  //    **Salvo que haya medición.** Las fracciones de `cara` son relativas a la
  //    imagen tal como llega, así que recortarla acá las invalida: el sujeto se
  //    mueve y se agranda, pero los números siguen apuntando a donde estaba la
  //    cara antes. Con una foto con mucho aire abajo eso daba una escala de 2
  //    aplicada a una imagen ya ajustada, o sea una cabeza gigante cortada.
  //
  //    Quien mide es responsable de medir sobre lo que manda. Si ya venía
  //    recortada, este `trim` no haría nada igual; si no venía, saltearlo es
  //    justamente lo que mantiene los dos en el mismo sistema de coordenadas.
  const alSujeto = cara
    ? await sharp(entrada).ensureAlpha().png().toBuffer()
    : await sharp(entrada).ensureAlpha().trim({ threshold: 1 }).png().toBuffer();

  // 2. Escala por alto. El ancho se deriva para no deformar; que sobre ancho
  //    respecto del cuadro se resuelve recortando en el pegado, no estirando.
  const altoSujeto = Math.round(alto * escalaSujeto);
  const escalado = await sharp(alSujeto)
    .resize({ height: altoSujeto, kernel: sharp.kernel.lanczos3 })
    .grayscale()
    .gamma(gamma)
    .png()
    .toBuffer();
  const m = await sharp(escalado).metadata();
  const anchoSujeto = m.width ?? ancho;

  // 3. Pegado al cuadro.
  //
  //    Dónde va la esquina superior izquierda del sujeto. Con medición sale de
  //    hacer coincidir la línea de los ojos y el centro de la cara con su
  //    objetivo; sin medición, del desplazamiento fijo sobre el centrado.
  //
  //    Arriba, no abajo, en los dos casos. Anclado al piso el invitado queda
  //    colgando: medido, la cara arrancaba al 27% del alto de la placa contra
  //    el 6% de la referencia.
  const destino = cara
    ? {
        x: Math.round(cara.centroEn * ancho - cara.centro * anchoSujeto),
        y: Math.round(cara.ojosEn * alto - cara.ojos * altoSujeto),
      }
    : {
        x: Math.round((ancho - anchoSujeto) / 2 + desplazamiento.x * ancho),
        y: Math.round(desplazamiento.y * alto),
      };

  //    `composite` de sharp sólo acepta offsets positivos, así que un destino
  //    negativo —el sujeto sale por arriba o por la izquierda— se resuelve
  //    recortando con `extract` antes de pegar, no pegando corrido.
  const recorte = {
    left: Math.max(0, -destino.x),
    top: Math.max(0, -destino.y),
  };
  const anchoVisible = Math.min(anchoSujeto - recorte.left, ancho - Math.max(0, destino.x));
  const altoVisible = Math.min(altoSujeto - recorte.top, alto - Math.max(0, destino.y));

  // El sujeto puede quedar entero fuera del cuadro si la medición fue absurda.
  // Devolver el cuadro vacío es feo pero publicable; `extract` con alto o ancho
  // cero tira, y eso mataría el handler.
  if (anchoVisible <= 0 || altoVisible <= 0) {
    return sharp({
      create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
  }

  const sinRecorte =
    recorte.left === 0 && recorte.top === 0 && anchoVisible === anchoSujeto && altoVisible === altoSujeto;
  const visible = sinRecorte
    ? escalado
    : await sharp(escalado)
        .extract({ ...recorte, width: anchoVisible, height: altoVisible })
        .png()
        .toBuffer();

  const cuadro = await sharp({
    create: { width: ancho, height: alto, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([{ input: visible, left: Math.max(0, destino.x), top: Math.max(0, destino.y) }])
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
               <stop offset="${1 - desvanecido}" stop-color="#fff" stop-opacity="1"/>
               <stop offset="1" stop-color="#fff" stop-opacity="0"/>
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
    // Dónde termina el desvanecido: el más alto entre el borde inferior del
    // sujeto y la línea del texto.
    //
    // El borde del sujeto, porque si la persona no llega al piso, entre las dos
    // hay transparencia y un degradado desde el piso del cuadro se gasta entero
    // sobre esa nada — el canto de la foto queda intacto más arriba.
    //
    // La línea del texto, porque si el sujeto **pasa** de ahí, el rol y la
    // barra quedan sobre el torso. Anclado sólo al sujeto, esta protección se
    // movía con `escalaSujeto` y desaparecía cuando el agente la subía.
    const bordeDelSujeto = Math.max(0, destino.y) + altoVisible;
    const piso = Math.min(bordeDelSujeto, Math.round(alto * pisoTexto));
    const largo = Math.round(alto * desvanecidoBase);
    const desde = Math.max(0, piso - largo);
    salida = await sharp(salida)
      .composite([
        {
          input: envolver(
            // Abajo de `piso` no se pinta nada: en `dest-in`, lo que la máscara
            // no cubre queda transparente. Ese es el corte duro que garantiza
            // el negro debajo del texto.
            `<linearGradient id="g" gradientUnits="userSpaceOnUse" x1="0" y1="${piso}" x2="0" y2="${desde}">
               <stop offset="0" stop-color="#fff" stop-opacity="0"/>
               <stop offset="1" stop-color="#fff" stop-opacity="1"/>
             </linearGradient>
             <rect x="0" y="${desde}" width="100%" height="${piso - desde}" fill="url(#g)"/>
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
