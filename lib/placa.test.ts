import { describe, it, expect } from "vitest";
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { armarPlaca } from "./placa";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const muestra = (archivo: string) => join(raiz, "placas", "muestra", archivo);

/**
 * Se usan la foto y los datos de muestra reales de `placas/`, no mocks. Un
 * mock de esa librería probaría que nuestro código llama bien a algo que
 * inventamos nosotros — que es exactamente lo que dejó `lib/recorte.ts` rota
 * para toda entrada real mientras su suite iba en verde.
 */
const fotoRecortada = async () => readFile(muestra("gr.png"));
const datosValidos = async () => JSON.parse(await readFile(muestra("gr.json"), "utf8"));

describe("armarPlaca — el camino feliz", () => {
  it("devuelve un PNG de 1080x1080", async () => {
    const r = await armarPlaca(await datosValidos(), await fotoRecortada());

    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const { width, height } = await sharp(r.png).metadata();
    expect({ width, height }).toEqual({ width: 1080, height: 1080 });
  }, 60_000);

  // Lo que garantiza `placas/` y lo que hace que una placa se pueda regenerar
  // sin sorpresas: mismos datos y misma foto, mismo archivo.
  it("es determinista: dos corridas dan el mismo byte", async () => {
    const [datos, foto] = [await datosValidos(), await fotoRecortada()];
    const a = await armarPlaca(datos, foto);
    const b = await armarPlaca(datos, foto);

    expect(a.ok && b.ok).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(a.png.equals(b.png)).toBe(true);
  }, 120_000);
});

describe("armarPlaca — la foto tiene que venir recortada", () => {
  /**
   * `placas/` no verifica el recorte y no se da cuenta si falta: con un JPEG
   * crudo genera la placa igual, con el rectángulo de la foto visible
   * alrededor de la persona. Por eso el chequeo vive de este lado.
   */
  it("rechaza un JPEG sin canal alfa", async () => {
    const cruda = await sharp(await fotoRecortada()).flatten({ background: "#888" }).jpeg().toBuffer();

    const r = await armarPlaca(await datosValidos(), cruda);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/no está recortada/);
  });

  // Se mira el canal alfa, no el formato: un PNG puede venir perfectamente
  // opaco y sería igual de inútil que un JPEG.
  it("rechaza un PNG opaco", async () => {
    const opaca = await sharp(await fotoRecortada()).flatten({ background: "#888" }).png().toBuffer();

    const r = await armarPlaca(await datosValidos(), opaca);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/no está recortada/);
  });

  it("no explota con algo que no es una imagen", async () => {
    const r = await armarPlaca(await datosValidos(), Buffer.from("esto no es un png"));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/PNG/);
  });
});

describe("armarPlaca — datos inválidos", () => {
  /**
   * Lo que devuelve esta función lo repite el agente en el canal de Slack, así
   * que tiene que poder leerlo una persona. `validarDatos` junta todos los
   * problemas en un mensaje pensado para eso; acá sólo se verifica que llegue
   * entero en vez de convertirse en una excepción.
   */
  it("no tira: devuelve el motivo", async () => {
    const sinRol = { fecha: "JUEVES 20 DE AGOSTO", hora: "21:00 HS", enVivo: true, invitado: { nombre: "Guillermo Rauch", genero: "m" } };

    const r = await armarPlaca(sinRol, await fotoRecortada());

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/rol/);
  });

  it("junta todos los problemas, no sólo el primero", async () => {
    const r = await armarPlaca({}, await fotoRecortada());

    expect(r.ok).toBe(false);
    if (r.ok) return;
    for (const campo of ["invitado", "fecha", "hora"]) expect(r.motivo).toContain(campo);
  });

  // Valida antes de tocar la foto: renderizar es lo caro y no tiene sentido
  // pagarlo para descubrir que faltaba un campo.
  it("rechaza los datos aunque la foto no sirva", async () => {
    const r = await armarPlaca({}, Buffer.from("tampoco es un png"));

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toMatch(/no son válidos/);
  });
});
