import { describe, it, expect } from "vitest";
import { renderizar, DATOS_DEMO } from "./Placa";
import { pixelEn, medidas } from "../test/pixel";

describe("renderizar", () => {
  it("devuelve un PNG de 1080x1080", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1080 });
  });

  it("el fondo es negro", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Un punto del centro-izquierda, lejos de texto y de la foto.
    expect(await pixelEn(png, 30, 540)).toEqual([0, 0, 0]);
  });

  it("es determinista: dos renders dan bytes idénticos", async () => {
    const [a, b] = await Promise.all([
      renderizar(DATOS_DEMO, "1:1"),
      renderizar(DATOS_DEMO, "1:1"),
    ]);
    expect(a.equals(b)).toBe(true);
  });
});
