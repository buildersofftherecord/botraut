import { describe, it, expect } from "vitest";
import { EstadoThreadSchema } from "./estado";

const copy = {
  rol: "AI Engineering en UdeSA y Data & AI en Ualá",
  genero: "f",
  fuentes: ["https://ejemplo.com/n"],
};

describe("EstadoThreadSchema", () => {
  it("acepta un estado bien formado", () => {
    const estado = { nombre: "Naomi Couriel", copy };
    expect(EstadoThreadSchema.parse(estado)).toEqual(estado);
  });

  // Límite exacto: sin este caso, un `.max(24)` corrido a `.max(23)` por error
  // pasaría todos los tests igual — ningún otro fixture toca el borde.
  it("acepta un nombre de exactamente 24 caracteres", () => {
    const nombre = "a".repeat(24);
    expect(() => EstadoThreadSchema.parse({ nombre, copy })).not.toThrow();
  });

  it("rechaza un nombre de más de 24 caracteres", () => {
    const nombre = "a".repeat(25);
    expect(() => EstadoThreadSchema.parse({ nombre, copy })).toThrow();
  });

  it("rechaza lo que vuelve de Redis mal formado", () => {
    expect(() => EstadoThreadSchema.parse(JSON.parse('{"nombre":null}'))).toThrow();
  });

  // Un `copy: z.any()` (o cualquier degradación de CopySchema) dejaría pasar
  // esto igual que los casos de arriba, porque ninguno manda un copy inválido
  // junto a un nombre válido. Este es el único que lo hace.
  it("rechaza un copy incompleto aunque el nombre sea válido", () => {
    // Falta `rol`, que es el único campo del copy sin default: `fuentes`
    // ahora vale vacío a propósito, porque exigir una URL obligaba al modelo
    // a inventarla.
    const copyIncompleto = { genero: "f", fuentes: [] };
    expect(() =>
      EstadoThreadSchema.parse({ nombre: "Naomi Couriel", copy: copyIncompleto }),
    ).toThrow();
  });

  // El caso normal entre el turno 1 y el 2: el estado existe sin foto
  // todavía. Sin `.optional()` esto rechazaría lo que ya está en producción.
  it("acepta un estado sin foto", () => {
    const estado = { nombre: "Naomi Couriel", copy };
    expect(() => EstadoThreadSchema.parse(estado)).not.toThrow();
  });

  it("acepta un estado con foto bien formada", () => {
    const foto = { url: "https://files.slack.com/foto.jpg", fuente: "Naomi", ancho: 1200, alto: 1600 };
    const estado = { nombre: "Naomi Couriel", copy, foto };
    expect(EstadoThreadSchema.parse(estado)).toEqual(estado);
  });

  // Igual que con `copy`: sin este caso, un `foto: z.any()` (o sacarle el
  // `.min(800)` a `FotoSchema`) pasaría todos los demás tests igual, porque
  // ninguno manda una foto inválida junto a un nombre y copy válidos.
  it("rechaza una foto por debajo del mínimo aunque el resto sea válido", () => {
    const fotoChica = { url: "https://files.slack.com/foto.jpg", ancho: 400, alto: 400 };
    expect(() =>
      EstadoThreadSchema.parse({ nombre: "Naomi Couriel", copy, foto: fotoChica }),
    ).toThrow();
  });
});
