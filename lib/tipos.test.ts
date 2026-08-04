import { describe, it, expect } from "vitest";
import { InvitadoSchema, FotoSchema, PlacaSchema } from "./tipos";

const invitadoOk = {
  nombre: "Naomi Couriel",
  rol: "AI Engineering en UdeSA y Data & AI en Ualá",
  genero: "f" as const,
  fuentes: ["https://ejemplo.com/naomi"],
};

const fotoOk = {
  url: "https://ejemplo.com/foto.jpg",
  fuente: "https://ejemplo.com/nota",
  ancho: 1200,
  alto: 1600,
};

describe("InvitadoSchema", () => {
  it("acepta un invitado bien formado", () => {
    expect(InvitadoSchema.parse(invitadoOk).nombre).toBe("Naomi Couriel");
  });

  it("rechaza un nombre que no entra en dos líneas", () => {
    const largo = { ...invitadoOk, nombre: "A".repeat(25) };
    expect(() => InvitadoSchema.parse(largo)).toThrow();
  });

  it("rechaza un rol que desborda el bloque de texto", () => {
    const largo = { ...invitadoOk, rol: "B".repeat(71) };
    expect(() => InvitadoSchema.parse(largo)).toThrow();
  });

  it("rechaza un género fuera del enum", () => {
    expect(() => InvitadoSchema.parse({ ...invitadoOk, genero: "otro" })).toThrow();
  });
});

describe("FotoSchema", () => {
  it("acepta una foto grande", () => {
    expect(FotoSchema.parse(fotoOk).ancho).toBe(1200);
  });

  it("rechaza una foto que se va a pixelar", () => {
    expect(() => FotoSchema.parse({ ...fotoOk, ancho: 400 })).toThrow();
  });
});

describe("PlacaSchema", () => {
  it("acepta una placa completa", () => {
    const placa = PlacaSchema.parse({
      invitado: invitadoOk,
      fotoElegida: fotoOk,
      fecha: "JUEVES 30 DE JULIO",
      hora: "21:00 HS",
      enVivo: true,
    });
    expect(placa.enVivo).toBe(true);
  });
});
