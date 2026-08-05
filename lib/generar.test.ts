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
vi.mock("./silueta", () => ({
  recortarASilueta: vi.fn(async () => {
    orden.push("silueta");
    return { png: Buffer.from("e"), ancho: 1, alto: 1 };
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
  it("corre el pipeline en orden: recorta el fondo, después a silueta, después B/N, después el resize", async () => {
    // Fija el orden completo del pipeline (Task 22b agrega "silueta" entre
    // "recortar" y "byn"): tiene que seguir fallando si alguien mueve el
    // recorte de fondo o el recorte a silueta después del blanco y negro.
    orden.length = 0;
    await generarPlaca(DATOS_DEMO);
    expect(orden).toEqual(["descargar", "recortar", "silueta", "byn", "resize", "render"]);
  });

  it("devuelve el PNG que produjo el render", async () => {
    const { png } = await generarPlaca(DATOS_DEMO);
    expect(png.toString()).toBe("png");
  });

  // La URL de la foto es un archivo privado de Slack (ver procesar.ts):
  // sin este header, `descargar` recibe el HTML de la página de login en
  // vez de la foto.
  it("le pasa el header de autenticación de Slack a descargar", async () => {
    const original = process.env.SLACK_BOT_TOKEN;
    process.env.SLACK_BOT_TOKEN = "xoxb-test-123";
    try {
      const { descargar } = await import("./procesar");
      await generarPlaca(DATOS_DEMO);
      expect(descargar).toHaveBeenCalledWith(DATOS_DEMO.fotoElegida.url, {
        Authorization: "Bearer xoxb-test-123",
      });
    } finally {
      process.env.SLACK_BOT_TOKEN = original;
    }
  });

  it("sin SLACK_BOT_TOKEN no manda un header inventado", async () => {
    const original = process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_BOT_TOKEN;
    try {
      const { descargar } = await import("./procesar");
      await generarPlaca(DATOS_DEMO);
      expect(descargar).toHaveBeenCalledWith(DATOS_DEMO.fotoElegida.url, undefined);
    } finally {
      process.env.SLACK_BOT_TOKEN = original;
    }
  });
});
