import { describe, expect, it } from "vitest";
import { maquetarNombre } from "../medirNombre";
import { LIENZOS, anchoContenido } from "../lienzos";

const L = LIENZOS["1:1"];
const ANCHO = anchoContenido(L);

const maquetar = (nombre: string) =>
  maquetarNombre(nombre, ANCHO, L.nombreTamano, L.nombreMinimo);

/**
 * El nombre es el titular de la placa y su maqueta es la única pieza del
 * template que cambia de forma según el dato: una línea o dos, y a qué cuerpo.
 * Todo lo demás tiene geometría fija.
 *
 * Estos tests miden con la fuente real (Anton), igual que el render.
 */
describe("maquetarNombre", () => {
  /**
   * Una línea es el diseño. La referencia pone "GUILLERMO RAUCH" entero de lado
   * a lado, y esa horizontal larga es la que sostiene el pie de la placa.
   * Partirlo cuando entra en una sería romper el diseño para nada.
   */
  it.each(["Guillermo Rauch", "Francisco Veiras", "Naomi Onega"])(
    "deja %s en una línea",
    async (nombre) => {
      const { lineas } = await maquetar(nombre);
      expect(lineas).toEqual([nombre]);
    },
  );

  /**
   * El caso peor que el schema acepta: 24 caracteres. En una línea da 83px, que
   * no es ilegible pero se lee como cinta y no como titular. Partido llega a
   * 101.
   */
  it("parte en dos el nombre más largo que el schema acepta", async () => {
    const { lineas, tamano } = await maquetar("Juan Cruz Fernandez Ruiz");
    expect(lineas).toHaveLength(2);
    expect(tamano).toBeGreaterThan(L.nombreMinimo);
  });

  /**
   * El corte se elige por **ancho en píxeles**, no por cantidad de palabras ni
   * de letras. Lo que decide el cuerpo final es la línea más ancha, así que el
   * mejor corte es el que minimiza ese máximo.
   *
   * "Ana Maximiliano Etchecopar": partir por cantidad de palabras daría
   * ["Ana", "Maximiliano Etchecopar"] — una línea diminuta y otra enorme. El
   * corte por ancho tiene que dejar la palabra larga sola.
   */
  it("elige el corte que empareja los anchos, no las palabras", async () => {
    const { lineas } = await maquetar("Ana Maximiliano Etchecopar");
    expect(lineas).toEqual(["Ana Maximiliano", "Etchecopar"]);
  });

  /**
   * Sin espacios no hay dónde cortar. Entra chico, que es la única salida
   * honesta — y es el caso que el límite de 24 caracteres del schema existe
   * para que no llegue nunca.
   */
  it("nunca parte un nombre de una sola palabra", async () => {
    const { lineas } = await maquetar("Maximilianoetchecopar");
    expect(lineas).toHaveLength(1);
  });

  /**
   * Sin techo, "Bob" entraría a 583px y taparía media placa. El techo es lo
   * único que gobierna a los nombres cortos: a los largos los ata el ancho.
   */
  it("no deja que un nombre corto pase el techo del lienzo", async () => {
    const { tamano } = await maquetar("Bob");
    expect(tamano).toBe(L.nombreTamano);
  });

  /**
   * El piso es sobre la línea *única*, no sobre el resultado: si ni partido
   * llega, se parte igual porque igual es mejor. Lo que no puede pasar es que
   * partir empeore.
   */
  it("nunca parte si partir no agranda el cuerpo", async () => {
    const enUna = await maquetar("Guillermo Rauch");
    const { tamano } = await maquetarNombre("Guillermo Rauch", ANCHO, L.nombreTamano, 999);
    expect(tamano).toBeGreaterThanOrEqual(enUna.tamano);
  });

  /** El nombre no puede desbordar el ancho de la barra de datos: comparten eje. */
  it.each(["Bob", "Guillermo Rauch", "Juan Cruz Fernandez Ruiz"])(
    "%s entra en el ancho de contenido",
    async (nombre) => {
      const { lineas, tamano } = await maquetar(nombre);
      const { anchoTexto } = await import("../medirNombre");
      for (const linea of lineas) {
        expect(await anchoTexto(linea, tamano)).toBeLessThanOrEqual(ANCHO);
      }
    },
  );
});
