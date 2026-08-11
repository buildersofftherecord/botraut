import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { renderizar } from "../Placa";
import { prepararRetrato } from "../primitivos/Retrato";
import { LIENZOS, altoDeFoto } from "../lienzos";
import { validarDatos } from "../datos";

const S = 2;

async function placaDeMuestra(): Promise<Buffer> {
  const l = LIENZOS["1:1"];
  const datos = validarDatos(JSON.parse(await readFile("muestra/gr.json", "utf8")));
  const foto = await prepararRetrato(await readFile("muestra/gr.png"), {
    ancho: l.ancho * S,
    alto: altoDeFoto(l) * S,
  });
  return renderizar(datos, "1:1", foto);
}

/** Máxima diferencia por subpíxel entre dos PNG del mismo tamaño. */
async function diferenciaMaxima(a: Buffer, b: Buffer): Promise<number> {
  const [ra, rb] = await Promise.all([
    sharp(a).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
    sharp(b).ensureAlpha().raw().toBuffer({ resolveWithObject: true }),
  ]);
  expect(ra.info.width, "los dos PNG tienen que medir lo mismo").toBe(rb.info.width);
  let max = 0;
  for (let i = 0; i < ra.data.length; i++) {
    const d = Math.abs(ra.data[i] - rb.data[i]);
    if (d > max) max = d;
  }
  return max;
}

describe("la placa", () => {
  /**
   * El golden file. `placa-actual.png` es el diseño aprobado; este test es lo
   * único que impide que cambie sin que nadie lo note.
   *
   * Si falla, mirá la placa antes de actualizarla: o rompiste algo, o el cambio
   * era a propósito y hay que correr `npm run actual` y revisar el resultado a
   * ojo. Regenerar el golden file sin mirarlo vacía este test.
   */
  it("sale idéntica al diseño aprobado en placa-actual.png", async () => {
    const generada = await placaDeMuestra();
    const aprobada = await readFile("placa-actual.png");
    expect(await diferenciaMaxima(generada, aprobada)).toBe(0);
  }, 60_000);

  /**
   * Sin esto no hay "los mismos templates siempre". Cualquier fuente de azar
   * —un `Math.random()` en una textura, un timestamp— haría que dos corridas de
   * los mismos datos dieran archivos distintos.
   */
  it("es determinista: dos corridas dan el mismo byte", async () => {
    const [a, b] = [await placaDeMuestra(), await placaDeMuestra()];
    expect(a.equals(b)).toBe(true);
  }, 60_000);

  it("sale a 1080×1080 en 1:1", async () => {
    const m = await sharp(await placaDeMuestra()).metadata();
    expect([m.width, m.height]).toEqual([1080, 1080]);
  }, 60_000);
});
