import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { generarFijo, rutaFijo } from "../primitivos/Fijo";
import { SUPERMUESTREO } from "../Placa";
import { LIENZOS, type NombreLienzo } from "../lienzos";

const lienzos = Object.keys(LIENZOS) as NombreLienzo[];

describe("la capa fija horneada", () => {
  /**
   * Este es el test que hace que hornear valga la pena en vez de ser un riesgo.
   *
   * Una capa horneada se desactualiza **en silencio**: alguien baja
   * `FONDO.opacidad`, corre `npm run actual`, la placa sale igual que antes
   * porque sigue leyendo el PNG viejo, y el token nuevo no hace nada. Nadie se
   * entera hasta que alguien compara a ojo meses después.
   */
  it.each(lienzos)("%s coincide con lo que produce generarFijo hoy", async (lienzo) => {
    const enDisco = await readFile(rutaFijo(lienzo));
    const recienGenerada = await generarFijo(lienzo, SUPERMUESTREO);
    expect(
      enDisco.equals(recienGenerada),
      `fijo/${lienzo.replace(":", "x")}.png quedó viejo. Corré \`npm run hornear\`.`,
    ).toBe(true);
  }, 120_000);

  /**
   * Que la capa fija sea fija de verdad. Si esto falla, hay algo dependiente
   * del reloj o del azar adentro y el horneado no sirve para nada.
   */
  it("es determinista", async () => {
    const [a, b] = [await generarFijo("1:1", SUPERMUESTREO), await generarFijo("1:1", SUPERMUESTREO)];
    expect(a.equals(b)).toBe(true);
  }, 120_000);
});
