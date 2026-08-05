import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { validarFoto } from "./foto";

async function imagen(ancho: number, alto: number): Promise<Buffer> {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 90, g: 90, b: 90 } },
  })
    .jpeg()
    .toBuffer();
}

describe("validarFoto", () => {
  it("acepta una foto vertical y grande", async () => {
    const r = await validarFoto(await imagen(1200, 1600));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.foto).toEqual({ ancho: 1200, alto: 1600 });
  });

  it("acepta exactamente en el mínimo", async () => {
    // El borde de aceptación importa tanto como el de rechazo: un off-by-one
    // que subiera el mínimo a 801 rechazaría fotos que sirven.
    expect((await validarFoto(await imagen(800, 800))).ok).toBe(true);
  });

  it("rechaza una foto que se va a pixelar, y dice el ancho real", async () => {
    const r = await validarFoto(await imagen(480, 640));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("480");
      expect(r.motivo.toLowerCase()).toContain("pixel");
    }
  });

  it("rechaza panorámicas explicando que no hay silueta", async () => {
    const r = await validarFoto(await imagen(2400, 900));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo.toLowerCase()).toMatch(/apaisada|horizontal|medio cuerpo/);
  });

  it("rechaza lo que no es una imagen sin explotar", async () => {
    const r = await validarFoto(Buffer.from("esto no es una imagen"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
  });

  it("el motivo nunca es un mensaje de error crudo de librería", async () => {
    // Se le muestra a una persona en Slack. `Input buffer contains
    // unsupported image format` no le sirve a nadie.
    const r = await validarFoto(Buffer.from("xx"));
    if (!r.ok) {
      expect(r.motivo).not.toMatch(/Input buffer|unsupported image format|Error:/);
    }
  });
});
