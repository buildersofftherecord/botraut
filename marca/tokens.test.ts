import { describe, it, expect } from "vitest";
import { COLOR, HUD, FUENTE } from "./tokens";

describe("tokens", () => {
  it("los colores coinciden con landing/app/globals.css", () => {
    expect(COLOR.negro).toBe("#000000");
    expect(COLOR.carbon).toBe("#0a0a0a");
    expect(COLOR.gris).toBe("#141414");
    expect(COLOR.rojo).toBe("#ff2b2b");
    expect(COLOR.rojoHondo).toBe("#c81a1a");
    expect(COLOR.linea).toBe("rgba(255,255,255,0.1)");
  });

  it("el HUD coincide con .hud-corner y .hud-label", () => {
    expect(HUD.esquinaLado).toBe(26);
    expect(HUD.esquinaBorde).toBe(1);
    expect(HUD.esquinaColor).toBe("rgba(255,255,255,0.8)");
    expect(HUD.labelTamano).toBe(11);
    expect(HUD.labelTracking).toBe("0.16em");
  });

  it("los nombres de fuente coinciden con los de cargarFuentes()", () => {
    expect(FUENTE.display).toBe("Archivo");
    expect(FUENTE.mono).toBe("IBMPlexMono");
  });
});
