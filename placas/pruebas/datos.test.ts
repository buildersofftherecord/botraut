import { describe, expect, it } from "vitest";
import { readFile } from "node:fs/promises";
import { parse } from "@shuding/opentype.js";
import { BARRA } from "../Placa";
import { MAX_CARACTERES_FILA, validarDatos } from "../datos";
import { LIENZOS, anchoContenido } from "../lienzos";
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
   * El límite no es un número elegido: es cuánto texto entra en el campo de la
   * fecha de la barra de datos. Se verifica midiendo con la fuente real.
   *
   * La geometría se **importa** de `Placa.tsx` (`BARRA`, `anchoContenido`) en
   * vez de repetirse acá. Antes estaba copiada a mano —"padding 34, gap 20"— y
   * eso hace que el test mida una barra que puede haber dejado de existir:
   * cambiar el padding en el JSX dejaba el límite mal sin que nada fallara. El
   * único número que sigue siendo literal es el que se está verificando.
   *
   * Presupuesto: del ancho de contenido se descuentan padding y borde, después
   * los grupos de hora y "EN VIVO" —que son de largo conocido— y recién lo que
   * queda es del campo de la fecha, menos su propio ícono y gap.
   */
  it("coincide con lo que realmente entra en el campo de la fecha, medido con IBM Plex Mono", async () => {
    const buf = await readFile("fuentes/IBMPlexMono-Regular.ttf");
    const font = parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));

    // `datosTamano`, no `labelTamano`: los campos de la barra se separaron del
    // resto de las etiquetas cuando fecha y hora subieron de cuerpo. Medir con
    // el tamaño equivocado hacía pasar el test con un límite que no era.
    const tamano = HUD.datosTamano;
    const tracking = parseFloat(HUD.labelTracking) * tamano;
    const anchoTexto = (t: string) =>
      font.getAdvanceWidth(t, tamano) + tracking * (t.length - 1);

    // El filete que separa dos grupos lleva aire a los dos lados: el `gap` del
    // flex de un lado y su propio `marginRight` del otro.
    const separador = BARRA.filete + BARRA.gap * 2;
    const grupoHora = separador + BARRA.icono + BARRA.gap + anchoTexto("21:00 HS");
    const grupoVivo =
      separador + BARRA.icono + BARRA.gap + BARRA.punto + BARRA.gapPunto + anchoTexto("EN VIVO");

    const util = anchoContenido(LIENZOS["1:1"]) - BARRA.padding * 2 - BARRA.borde * 2;
    const presupuesto = util - grupoHora - grupoVivo - BARRA.icono - BARRA.gap;

    const anchoDe = (n: number) => anchoTexto("M".repeat(n));
    expect(anchoDe(MAX_CARACTERES_FILA)).toBeLessThanOrEqual(presupuesto);
    expect(anchoDe(MAX_CARACTERES_FILA + 1)).toBeGreaterThan(presupuesto);
  });

  /**
   * El caso peor real, no un string de eses: el programa es siempre un jueves,
   * así que la fecha más larga que puede llegar es la de septiembre. Si esta
   * falla, la fecha se sale de la barra en alguna semana del año — un bug que
   * aparecería recién en septiembre.
   */
  it("deja entrar la fecha más larga del año", () => {
    expect("JUEVES 30 DE SEPTIEMBRE".length).toBeLessThanOrEqual(MAX_CARACTERES_FILA);
  });
});
