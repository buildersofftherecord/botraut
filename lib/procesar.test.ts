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

/**
 * `metadata().hasAlpha` solo confirma que existe un cuarto canal — una
 * imagen forzada a 100% opaca (`removeAlpha().ensureAlpha(1)`) también lo
 * tiene y ese chequeo no lo detecta. Esto lee el byte real.
 */
async function alfaEn(png: Buffer, x: number, y: number): Promise<number> {
  const { data } = await sharp(png)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[3];
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
    expect(await alfaEn(salida, 25, 25)).toBe(0);
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
      headers: new Headers({ "content-length": "4", "content-type": "image/jpeg" }),
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
      headers: new Headers({ "content-length": "20000000", "content-type": "image/jpeg" }),
      arrayBuffer: async () => new ArrayBuffer(0),
    } as Response);

    await expect(descargar("https://ejemplo.com/gigante.jpg")).rejects.toThrow(/demasiado/);
  });

  it("rechaza si el cuerpo supera el máximo aunque no venga content-length", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/jpeg" }), // sin content-length: el chequeo previo no alcanza
      arrayBuffer: async () => new ArrayBuffer(15_000_001),
    } as Response);

    await expect(descargar("https://ejemplo.com/sin-content-length.jpg")).rejects.toThrow(/demasiado/);
  });

  it("no llama a fetch con una URL distinta a la pedida", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "4", "content-type": "image/jpeg" }),
      arrayBuffer: async () => new Uint8Array([9, 9, 9, 9]).buffer,
    } as Response);

    await descargar("https://ejemplo.com/foto.jpg");
    expect(fetch).toHaveBeenCalledWith("https://ejemplo.com/foto.jpg");
  });

  // El caso que motiva esta task: Slack no devuelve 401 cuando falta el auth
  // header, devuelve 200 con el HTML de la página de login. Sin este chequeo,
  // ese HTML se cuela como si fueran los bytes de la foto y el error
  // reventaría recién adentro de `sharp`, lejos de la causa real.
  it("rechaza una respuesta 200 que no es una imagen (HTML de login, sin auth)", async () => {
    const html = new TextEncoder().encode("<html><body>Sign in to Slack</body></html>").buffer;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "text/html; charset=utf-8" }),
      arrayBuffer: async () => html,
    } as Response);

    await expect(descargar("https://files.slack.com/foto-privada.jpg")).rejects.toThrow(
      /no es una imagen|autenticaci/i,
    );
  });

  // El `content-type` lo declara el servidor y puede mentir; los bytes no.
  // Sin mirar el cuerpo, un HTML servido como `image/png` pasaría el chequeo
  // anterior y llegaría a `sharp` disfrazado de foto.
  it("rechaza HTML aunque el content-type diga que es una imagen", async () => {
    const html = new TextEncoder().encode("<!DOCTYPE html><html>Sign in to Slack</html>").buffer;
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-type": "image/png" }),
      arrayBuffer: async () => html,
    } as Response);

    await expect(descargar("https://files.slack.com/foto-privada.jpg")).rejects.toThrow(
      /HTML|autenticaci/i,
    );
  });

  it("con el header, baja los bytes de una URL privada de Slack", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "4", "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([5, 6, 7, 8]).buffer,
    } as Response);

    const bytes = await descargar("https://files.slack.com/foto-privada.jpg", {
      Authorization: "Bearer xoxb-test",
    });

    expect(Buffer.from(bytes)).toEqual(Buffer.from([5, 6, 7, 8]));
    expect(fetch).toHaveBeenCalledWith("https://files.slack.com/foto-privada.jpg", {
      headers: { Authorization: "Bearer xoxb-test" },
    });
  });

  it("sin headers no le manda un segundo argumento a fetch", async () => {
    vi.mocked(fetch).mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "content-length": "4", "content-type": "image/png" }),
      arrayBuffer: async () => new Uint8Array([1, 1, 1, 1]).buffer,
    } as Response);

    await descargar("https://ejemplo.com/foto.jpg");
    expect(vi.mocked(fetch).mock.calls[0]).toHaveLength(1);
  });
});
