import { describe, it, expect, vi, beforeEach } from "vitest";

const generateObject = vi.fn();
vi.mock("ai", () => ({ generateObject }));
vi.mock("@ai-sdk/google", () => ({ google: () => "modelo-falso" }));

const { clasificar, IntencionSchema } = await import("./intencion");

beforeEach(() => {
  generateObject.mockResolvedValue({ object: { tipo: "corregir" } });
});

describe("IntencionSchema", () => {
  it("acepta las cinco categorías", () => {
    for (const tipo of ["corregir", "confirmar", "reiniciar", "pedido", "otro"]) {
      expect(IntencionSchema.parse({ tipo }).tipo).toBe(tipo);
    }
  });

  // El schema es el contrato con el modelo: si devuelve algo fuera de la lista,
  // tiene que romper acá y no llegar al `switch` de bot.tsx como un valor que
  // ninguna rama contempla.
  it("rechaza una categoría inventada", () => {
    expect(() => IntencionSchema.parse({ tipo: "recortar" })).toThrow();
  });
});

describe("clasificar", () => {
  it("devuelve el tipo que dio el modelo", async () => {
    generateObject.mockResolvedValue({ object: { tipo: "confirmar" } });
    expect(await clasificar("usa esa")).toBe("confirmar");
  });

  // Degradar al camino viejo, no dejar al humano sin respuesta. Antes de que
  // existiera esta función todo texto era una corrección; si el clasificador
  // se cae, volver a eso es peor que el silencio pero mejor que un error.
  it("si el modelo falla, cae en corregir en vez de tirar", async () => {
    generateObject.mockRejectedValue(new Error("429 cuota agotada"));
    expect(await clasificar("no, es founder de Awana")).toBe("corregir");
  });

  it("si el modelo devuelve basura, también cae en corregir", async () => {
    generateObject.mockResolvedValue({ object: { tipo: "cualquier-cosa" } });
    expect(await clasificar("dale")).toBe("corregir");
  });

  it("le pasa el mensaje del humano al modelo", async () => {
    await clasificar("no, es founder de Awana");
    expect(generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ prompt: expect.stringContaining("founder de Awana") }),
    );
  });
});
