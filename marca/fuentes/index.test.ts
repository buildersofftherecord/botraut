import { describe, it, expect } from "vitest";
import { cargarFuentes } from "./index";

describe("cargarFuentes", () => {
  it("devuelve las dos fuentes que usa la placa", async () => {
    const fuentes = await cargarFuentes();
    expect(fuentes.map((f) => f.name).sort()).toEqual(["Archivo", "IBMPlexMono"]);
  });

  it("cada una es un TrueType válido", async () => {
    const fuentes = await cargarFuentes();
    for (const f of fuentes) {
      // Los TTF arrancan con 0x00010000 (sfnt). Si el curl trajo un HTML de
      // error en vez del binario, esto lo agarra.
      expect(f.data.readUInt32BE(0)).toBe(0x00010000);
      expect(f.data.length).toBeGreaterThan(50_000);
    }
  });
});
