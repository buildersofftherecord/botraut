import { describe, it, expect, vi, beforeEach } from "vitest";
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
  // Sin esto, la configuración de `removeBackground` de un test (p. ej.
  // `mockRejectedValue`) sobrevive al siguiente porque es el mismo `vi.fn()`
  // a nivel de archivo. No causaba un falso positivo hoy (el test de más
  // abajo rechaza antes, en `sharp().metadata()`, sin llegar a llamar a
  // `removeBackground` — confirmado contando `.mock.calls`), pero dejarlo
  // implícito es la clase de fragilidad que ya nos mordió una vez en este
  // módulo.
  beforeEach(() => {
    removeBackground.mockReset();
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
    // Fija que el rechazo viene de `sharp().metadata()`, no de una llamada
    // a la librería mockeada que por casualidad haya quedado configurada
    // (o sin configurar) por otro test. Sin esta línea, el nombre del test
    // promete un camino que la aserción de arriba no distingue de ningún
    // otro.
    expect(removeBackground).not.toHaveBeenCalled();
  });

  it("un TIFF ahora funciona: antes moría por el mime type", async () => {
    // `imageDecode` de @imgly sólo entiende png, jpeg, webp, octet-stream y
    // sus dos formatos raw. Un TIFF —que sharp lee sin problema— caía en su
    // `default: throw new Error("Unsupported format: ...")`, y lo único que
    // hacíamos era envolverlo en un mensaje amable.
    //
    // Normalizando a PNG antes, la librería nunca ve un TIFF. El modo de falla
    // desapareció en vez de quedar bien explicado. El mock aplica el mismo
    // criterio que la librería real para que el test dependa del tipo que
    // recibe, no de un rechazo fijo.
    removeBackground.mockImplementation(async (blob: Blob) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(blob.type)) {
        throw new Error(`Unsupported format: ${blob.type}`);
      }
      return new Blob([new Uint8Array([1, 2, 3])]);
    });

    const tiff = await sharp({
      create: { width: 10, height: 10, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .tiff()
      .toBuffer();

    await expect(recortar(tiff)).resolves.toBeInstanceOf(Buffer);
  });
});

describe("recortar — normaliza los canales antes de pasar la imagen", () => {
  /**
   * `@imgly` exige 4 canales: con una foto en escala de grises tira "Only
   * 4-channel images are supported". Pasó en producción con una foto real, y
   * es un caso probable — las placas son en blanco y negro, así que la gente
   * manda fotos ya convertidas.
   *
   * Se verifica sobre los bytes que efectivamente recibe la librería, no sobre
   * los que entran a `recortar`: lo que importa es que llegue RGBA.
   */
  it("convierte una imagen de un solo canal a RGBA", async () => {
    const grises = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 90, g: 90, b: 90 } },
    })
      .greyscale()
      .toColourspace("b-w")
      .jpeg()
      .toBuffer();
    expect((await sharp(grises).metadata()).channels).toBe(1);

    await recortar(grises);

    const [blob] = removeBackground.mock.calls[0];
    const recibido = Buffer.from(await blob.arrayBuffer());
    expect((await sharp(recibido).metadata()).channels).toBe(4);
  });

  // Y el tipo del Blob deja de depender de con qué formato llegó la foto: la
  // librería lee `blob.type` sin mirar los magic bytes, así que un tipo
  // constante saca esa variable del medio.
  it("siempre declara image/png", async () => {
    const jpeg = await sharp({
      create: { width: 100, height: 100, channels: 3, background: { r: 90, g: 90, b: 90 } },
    })
      .jpeg()
      .toBuffer();

    await recortar(jpeg);

    const [blob] = removeBackground.mock.calls[0];
    expect(blob.type).toBe("image/png");
  });
});
