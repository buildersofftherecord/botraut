import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { slugDe, modelo } from "./modelos";

const VARIABLES = ["MODELO_AGENTE", "MODELO_COPY", "MODELO_VISION", "MODELO_ENCUADRE"];

let original: Record<string, string | undefined>;

beforeEach(() => {
  original = Object.fromEntries(VARIABLES.map((v) => [v, process.env[v]]));
  for (const v of VARIABLES) delete process.env[v];
});

afterEach(() => {
  for (const v of VARIABLES) {
    if (original[v] === undefined) delete process.env[v];
    else process.env[v] = original[v];
  }
});

describe("slugDe", () => {
  it("sin entorno, cada rol cae en su default probado", () => {
    expect(slugDe("agente")).toBe("gemini-3.5-flash-lite");
    expect(slugDe("copy")).toBe("gemini-3.5-flash-lite");
    expect(slugDe("vision")).toBe("gemini-3.5-flash");
    expect(slugDe("encuadre")).toBe("gemini-3.5-flash-lite");
  });

  it("la variable del rol gana sobre el default", () => {
    process.env.MODELO_VISION = "gemini-3.6-flash";
    expect(slugDe("vision")).toBe("gemini-3.6-flash");
  });

  /**
   * Compatibilidad con lo que ya está desplegado: hasta este refactor el agente
   * y el encuadre leían `MODELO_COPY`. Si alguien la tiene puesta en Vercel,
   * tiene que seguir mandando o el deploy cambiaría de modelo en silencio.
   */
  it("agente y encuadre siguen heredando MODELO_COPY", () => {
    process.env.MODELO_COPY = "gemini-3.6-flash";
    expect(slugDe("agente")).toBe("gemini-3.6-flash");
    expect(slugDe("encuadre")).toBe("gemini-3.6-flash");
  });

  it("MODELO_AGENTE le gana a MODELO_COPY para el agente", () => {
    process.env.MODELO_COPY = "gemini-3.5-flash-lite";
    process.env.MODELO_AGENTE = "anthropic/claude-sonnet-5";
    expect(slugDe("agente")).toBe("anthropic/claude-sonnet-5");
    expect(slugDe("copy")).toBe("gemini-3.5-flash-lite");
  });

  /**
   * Visión NO hereda de copy: su default es `flash` y no `flash-lite` porque
   * juzgar una imagen es más duro que redactar un rol. Si heredara, poner
   * `MODELO_COPY` para abaratar el copy degradaría la validación de fotos sin
   * que nadie lo pida.
   */
  it("vision no hereda MODELO_COPY", () => {
    process.env.MODELO_COPY = "gemini-3.5-flash-lite";
    expect(slugDe("vision")).toBe("gemini-3.5-flash");
  });

  /**
   * `.env.example` lista `MODELO_COPY=` sin valor. Copiarlo a `.env.local`
   * dejaba la variable en `""`, que el `??` de antes daba por buena: se
   * terminaba llamando a `google("")`.
   */
  it("una variable vacía o en blanco cuenta como no configurada", () => {
    process.env.MODELO_COPY = "";
    expect(slugDe("copy")).toBe("gemini-3.5-flash-lite");
    process.env.MODELO_COPY = "   ";
    expect(slugDe("copy")).toBe("gemini-3.5-flash-lite");
  });
});

describe("modelo", () => {
  /**
   * El contrato agnóstico: la barra decide por dónde sale. Un slug
   * `proveedor/modelo` se pasa como string y lo resuelve el proveedor global
   * (AI Gateway); uno pelado construye el proveedor de Google.
   *
   * Esto es lo que hace que migrar a Gateway sea cambiar variables de entorno
   * en Vercel y no tocar código.
   */
  it("un slug con barra se pasa tal cual, para que lo resuelva el Gateway", () => {
    process.env.MODELO_COPY = "anthropic/claude-sonnet-5";
    expect(modelo("copy")).toBe("anthropic/claude-sonnet-5");
  });

  it("un slug pelado construye el proveedor de Google", () => {
    process.env.MODELO_COPY = "gemini-3.5-flash-lite";
    const m = modelo("copy");
    expect(typeof m).not.toBe("string");
    expect((m as { modelId: string }).modelId).toBe("gemini-3.5-flash-lite");
  });

  it("el default también sale por Google, no por el Gateway", () => {
    expect(typeof modelo("vision")).not.toBe("string");
  });
});
