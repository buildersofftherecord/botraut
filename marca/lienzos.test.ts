import { describe, it, expect } from "vitest";
import { LIENZOS, type NombreLienzo } from "./lienzos";

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
