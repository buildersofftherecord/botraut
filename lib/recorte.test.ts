import { describe, it, expect, vi } from "vitest";
import sharp from "sharp";

const removeBackground = vi.hoisted(() => vi.fn());
vi.mock("@imgly/background-removal-node", () => ({ removeBackground }));

const { recortar } = await import("./recorte");

/**
 * `hasAlpha` solo confirma que existe un cuarto canal — una imagen forzada a
 * 100% opaca también lo tiene. Esto lee el byte real, igual que en
 * `procesar.test.ts`.
 */
async function alfaEn(png: Buffer, x: number, y: number): Promise<number> {
  const { data } = await sharp(png)
    .extract({ left: x, top: y, width: 1, height: 1 })
    .raw()
    .toBuffer({ resolveWithObject: true });
  return data[3];
}

/**
 * Bytes de imagen válidos, para los tests que no le interesa el *contenido*
 * de la entrada: `recortar` ahora inspecciona el formato con sharp antes de
 * llamar a `removeBackground` (ver el fix de detección de mime type), así
 * que un buffer arbitrario como `Buffer.from("x")` ya no llega a esa
 * llamada — rompe antes, en `sharp().metadata()`.
 */
async function unaFoto(): Promise<Buffer> {
  return sharp({
    create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .jpeg()
    .toBuffer();
}

describe("recortar", () => {
  it("le informa el formato real de la imagen a la librería", async () => {
    // La librería lee `blob.type` sin ningún sniffing de magic bytes propio
    // (confirmado leyendo su fuente compilada): un Blob sin `type` la hace
    // tirar "Unsupported format: " incluso con bytes JPEG válidos adentro.
    // Sin esta aserción, un mock de `removeBackground` que ignora el tipo
    // (como el resto de este archivo) nunca detectaría esa regresión.
    const jpeg = await unaFoto();

    let tipoRecibido: string | undefined;
    removeBackground.mockImplementation(async (blob: Blob) => {
      tipoRecibido = blob.type;
      return new Blob([new Uint8Array(jpeg)]);
    });

    await recortar(jpeg);
    expect(tipoRecibido).toBe("image/jpeg");
  });

  it("devuelve el recorte transparente que la librería produjo", async () => {
    const conAlpha = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    removeBackground.mockResolvedValue(new Blob([conAlpha]));

    const salida = await recortar(await unaFoto());
    expect(await alfaEn(salida, 20, 20)).toBe(0);
  });

  it("envuelve el error con un mensaje legible por un humano, no lo deja crudo", async () => {
    removeBackground.mockRejectedValue(new Error("onnx se cayó"));
    await expect(recortar(await unaFoto())).rejects.toThrow(/No pude recortar el fondo/);
  });

  it("no filtra la jerga interna de la librería al mensaje que ve el humano", async () => {
    removeBackground.mockRejectedValue(new Error("onnx se cayó"));
    await expect(recortar(await unaFoto())).rejects.not.toThrow(/onnx/);
  });

  it("conserva la causa original en `cause`, para quien mire logs", async () => {
    const causaOriginal = new Error("onnx se cayó");
    removeBackground.mockRejectedValue(causaOriginal);
    await expect(recortar(await unaFoto())).rejects.toMatchObject({ cause: causaOriginal });
  });

  it("también envuelve un error de formato inválido con el mismo mensaje humano", async () => {
    // Cubre el camino que la detección de formato agrega: entrada que ni
    // siquiera es una imagen. Antes del fix esto nunca llegaba a este
    // catch por esta razón — la librería mockeada nunca se llamaba a
    // detectar el formato porque no existía ese paso.
    await expect(recortar(Buffer.from("no es una imagen"))).rejects.toThrow(
      /No pude recortar el fondo/,
    );
  });
});
