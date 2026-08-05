import { describe, it, expect } from "vitest";
import { EstadoThreadSchema } from "./estado";

const FOTO = {
  url: "https://files.slack.com/files-pri/T0/F0/guillermo.png",
  fuente: "U0BMV11HNH2",
  ancho: 848,
  alto: 1264,
};

describe("EstadoThreadSchema", () => {
  it("acepta un estado con la foto guardada", () => {
    expect(EstadoThreadSchema.parse({ foto: FOTO }).foto).toEqual(FOTO);
  });

  // El caso normal antes de que el humano suba nada: el thread existe y
  // todavía no hay foto. Sin `.optional()` esto rechazaría media conversación.
  it("acepta un estado vacío", () => {
    expect(EstadoThreadSchema.parse({}).foto).toBeUndefined();
  });

  /**
   * El bug que motivó reescribir este schema: pedía `nombre` y `copy`, que el
   * agente dejó de escribir cuando la conversación pasó a ser la memoria. Un
   * estado con la foto guardada fallaba el parseo, y `generar_placa` traducía
   * ese fallo a "no hay foto validada" — mintiéndole al humano, que la había
   * subido bien.
   */
  it("no exige nombre ni copy: eso vive en la conversación", () => {
    expect(() => EstadoThreadSchema.parse({ foto: FOTO })).not.toThrow();
  });

  // De Redis vuelve JSON sin tipo. Si esto pasara, una foto a medias llegaría
  // como `any` hasta romper adentro del render, lejos de la causa.
  it("rechaza una foto sin las medidas", () => {
    expect(() => EstadoThreadSchema.parse({ foto: { url: FOTO.url } })).toThrow();
  });

  it("rechaza una foto con una url que no es url", () => {
    expect(() => EstadoThreadSchema.parse({ foto: { ...FOTO, url: "guillermo.png" } })).toThrow();
  });

  it("rechaza lo que vuelve de Redis mal formado", () => {
    expect(() => EstadoThreadSchema.parse(JSON.parse('{"foto":null}'))).toThrow();
  });
});
