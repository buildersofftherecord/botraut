import { describe, it, expect, vi, beforeEach } from "vitest";
import sharp from "sharp";

/**
 * Se mockean los tres módulos hermanos (`./recorte`, `./silueta`, `./mirar`),
 * no las librerías que ellos usan por dentro (@imgly, Gemini). Cada uno tiene
 * su propia suite contra su propio contrato — acá se prueba la orquestación
 * de `validarFoto`: qué corre, en qué orden, y qué mensaje sale de cada
 * resultado. Mismo patrón que `generar.test.ts` con `./recorte`/`./procesar`.
 */
const recortar = vi.hoisted(() => vi.fn());
const recortarASilueta = vi.hoisted(() => vi.fn());
const mirarSilueta = vi.hoisted(() => vi.fn());

vi.mock("./recorte", () => ({ recortar }));
vi.mock("./silueta", () => ({ recortarASilueta }));
vi.mock("./mirar", () => ({ mirarSilueta }));

const { validarFoto, PEDIDO_DE_FOTO, ALTO_MINIMO_SILUETA } = await import("./foto");
const { LIENZOS, altoDeFoto } = await import("../placas/lienzos");

// El alto al que el render efectivamente lleva la silueta, no el del lienzo:
// son distintos, y el umbral se mide contra el primero.
const ALTO_MINIMO = ALTO_MINIMO_SILUETA;

async function imagen(ancho: number, alto: number): Promise<Buffer> {
  return sharp({
    create: { width: ancho, height: alto, channels: 3, background: { r: 90, g: 90, b: 90 } },
  })
    .jpeg()
    .toBuffer();
}

/**
 * Estado feliz por defecto — recorte y silueta grandes, el modelo aprueba.
 * Cada test que necesite otra cosa lo pisa. `clearMocks: true`
 * (vitest.config.ts) ya limpia las llamadas entre tests; esto solo fija el
 * valor resuelto, que sí sobrevive un `mockClear`.
 */
beforeEach(() => {
  recortar.mockResolvedValue(Buffer.from("recorte"));
  recortarASilueta.mockResolvedValue({ png: Buffer.from("silueta"), ancho: 900, alto: ALTO_MINIMO });
  mirarSilueta.mockResolvedValue({ sirve: true });
});

describe("validarFoto — chequeos baratos, antes de correr ningún modelo", () => {
  it("rechaza lo que no es una imagen sin explotar", async () => {
    const r = await validarFoto(Buffer.from("esto no es una imagen"));
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo.length).toBeGreaterThan(0);
    expect(recortar).not.toHaveBeenCalled();
  });

  it("el motivo nunca es un mensaje de error crudo de librería", async () => {
    const r = await validarFoto(Buffer.from("xx"));
    if (!r.ok) expect(r.motivo).not.toMatch(/Input buffer|unsupported image format|Error:/);
  });

  it("rechaza un archivo por debajo del mínimo, con el ancho real, sin correr el modelo", async () => {
    const r = await validarFoto(await imagen(480, 640));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("480");
      expect(r.motivo.toLowerCase()).toContain("pixel");
    }
    expect(recortar).not.toHaveBeenCalled();
  });

  it("acepta exactamente en el mínimo del archivo y sigue al recorte", async () => {
    await validarFoto(await imagen(800, 800));
    expect(recortar).toHaveBeenCalledTimes(1);
  });

  it("ya no rechaza apaisadas por proporción — el caso real que motivó la Task 22b", async () => {
    // 1126×800: la foto que el bot rechazaba antes por "apaisada" aunque
    // tuviera una persona vertical adentro. El chequeo barato ya no mide
    // proporción, así que esto pasa al recorte igual que cualquier otra.
    await validarFoto(await imagen(1126, 800));
    expect(recortar).toHaveBeenCalledTimes(1);
  });
});

describe("validarFoto — recorte de fondo (recortar)", () => {
  it("si recortar() falla, su mensaje humano se publica tal cual", async () => {
    const mensajeHumano =
      "No pude recortar el fondo de esa foto. Probá con otra, preferentemente con el fondo más despejado.";
    recortar.mockRejectedValue(new Error(mensajeHumano));

    const r = await validarFoto(await imagen(1200, 1200));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe(mensajeHumano);
    expect(recortarASilueta).not.toHaveBeenCalled();
  });

  it("le pasa los bytes originales, no un preprocesado", async () => {
    const bytes = await imagen(1200, 1200);
    await validarFoto(bytes);
    expect(recortar).toHaveBeenCalledWith(bytes);
  });

  it("le pasa a recortarASilueta lo que devolvió recortar(), no los bytes originales", async () => {
    const recorteBuf = Buffer.from("recorte-especifico");
    recortar.mockResolvedValue(recorteBuf);

    await validarFoto(await imagen(1200, 1200));

    expect(recortarASilueta).toHaveBeenCalledWith(recorteBuf);
  });
});

describe("ALTO_MINIMO_SILUETA", () => {
  // Valor literal a propósito: los tests de abajo lo usan para ubicarse en el
  // borde, así que derivan de él y pasarían con cualquier número. Lo único que
  // puede fijar el valor es escribirlo.
  it("es 700px", () => {
    expect(ALTO_MINIMO_SILUETA).toBe(700);
  });

  // El invariante real. Exigir el alto exacto al que el render lleva la
  // silueta (1269) rechazaba fotos que salen bien: una de 982px se agranda
  // 1.29× y con Lanczos no se nota. El umbral tiene que dejar margen de
  // ampliación, no ser el destino.
  it("deja margen para agrandar: es menor que el alto de destino", () => {
    expect(ALTO_MINIMO_SILUETA).toBeLessThan(altoDeFoto(LIENZOS["1:1"]));
  });
});

describe("validarFoto — geometría de la silueta", () => {
  it("rechaza una silueta más baja que el mínimo, con los números concretos", async () => {
    recortarASilueta.mockResolvedValue({ png: Buffer.from("s"), ancho: 300, alto: 300 });

    const r = await validarFoto(await imagen(1200, 1200));

    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.motivo).toContain("300");
      expect(r.motivo).toContain(String(ALTO_MINIMO));
    }
    expect(mirarSilueta).not.toHaveBeenCalled();
  });

  it("acepta una silueta exactamente en el alto minimo", async () => {
    recortarASilueta.mockResolvedValue({ png: Buffer.from("s"), ancho: 900, alto: ALTO_MINIMO });
    const r = await validarFoto(await imagen(1400, 1600));
    expect(r.ok).toBe(true);
  });

  it("rechaza apenas por debajo del alto mínimo de la silueta", async () => {
    recortarASilueta.mockResolvedValue({ png: Buffer.from("s"), ancho: 900, alto: ALTO_MINIMO - 1 });
    const r = await validarFoto(await imagen(1400, 1600));
    expect(r.ok).toBe(false);
  });

  it("si recortarASilueta() falla (imagen totalmente transparente), su mensaje se publica tal cual", async () => {
    const mensajeHumano = "No encontré a la persona en esa foto: el recorte de fondo quedó completamente transparente.";
    recortarASilueta.mockRejectedValue(new Error(mensajeHumano));

    const r = await validarFoto(await imagen(1200, 1200));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe(mensajeHumano);
    expect(mirarSilueta).not.toHaveBeenCalled();
  });
});

describe("validarFoto — el modelo de visión (mirarSilueta)", () => {
  it("le manda la silueta recortada, no la foto original", async () => {
    const pngSilueta = Buffer.from("silueta-especifica");
    recortarASilueta.mockResolvedValue({ png: pngSilueta, ancho: 900, alto: ALTO_MINIMO });

    await validarFoto(await imagen(1200, 1200));

    expect(mirarSilueta).toHaveBeenCalledWith(pngSilueta);
  });

  it("rechaza con el motivo exacto que devuelve el modelo", async () => {
    mirarSilueta.mockResolvedValue({ sirve: false, motivo: "Se te ve solo la cara, mandame una de medio cuerpo" });

    const r = await validarFoto(await imagen(1200, 1200));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe("Se te ve solo la cara, mandame una de medio cuerpo");
  });

  it("acepta cuando el modelo aprueba, y devuelve las medidas del archivo original", async () => {
    const r = await validarFoto(await imagen(1200, 1600));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.foto).toEqual({ ancho: 1200, alto: 1600 });
  });

  it("si el modelo falla (red, cuota), rechaza en vez de aceptar a ciegas", async () => {
    mirarSilueta.mockRejectedValue(new Error("fetch failed"));

    const r = await validarFoto(await imagen(1200, 1200));

    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo.toLowerCase()).toMatch(/probá de nuevo|gemini/);
  });
});

describe("PEDIDO_DE_FOTO", () => {
  it("ya no exige que sea más alta que ancha", () => {
    expect(PEDIDO_DE_FOTO.toLowerCase()).not.toMatch(/más alta que ancha/);
  });

  it("pide medio cuerpo para arriba y fondo despejado", () => {
    const p = PEDIDO_DE_FOTO.toLowerCase();
    expect(p).toContain("medio cuerpo");
    expect(p).toContain("fondo");
  });
});
