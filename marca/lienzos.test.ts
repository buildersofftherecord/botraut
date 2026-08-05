import { describe, it, expect } from "vitest";
import { LIENZOS, altoDeFoto, type NombreLienzo } from "./lienzos";

describe("lienzos", () => {
  it("el 1:1 es 1080x1080", () => {
    expect(LIENZOS["1:1"].ancho).toBe(1080);
    expect(LIENZOS["1:1"].alto).toBe(1080);
  });

  it("cada lienzo tiene la proporción que dice su nombre", () => {
    const esperado: Record<NombreLienzo, number> = {
      "1:1": 1 / 1,
      "4:5": 4 / 5,
      "9:16": 9 / 16,
      "16:9": 16 / 9,
    };
    for (const [nombre, l] of Object.entries(LIENZOS)) {
      const real = l.ancho / l.alto;
      expect(real).toBeCloseTo(esperado[nombre as NombreLienzo], 2);
    }
  });

  it("la foto nunca ocupa más de la mitad del ancho", () => {
    // Si supera 0.5 el bloque de tipografía no entra al lado.
    for (const l of Object.values(LIENZOS)) {
      expect(l.fotoAncho).toBeLessThanOrEqual(0.5);
      expect(l.fotoAncho).toBeGreaterThan(0);
    }
  });
});

describe("altoDeFoto", () => {
  /**
   * Valor concreto a propósito. `lib/foto.ts` y `lib/generar.ts` derivan los
   * dos de esta función, así que un test que compare esos dos entre sí pasa
   * siempre — sean cuales sean los números. Lo único que puede fijar el valor
   * es escribirlo.
   *
   * Si este test se pone rojo, el render cambió de encuadre: revisá que la
   * placa siga saliendo bien antes de actualizar el número.
   */
  it("lleva la silueta a 1269px en 4:5", () => {
    expect(altoDeFoto(LIENZOS["4:5"])).toBe(1269);
  });

  // El bug que motivó extraer esta función: `lib/foto.ts` validaba contra el
  // alto crudo del lienzo y rechazaba siluetas que el render iba a achicar
  // igual.
  it("es menor que el alto del lienzo, no igual", () => {
    for (const l of Object.values(LIENZOS)) {
      expect(altoDeFoto(l)).toBeLessThan(l.alto);
    }
  });
});
