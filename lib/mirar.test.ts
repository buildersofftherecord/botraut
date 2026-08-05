import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@ai-sdk/google", () => ({ google: (m: string) => ({ modelId: m }) }));

const { mirarSilueta, PROMPT } = await import("./mirar");

/**
 * A propósito NO hay un `beforeEach(() => generateObject.mockClear())` acá
 * como en `buscar.test.ts` — `vitest.config.ts` ya trae `clearMocks: true`
 * global, y ese `beforeEach` extra resultó activamente roto para esta
 * suite: combinado con `mockRejectedValue` + `expect(...).rejects`, Vitest
 * 4.1.10 reporta la rejection como error no manejado del test ANTERIOR
 * aunque `.rejects.toThrow()` la haya capturado correctamente (reproducido
 * de forma aislada, sin sharp ni async de por medio: es el hook extra el
 * que dispara el falso positivo, no el orden de los tests ni la imagen).
 * `clearMocks: true` solo sin el hook manual alcanza y no lo tiene.
 */

async function unaSilueta(): Promise<Buffer> {
  return sharp({
    create: { width: 40, height: 60, channels: 4, background: { r: 10, g: 20, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("PROMPT", () => {
  it("rechaza cuando hay más de una persona", () => {
    expect(PROMPT.toLowerCase()).toMatch(/dos o más personas|más de una persona/);
  });

  it("pide medio cuerpo para arriba, no un primer plano de cara", () => {
    expect(PROMPT.toLowerCase()).toContain("medio cuerpo");
    expect(PROMPT.toLowerCase()).toMatch(/primer plano/);
  });

  it("pide de frente o de tres cuartos, no de espaldas", () => {
    const p = PROMPT.toLowerCase();
    expect(p).toContain("espaldas");
    expect(p).toMatch(/tres cuartos/);
  });

  it("pide que el recorte de fondo haya salido limpio", () => {
    expect(PROMPT.toLowerCase()).toMatch(/recorte.*sucio|pedazos de fondo/);
  });

  it("pide que se le vea bien la cara", () => {
    expect(PROMPT.toLowerCase()).toContain("cara");
  });

  it("es permisivo: instruye aceptar ante la duda", () => {
    const p = PROMPT.toLowerCase();
    expect(p).toMatch(/permisivo/);
    expect(p).toMatch(/ante la duda/);
  });

  it("pide el motivo en rioplatense, corto y accionable, con un ejemplo concreto", () => {
    expect(PROMPT.toLowerCase()).toContain("rioplatense");
    // El ejemplo del brief, para que quien lea el prompt tenga el estándar de
    // tono explícito, no solo la palabra "corto".
    expect(PROMPT).toContain("medio cuerpo");
    expect(PROMPT.toLowerCase()).toMatch(/no cumple los requisitos/);
  });
});

describe("mirarSilueta", () => {
  it("devuelve sirve:true cuando el modelo aprueba", async () => {
    generateObject.mockResolvedValue({ object: { sirve: true } });
    expect(await mirarSilueta(await unaSilueta())).toEqual({ sirve: true });
  });

  it("devuelve sirve:false con el motivo exacto que escribió el modelo", async () => {
    generateObject.mockResolvedValue({
      object: { sirve: false, motivo: "Se te ve solo la cara, mandame una de medio cuerpo" },
    });
    const v = await mirarSilueta(await unaSilueta());
    expect(v).toEqual({ sirve: false, motivo: "Se te ve solo la cara, mandame una de medio cuerpo" });
  });

  it("le manda los bytes de la silueta al modelo como imagen", async () => {
    generateObject.mockResolvedValue({ object: { sirve: true } });
    const png = await unaSilueta();

    await mirarSilueta(png);

    const llamada = generateObject.mock.calls[0][0];
    expect(llamada.messages[0].content[0]).toMatchObject({ type: "file", mediaType: "image/png", data: png });
  });

  it("usa el prompt del módulo como instructions", async () => {
    generateObject.mockResolvedValue({ object: { sirve: true } });
    await mirarSilueta(await unaSilueta());
    expect(generateObject.mock.calls[0][0].instructions).toBe(PROMPT);
  });

  it("si sirve:false llega sin motivo, usa un mensaje de respaldo en vez de dejarlo vacío", async () => {
    generateObject.mockResolvedValue({ object: { sirve: false } });
    const v = await mirarSilueta(await unaSilueta());
    expect(v.sirve).toBe(false);
    if (!v.sirve) expect(v.motivo.length).toBeGreaterThan(0);
  });

  it("propaga el error si generateObject falla (red, cuota, Gemini caído)", async () => {
    generateObject.mockRejectedValue(new Error("fetch failed"));
    await expect(mirarSilueta(await unaSilueta())).rejects.toThrow("fetch failed");
  });
});
