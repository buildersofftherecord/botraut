import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObject = vi.hoisted(() => vi.fn());
vi.mock("ai", () => ({ generateObject }));
vi.mock("@ai-sdk/google", () => ({ google: (m: string) => ({ modelId: m }) }));

const { buscarCopy, rehacerCopy, PROMPT } = await import("./buscar");

// Sin esto, `mock.calls[0]` de un test tardío apunta al primer llamado de todo
// el archivo, no al propio — un test puede pasar leyendo la llamada de otro.
beforeEach(() => generateObject.mockClear());

const copyOk = {
  rol: "AI Engineering en UdeSA y Data & AI en Ualá",
  genero: "f" as const,
  fuentes: ["https://ejemplo.com/naomi"],
};

describe("PROMPT", () => {
  it("le pasa el límite de caracteres del rol", () => {
    // Atado a "caracteres" para no pasar por coincidencia con un "70" suelto
    // (una URL, un año) en otra parte del texto.
    expect(PROMPT).toMatch(/70 caracteres/);
  });

  it("pide castellano rioplatense y prohíbe el tono de bio corporativa", () => {
    expect(PROMPT.toLowerCase()).toContain("rioplatense");
    expect(PROMPT.toLowerCase()).toContain("linkedin");
  });

  it("es conservador: prefiere impreciso a inventado", () => {
    // El spike midió que el modelo completa con algo plausible antes que
    // admitir que no sabe. Ver docs/decisiones/003.
    const p = PROMPT.toLowerCase();
    expect(p).toMatch(/no invent|no_encontrado|preferí|impreciso|vago/);
  });

  it("no le pide el nombre — ese es verbatim del humano", () => {
    expect(PROMPT).not.toMatch(/devolvé.*\bnombre\b/i);
  });
});

describe("buscarCopy", () => {
  it("devuelve el copy validado", async () => {
    generateObject.mockResolvedValue({ object: copyOk });
    expect((await buscarCopy("Naomi Couriel")).rol).toContain("UdeSA");
  });

  it("le pasa el nombre al modelo como contexto", async () => {
    generateObject.mockResolvedValue({ object: copyOk });
    await buscarCopy("Naomi Couriel");
    expect(generateObject.mock.calls[0][0].prompt).toContain("Naomi Couriel");
  });

  it("propaga el error si el modelo devuelve algo que no valida", async () => {
    generateObject.mockResolvedValue({ object: { rol: "x".repeat(80), genero: "f", fuentes: [] } });
    await expect(buscarCopy("X")).rejects.toThrow();
  });
});

describe("rehacerCopy", () => {
  it("le pasa el rol anterior y la corrección del humano", async () => {
    generateObject.mockResolvedValue({ object: copyOk });
    await rehacerCopy("Naomi Couriel", { ...copyOk, rol: "VP of Product en Lightspark" }, "no, está en UdeSA y Ualá");
    const enviado = generateObject.mock.calls[0][0].prompt;
    expect(enviado).toContain("VP of Product en Lightspark");
    expect(enviado).toContain("no, está en UdeSA y Ualá");
  });
});
