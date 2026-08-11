import { describe, expect, it } from "vitest";
import { encuadrar, medidaCoherente, OBJETIVO, type MedidaCara } from "../encuadre";

/** Una medida plausible, para partir de algo válido y romper un campo por vez. */
const CARA: MedidaCara = { arriba: 0.05, abajo: 0.5, ojos: 0.25, centro: 0.5 };

describe("encuadrar", () => {
  /**
   * La propiedad que justifica todo esto: **fotos con encuadres de origen
   * distintos tienen que converger al mismo tamaño de cara**.
   *
   * Es lo que `escalaSujeto` sola no puede dar. Escala la silueta entera, así
   * que con el mismo número un plano de busto da una cabeza enorme y uno de
   * medio cuerpo una chica. Medido con el modelo sobre tres recortes del mismo
   * sujeto: cabeza al 45.8%, 72.9% y 21.8% de la foto → escalas 0.97, 0.61 y
   * 2.04. Los tres dan la misma cara en la placa.
   */
  it.each([
    ["plano cerrado", 0.05, 0.77],
    ["plano de busto", 0.05, 0.5],
    ["plano abierto", 0.05, 0.27],
  ])("con %s la cabeza termina midiendo lo mismo en el lienzo", (_caso, arriba, abajo) => {
    const { escalaSujeto } = encuadrar({ ...CARA, arriba, abajo, ojos: (arriba + abajo) / 2 });

    // La cabeza ocupa `abajo - arriba` de la foto; la foto se lleva a
    // `escalaSujeto` del lienzo. El producto es cuánto ocupa en el lienzo.
    const enElLienzo = (abajo - arriba) * escalaSujeto;
    expect(enElLienzo).toBeCloseTo(OBJETIVO.altoCabeza, 5);
  });

  /** La escala es inversamente proporcional al tamaño de la cabeza en la foto. */
  it("achica cuando la cabeza ya es grande en la foto", () => {
    const chica = encuadrar({ ...CARA, arriba: 0.05, abajo: 0.25 }).escalaSujeto;
    const grande = encuadrar({ ...CARA, arriba: 0.05, abajo: 0.65 }).escalaSujeto;
    expect(chica).toBeGreaterThan(grande);
  });

  /**
   * Los topes convierten una medición disparatada en una placa fea, no en un
   * error. Sin ellos, una cabeza medida al 3% pediría escala 15 y el render
   * intentaría una foto de 16000px de alto.
   */
  it("no deja que una medida absurda pida una escala imposible", () => {
    const enorme = encuadrar({ ...CARA, arriba: 0, abajo: 0.02 }).escalaSujeto;
    const minima = encuadrar({ ...CARA, arriba: 0, abajo: 0.99 }).escalaSujeto;
    expect(enorme).toBeLessThanOrEqual(3);
    expect(minima).toBeGreaterThanOrEqual(0.35);
  });

  /** El objetivo se pasa entero al pegado, sin que `encuadrar` lo reinterprete. */
  it("lleva el objetivo de ojos y centro tal cual", () => {
    const { cara } = encuadrar(CARA);
    expect(cara.ojosEn).toBe(OBJETIVO.ojos);
    expect(cara.centroEn).toBe(OBJETIVO.centro);
    expect(cara.ojos).toBe(CARA.ojos);
    expect(cara.centro).toBe(CARA.centro);
  });
});

describe("medidaCoherente", () => {
  /**
   * El schema del modelo acepta cualquier número en rango, así que una respuesta
   * bien formada puede ser absurda. Esto separa "el modelo respondió" de "el
   * modelo midió algo", y es lo que decide si se le cree o se usa el default.
   */
  it("acepta una medida plausible", () => {
    expect(medidaCoherente(CARA)).toBe(true);
  });

  it.each([
    ["los ojos arriba del pelo", { ojos: 0.01 }],
    ["los ojos abajo del mentón", { ojos: 0.8 }],
    ["el mentón arriba de la coronilla", { arriba: 0.6, abajo: 0.2 }],
    ["una cabeza de menos del 4%", { arriba: 0.5, abajo: 0.52, ojos: 0.51 }],
    ["una cabeza que ocupa casi toda la foto", { arriba: 0.01, abajo: 0.99, ojos: 0.5 }],
    ["un centro fuera de la imagen", { centro: 1.4 }],
  ])("rechaza %s", (_caso, cambio) => {
    expect(medidaCoherente({ ...CARA, ...cambio })).toBe(false);
  });
});
