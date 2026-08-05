import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import sharp from "sharp";
import { descargar, aBlancoYNegro, ajustarAlto } from "./procesar";
import { pixelEn, medidas } from "../test/pixel";

async function rojo(): Promise<Buffer> {
  return sharp({
    create: { width: 200, height: 400, channels: 4, background: { r: 220, g: 30, b: 30, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("aBlancoYNegro", () => {
  it("deja los tres canales iguales", async () => {
    const [r, g, b] = await pixelEn(await aBlancoYNegro(await rojo()), 100, 200);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("conserva la transparencia", async () => {
    const conAlpha = await sharp({
      create: { width: 50, height: 50, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    const salida = await aBlancoYNegro(conAlpha);
    expect((await sharp(salida).metadata()).hasAlpha).toBe(true);
  });
});

describe("ajustarAlto", () => {
  it("lleva la imagen al alto pedido manteniendo la proporción", async () => {
    const { ancho, alto } = await medidas(await ajustarAlto(await rojo(), 800));
    expect(alto).toBe(800);
    expect(ancho).toBe(400);
  });
});

describe("descargar", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("devuelve los bytes de una descarga exitosa", async () => {
    const cuerpo = new Uint8Array([1, 2, 3, 4]).buffer;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "4" }),
      arrayBuffer: async () => cuerpo,
    } as Response);

    const bytes = await descargar("https://ejemplo.com/foto.jpg");
    expect(Buffer.from(bytes)).toEqual(Buffer.from([1, 2, 3, 4]));
  });

  it("rechaza si la respuesta HTTP no es ok", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: false,
      status: 404,
      headers: new Headers(),
    } as Response);

    await expect(descargar("https://ejemplo.com/no-existe.jpg")).rejects.toThrow(/404/);
  });

  it("rechaza si content-length supera el máximo", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "20000000" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    await expect(descargar("https://ejemplo.com/gigante.jpg")).rejects.toThrow(/demasiado/);
  });

  it("rechaza si el cuerpo supera el máximo aunque no venga content-length", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers(), // sin content-length: el chequeo previo no alcanza
      arrayBuffer: async () => new ArrayBuffer(15_000_001),
    } as Response);

    await expect(descargar("https://ejemplo.com/sin-content-length.jpg")).rejects.toThrow(/demasiado/);
  });

  it("no llama a fetch con una URL distinta a la pedida", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "4" }),
      arrayBuffer: async () => new Uint8Array([9, 9, 9, 9]).buffer,
    } as Response);

    await descargar("https://ejemplo.com/foto.jpg");
    expect(fetch).toHaveBeenCalledWith("https://ejemplo.com/foto.jpg");
  });
});
