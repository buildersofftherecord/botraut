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

const PISO = 0.74;

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
    // 70% del lienzo, convertido a fracción del cuadro (que arranca al 6%).
    const dondeVaElNombre = (0.7 - 0.06) / 0.94;
    expect(await alfaEnFila(retrato, dondeVaElNombre)).toBeGreaterThan(0.2);
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
