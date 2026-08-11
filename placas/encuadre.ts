/**
 * Dónde va la cara del invitado en la placa.
 *
 * Esto es diseño, no infraestructura: son las coordenadas del retrato en el
 * lienzo, medidas sobre `referencia/1x1-objetivo.jpeg`. Quién mide la foto que
 * sube el humano —un modelo con visión— vive en `lib/encuadre.ts`, afuera del
 * paquete. Acá sólo está el objetivo y la aritmética que lleva de una medida al
 * otro, que es pura y se testea sin llamar a ningún modelo.
 *
 * ── Por qué hace falta ──
 *
 * `escalaSujeto` sola no alcanza. Escala la silueta entera, así que el tamaño
 * de la cara termina dependiendo de cuánto cuerpo haya en la foto de origen: un
 * plano de busto llevado al alto del cuadro da una cabeza enorme, y uno entero
 * da una cabeza chica. Con el mismo número. Eso es lo que hacía que cada foto
 * necesitara su ajuste a mano.
 *
 * Se intentó derivarlo de los píxeles dos veces y las dos fallaron:
 *
 * - Escalando para que la silueta llene el alto: sale una cabeza gigante,
 *   porque el alto ocupado no es lo mismo que el encuadre.
 * - Normalizando por el ancho de la cabeza: la medida agarra el pelo, que en un
 *   peinado angosto infla la escala y termina cortando la cabeza.
 *
 * Las dos son **estadísticas de píxeles**. Una silueta con los brazos cruzados
 * y un primer plano dan números parecidos y encuadres opuestos. Lo que faltaba
 * era semántica —esto es una cabeza, acá están los ojos— y eso no sale de medir
 * el alfa.
 */

/**
 * Dónde está la cara dentro de una imagen, en fracciones de esa imagen.
 *
 * `arriba` y `abajo` son la cabeza completa, con pelo. `ojos` es la línea de
 * los ojos y `centro` el eje vertical de la cara.
 */
export type MedidaCara = {
  arriba: number;
  abajo: number;
  ojos: number;
  centro: number;
};

/**
 * Dónde tiene que quedar la cara en el lienzo, en fracciones del lienzo.
 *
 * Medido sobre `referencia/1x1-objetivo.jpeg` con el mismo instrumento que mide
 * las fotos de entrada — el modelo de visión de `lib/encuadre.ts`. Medir el
 * objetivo y la entrada con la misma regla es lo que hace que la comparación
 * signifique algo; una medida a ojo del objetivo y otra del modelo para la
 * entrada arrastrarían sesgos distintos.
 *
 * Cuatro corridas sobre la referencia:
 *
 *   alto de cabeza   44.3  44.0  44.4  44.9   → 44.4
 *   línea de ojos    25.5  25.7  25.7  25.7   → 25.7
 *   centro de cara   52.6  51.0  51.1  51.1   → 51.0
 *
 * La escala sale del **alto de la cabeza** y la posición de la **línea de los
 * ojos**, no de la coronilla: el pelo oscuro hace que la coronilla sea la
 * medida más ruidosa (3.6 a 4.2 entre corridas) y los ojos la más firme
 * (25.5 a 25.7). Anclar en el dato ruidoso movería la cara verticalmente entre
 * placas sin que nada hubiera cambiado.
 */
export const OBJETIVO = {
  altoCabeza: 0.444,
  ojos: 0.257,
  centro: 0.51,
} as const;

export type Objetivo = typeof OBJETIVO;

/** Cómo hay que transformar la foto para que la cara caiga donde va. */
export type Encuadre = {
  /** Fracción del alto del cuadro que ocupa la silueta entera. */
  escalaSujeto: number;
  /** Dónde está la cara en la foto y dónde tiene que quedar, para el pegado. */
  cara: { ojos: number; centro: number; ojosEn: number; centroEn: number };
};

/**
 * El límite de cuánto puede agrandar el encuadre automático.
 *
 * Una medida disparatada —el modelo confunde una mano con una cabeza y devuelve
 * un alto de 3%— pediría una escala de 15 y reventaría el render con una foto
 * de 16000px de alto. El tope convierte eso en una placa fea en vez de un error.
 *
 * El piso existe por lo simétrico: una medida que abarque casi toda la foto
 * daría una escala minúscula y el invitado desaparecería.
 */
const ESCALA_MINIMA = 0.35;
const ESCALA_MAXIMA = 3;

/**
 * De dónde está la cara a cómo hay que transformar la foto.
 *
 * Pura: no toca píxeles ni llama a nadie. Lo único que necesita saber de la
 * foto es dónde está la cara **en fracciones**, así que funciona igual con una
 * foto de 500px o de 4000.
 */
export function encuadrar(medida: MedidaCara, objetivo: Objetivo = OBJETIVO): Encuadre {
  const altoCabeza = medida.abajo - medida.arriba;

  // La silueta se escala entera, así que si la cabeza ocupa `altoCabeza` de la
  // foto y la queremos en `objetivo.altoCabeza` del cuadro, la foto entera
  // tiene que quedar en `objetivo.altoCabeza / altoCabeza` del cuadro.
  const escala = objetivo.altoCabeza / altoCabeza;

  return {
    escalaSujeto: Math.min(ESCALA_MAXIMA, Math.max(ESCALA_MINIMA, escala)),
    cara: {
      ojos: medida.ojos,
      centro: medida.centro,
      ojosEn: objetivo.ojos,
      centroEn: objetivo.centro,
    },
  };
}

/**
 * Si una medida tiene sentido como cara.
 *
 * El modelo puede devolver números bien formados y absurdos —el schema acepta
 * cualquier fracción entre 0 y 1— y una medida absurda produce un encuadre
 * absurdo en silencio. Esto es la diferencia entre "el modelo respondió" y "el
 * modelo midió algo".
 *
 * No es validación defensiva: es la condición para preferir esta medida sobre
 * el default fijo. Si no la cumple, se usa el default, que siempre da algo
 * publicable.
 */
export function medidaCoherente(m: MedidaCara): boolean {
  const enRango = (v: number) => v >= 0 && v <= 1;
  if (![m.arriba, m.abajo, m.ojos, m.centro].every(enRango)) return false;

  // Los ojos van adentro de la cabeza, no arriba del pelo ni abajo del mentón.
  if (!(m.arriba < m.ojos && m.ojos < m.abajo)) return false;

  // Una cabeza que ocupa menos del 4% o más del 95% del alto no es una cabeza:
  // es un error de medición. El 4% sale de que una foto de cuerpo entero de pie
  // deja la cabeza en ~12%, así que 4% ya está muy por fuera de lo plausible.
  const alto = m.abajo - m.arriba;
  return alto >= 0.04 && alto <= 0.95;
}
