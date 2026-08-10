import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { parse } from "@shuding/opentype.js";
import { MAX_CARACTERES_FILA, validarDatos } from "../datos";
import { LIENZOS } from "../lienzos";
import { HUD } from "../tokens";

const validos = {
  invitado: { nombre: "Guillermo Rauch", rol: "CEO & Founder @Vercel", genero: "m" },
  fecha: "JUEVES 20 DE AGOSTO",
  hora: "21:00 HS",
  enVivo: true,
};

const con = (cambio: Record<string, unknown>) => ({ ...validos, ...cambio });
const conInvitado = (cambio: Record<string, unknown>) => ({
  ...validos,
  invitado: { ...validos.invitado, ...cambio },
});

describe("validarDatos", () => {
  it("acepta unos datos completos", () => {
    expect(() => validarDatos(validos)).not.toThrow();
  });

  /**
   * Los tres casos que antes de existir el schema producían una placa rota y
   * salían con código 0 — comprobados a mano contra el binario:
   *   sin rol      → placa con un hueco debajo del nombre
   *   género malo  → etiqueta INVITADO/INVITADA vacía, queda la rayita sola
   *   enVivo false → la caja decía EN VIVO igual
   */
  it.each([
    ["sin rol", conInvitado({ rol: undefined }), /rol/i],
    ["con género inválido", conInvitado({ genero: "otro" }), /género/i],
    ["con enVivo en false", con({ enVivo: false }), /en vivo/i],
    ["sin fecha", con({ fecha: undefined }), /fecha/i],
    ["con nombre vacío", conInvitado({ nombre: "   " }), /nombre/i],
  ])("rechaza %s", (_caso, datos, esperado) => {
    expect(() => validarDatos(datos)).toThrow(esperado);
  });

  it("junta todos los problemas en un mensaje, no corta en el primero", () => {
    try {
      validarDatos({ invitado: { nombre: "Ana" }, enVivo: false });
      expect.unreachable("tendría que haber tirado");
    } catch (e) {
      const msg = (e as Error).message;
      expect(msg).toMatch(/rol/i);
      expect(msg).toMatch(/género/i);
      expect(msg).toMatch(/fecha/i);
      expect(msg).toMatch(/en vivo/i);
    }
  });
});

describe("MAX_CARACTERES_FILA", () => {
  /**
   * El límite no es un número elegido: es cuánto texto entra en la caja de
   * datos, que tiene ancho fijo. Se verifica midiendo con la fuente real, así
   * que si alguien cambia `cajaAncho`, `HUD.labelTamano` o el padding de la
   * caja, este test falla y hay que recalcular la constante.
   */
  it("coincide con lo que realmente entra en la caja, medido con IBM Plex Mono", async () => {
    const buf = await readFile("fuentes/IBMPlexMono-Regular.ttf");
    const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    // Geometría de la fila, de `Placa.tsx`: padding 34 a cada lado, borde 2 a
    // cada lado, ícono 22, gap 20, separador 1, gap 20.
    const PADDING = 34, BORDE = 2, ICONO = 22, GAP = 20, SEPARADOR = 1;
    const presupuesto =
      LIENZOS["1:1"].cajaAncho - PADDING * 2 - BORDE * 2 - ICONO - GAP - SEPARADOR - GAP;

    // `datosTamano`, no `labelTamano`: las filas de la caja se separaron del
    // resto de las etiquetas cuando fecha y hora subieron de cuerpo. Medir con
    // el tamaño equivocado hacía pasar el test con un límite que no era.
    const tamano = HUD.datosTamano;
    const tracking = parseFloat(HUD.labelTracking) * tamano;
    const anchoDe = (n: number) => font.getAdvanceWidth("M".repeat(n), tamano) + tracking * (n - 1);

    expect(anchoDe(MAX_CARACTERES_FILA)).toBeLessThanOrEqual(presupuesto);
    expect(anchoDe(MAX_CARACTERES_FILA + 1)).toBeGreaterThan(presupuesto);
  });
});
