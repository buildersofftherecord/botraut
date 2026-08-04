import { describe, it, expect } from "vitest";
import { renderizar, DATOS_DEMO } from "./Placa";
import { pixelEn, medidas } from "../test/pixel";
import { etiquetaInvitado } from "../lib/tipos";

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

describe("marco HUD", () => {
  it("dibuja el corchete superior izquierdo", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Sobre el borde superior del corchete: casi blanco (alpha 0.8 sobre negro).
    const [r, g, b] = await pixelEn(png, 45, 40);
    expect(r).toBeGreaterThan(180);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("dibuja el corchete inferior derecho", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    const [r] = await pixelEn(png, 1035, 1039);
    expect(r).toBeGreaterThan(180);
  });

  it("el punto REC es rojo", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Centro del punto, a la derecha de la palabra REC.
    const [r, g, b] = await pixelEn(png, 108, 52);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });
});

describe("bloque de tipografía", () => {
  it("dibuja el nombre en blanco", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Zona del nombre. Se busca cualquier píxel claro en una franja
    // horizontal, porque la posición exacta de una asta depende del shaping.
    // y=280 cae sobre el cuerpo de la primera línea ("NAOMI"); y=340 del plan
    // original caía en el hueco entre líneas y siempre daba 0 (medido, no a ojo).
    let claros = 0;
    for (let x = 70; x < 520; x += 4) {
      const [r] = await pixelEn(png, x, 280);
      if (r > 200) claros++;
    }
    expect(claros).toBeGreaterThan(5);
  });

  it("la etiqueta de género sale del dato, no del template", () => {
    expect(etiquetaInvitado("f")).toBe("INVITADA");
    expect(etiquetaInvitado("m")).toBe("INVITADO");
    expect(etiquetaInvitado("x")).toBe("INVITADX");
  });
});
