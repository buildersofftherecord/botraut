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

describe("recortar", () => {
  it("devuelve el recorte transparente que la librería produjo", async () => {
    const conAlpha = await sharp({
      create: { width: 40, height: 40, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
    })
      .png()
      .toBuffer();
    removeBackground.mockResolvedValue(new Blob([conAlpha]));

    const salida = await recortar(Buffer.from("entrada"));
    expect(await alfaEn(salida, 20, 20)).toBe(0);
  });

  it("envuelve el error con un mensaje legible por un humano, no lo deja crudo", async () => {
    removeBackground.mockRejectedValue(new Error("onnx se cayó"));
    await expect(recortar(Buffer.from("x"))).rejects.toThrow(/No pude recortar el fondo/);
  });

  it("no filtra la jerga interna de la librería al mensaje que ve el humano", async () => {
    removeBackground.mockRejectedValue(new Error("onnx se cayó"));
    await expect(recortar(Buffer.from("x"))).rejects.not.toThrow(/onnx/);
  });

  it("conserva la causa original en `cause`, para quien mire logs", async () => {
    const causaOriginal = new Error("onnx se cayó");
    removeBackground.mockRejectedValue(causaOriginal);
    await expect(recortar(Buffer.from("x"))).rejects.toMatchObject({ cause: causaOriginal });
  });
});
