import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { prepararRetrato } from "../primitivos/Retrato";
import { LIENZOS, altoDeFoto } from "../lienzos";

const L = LIENZOS["1:1"];
const S = 2;
const ANCHO = L.ancho * S;
const ALTO = altoDeFoto(L) * S;

/** Alfa medio de una fila del cuadro, en el 40% central, como fracción. */
async function alfaEnFila(retrato: Buffer, fraccionDelCuadro: number): Promise<number> {
  const { data, info } = await sharp(retrato).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const y = Math.min(info.height - 1, Math.round(fraccionDelCuadro * info.height));
  let suma = 0;
  let n = 0;
  for (let x = Math.round(info.width * 0.3); x < info.width * 0.7; x++) {
    suma += data[(y * info.width + x) * 4 + 3];
    n++;
  }
  return suma / n / 255;
}

const PISO = 0.65;

/**
 * Una foto de prueba: gris opaco con una fila blanca en `marcaEn`.
 *
 * Sintética a propósito. Para verificar *dónde queda* la cara no hace falta una
 * cara — hace falta un punto que se pueda encontrar sin ambigüedad en la
 * salida, y una franja blanca lo es. Usar una foto real obligaría a detectar
 * ojos para comprobar el resultado, o sea a meter el modelo dentro del test que
 * verifica la aritmética que existe para no depender del modelo.
 */
async function fotoConMarca(ancho: number, alto: number, marcaEn: number): Promise<Buffer> {
  const fila = Math.round(alto * marcaEn);
  const pixeles = Buffer.alloc(ancho * alto * 4);
  for (let y = 0; y < alto; y++) {
    const gris = Math.abs(y - fila) <= 2 ? 255 : 60;
    for (let x = 0; x < ancho; x++) {
      const i = (y * ancho + x) * 4;
      pixeles[i] = pixeles[i + 1] = pixeles[i + 2] = gris;
      pixeles[i + 3] = 255;
    }
  }
  return sharp(pixeles, { raw: { width: ancho, height: alto, channels: 4 } }).png().toBuffer();
}

/** En qué fracción del alto quedó la fila más clara. */
async function filaMasClara(cuadro: Buffer): Promise<number> {
  const { data, info } = await sharp(cuadro).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let mejor = 0;
  let mejorY = 0;
  for (let y = 0; y < info.height; y++) {
    const i = (y * info.width + Math.round(info.width / 2)) * 4;
    const v = data[i] * (data[i + 3] / 255);
    if (v > mejor) {
      mejor = v;
      mejorY = y;
    }
  }
  return mejorY / info.height;
}

describe("prepararRetrato — dónde queda la cara", () => {
  const OJOS_EN = 0.257;
  const sinDesvanecidos = { desvanecido: 0, desvanecidoBase: 0 } as const;

  /**
   * La propiedad completa, de punta a punta: **tres fotos con la cara en
   * lugares y tamaños distintos tienen que dejar la cara en el mismo lugar del
   * lienzo**.
   *
   * Es lo que dos intentos anteriores no lograron, los dos derivando la escala
   * de estadísticas de la silueta —alto ocupado, ancho de la cabeza—. Una
   * silueta con los brazos cruzados y un primer plano dan números parecidos y
   * encuadres opuestos. Acá el dato es semántico y viene de afuera.
   */
  it.each([
    ["cara arriba y chica", 0.18, 0.6],
    ["cara al medio", 0.4, 1.0],
    ["cara abajo y grande", 0.62, 1.9],
  ])("con %s deja los ojos en el objetivo", async (_caso, ojosEnLaFoto, escalaSujeto) => {
    const foto = await fotoConMarca(600, 900, ojosEnLaFoto);

    const cuadro = await prepararRetrato(foto, {
      ancho: ANCHO,
      alto: ALTO,
      escalaSujeto,
      cara: { ojos: ojosEnLaFoto, centro: 0.5, ojosEn: OJOS_EN, centroEn: 0.5 },
      ...sinDesvanecidos,
    });

    expect(await filaMasClara(cuadro)).toBeCloseTo(OJOS_EN, 2);
  }, 30_000);

  /**
   * Con medición, `prepararRetrato` **no** puede recortar la foto al sujeto: las
   * fracciones de `cara` son relativas a la imagen tal como llega, y recortarla
   * las invalida.
   *
   * Esto salió de una prueba real. Con una foto con mucho aire abajo, el modelo
   * midió la cabeza al 21.8% y pidió escala 2.04; adentro el `trim` la dejaba
   * ajustada al sujeto y esa escala se aplicaba a una imagen donde la cabeza ya
   * ocupaba el 46%. Resultado: una cabeza gigante y cortada.
   */
  it("no recorta la foto cuando las coordenadas vienen de afuera", async () => {
    const conAire = await sharp({
      create: { width: 600, height: 1600, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .composite([{ input: await fotoConMarca(600, 800, 0.3), left: 0, top: 0 }])
      .png()
      .toBuffer();

    // La marca está al 30% de los 800px útiles, que sobre los 1600 del archivo
    // es el 15%. Si adentro recortara el aire, la marca volvería al 30% y la
    // fila terminaría muy por debajo del objetivo.
    const cuadro = await prepararRetrato(conAire, {
      ancho: ANCHO,
      alto: ALTO,
      escalaSujeto: 0.9,
      cara: { ojos: 0.15, centro: 0.5, ojosEn: OJOS_EN, centroEn: 0.5 },
      ...sinDesvanecidos,
    });

    expect(await filaMasClara(cuadro)).toBeCloseTo(OJOS_EN, 2);
  }, 30_000);
});

describe("prepararRetrato — el piso del texto", () => {
  /**
   * Abajo de `pisoTexto` van el rol, la barra de datos y el wordmark. Si el
   * cuerpo del invitado llega hasta ahí, ese texto queda ilegible sobre el
   * torso — y eso salió publicado.
   *
   * La causa fue que el desvanecido estaba anclado al **borde inferior del
   * sujeto**, así que su posición se movía con `escalaSujeto`. Medido en su
   * momento: a 0.75 el alfa donde cae el rol era 1%, y a 1.15 era 85%.
   *
   * `escalaSujeto` la puede cambiar el agente desde Slack. Por eso esto se
   * verifica **a lo largo de todo el rango que la tool acepta**, no en el
   * default: un test que sólo probara el default habría pasado mientras el bug
   * estaba vivo.
   */
  it.each([0.5, 0.75, 1, 1.15, 1.4, 1.8])(
    "con escala %s deja transparente todo lo que está abajo del texto",
    async (escalaSujeto) => {
      const retrato = await prepararRetrato(await readFile("muestra/gr.png"), {
        ancho: ANCHO,
        alto: ALTO,
        escalaSujeto,
      });

      expect(await alfaEnFila(retrato, PISO)).toBeLessThan(0.02);
      expect(await alfaEnFila(retrato, 0.85)).toBeLessThan(0.02);
      expect(await alfaEnFila(retrato, 0.99)).toBeLessThan(0.02);
    },
    30_000,
  );

  /**
   * La otra mitad de la regla, y la que impide "arreglar" esto borrando media
   * foto: **arriba del piso el cuerpo tiene que seguir estando**. El nombre se
   * apoya sobre el pecho a propósito, y esa superposición es lo único que ancla
   * al invitado a la placa — es lo que reemplazó a la bandera de tela.
   *
   * Sin esta aserción, subir `pisoTexto` hasta borrar el torso pasaría el test
   * de arriba y rompería el diseño.
   */
  it("deja el cuerpo visible donde se apoya el nombre", async () => {
    const retrato = await prepararRetrato(await readFile("muestra/gr.png"), {
      ancho: ANCHO,
      alto: ALTO,
    });
    // La **mitad de arriba** del nombre, que arranca al 60%. El corte va a la
    // mitad del nombre (0.65), así que abajo de eso es negro a propósito: lo
    // que no puede pasar es que también desaparezca arriba, porque ahí es donde
    // el nombre se apoya sobre el pecho.
    expect(await alfaEnFila(retrato, 0.61)).toBeGreaterThan(0.2);
  }, 30_000);

  /**
   * El sujeto va centrado en horizontal. Anclado a un costado —como estaba en
   * el layout de dos columnas— la persona queda corrida respecto del nombre y
   * de la barra, que sí están centrados.
   */
  it("centra al sujeto en el cuadro", async () => {
    const retrato = await prepararRetrato(await readFile("muestra/gr.png"), {
      ancho: ANCHO,
      alto: ALTO,
    });
    const { data, info } = await sharp(retrato).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const y = Math.round(info.height * 0.3);
    let izquierda = 0;
    let derecha = 0;
    for (let x = 0; x < info.width; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (x < info.width / 2) izquierda += a;
      else derecha += a;
    }
    const desbalance = Math.abs(izquierda - derecha) / Math.max(izquierda, derecha);
    expect(desbalance).toBeLessThan(0.15);
  }, 30_000);
});
