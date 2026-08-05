import { describe, it, expect, vi } from "vitest";

const orden: string[] = [];

vi.mock("./procesar", () => ({
  descargar: vi.fn(async () => {
    orden.push("descargar");
    return Buffer.from("a");
  }),
  aBlancoYNegro: vi.fn(async () => {
    orden.push("byn");
    return Buffer.from("b");
  }),
  ajustarAlto: vi.fn(async () => {
    orden.push("resize");
    return Buffer.from("c");
  }),
}));
vi.mock("./recorte", () => ({
  recortar: vi.fn(async () => {
    orden.push("recortar");
    return Buffer.from("d");
  }),
}));
vi.mock("../marca/Placa", () => ({
  renderizar: vi.fn(async () => {
    orden.push("render");
    return Buffer.from("png");
  }),
}));

const { generarPlaca } = await import("./generar");
const { DATOS_DEMO } = await import("./demo");

describe("generarPlaca", () => {
  it("corre el pipeline en orden: recorta antes de B/N, B/N antes del resize", async () => {
    orden.length = 0;
    await generarPlaca(DATOS_DEMO);
    expect(orden).toEqual(["descargar", "recortar", "byn", "resize", "render"]);
  });

  it("devuelve el PNG que produjo el render", async () => {
    const { png } = await generarPlaca(DATOS_DEMO);
    expect(png.toString()).toBe("png");
  });
});
