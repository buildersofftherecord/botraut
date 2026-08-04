import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { renderizar, DATOS_DEMO } from "./Placa";
import { tamanoNombre } from "./medirNombre";
import { pixelEn, medidas, regionTieneClaros } from "../test/pixel";
import { etiquetaInvitado } from "../lib/tipos";
import { LIENZOS } from "./lienzos";

describe("renderizar", () => {
  it("devuelve un PNG de 1080x1080", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1080 });
  });

  it("el fondo es negro", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Un punto del centro-izquierda, lejos de texto y de la foto.
    expect(await pixelEn(png, 30, 540)).toEqual([0, 0, 0]);
  });

  it("es determinista: dos renders dan bytes idénticos", async () => {
    const [a, b] = await Promise.all([
      renderizar(DATOS_DEMO, "1:1"),
      renderizar(DATOS_DEMO, "1:1"),
    ]);
    expect(a.equals(b)).toBe(true);
  });
});

describe("marco HUD", () => {
  it("dibuja el corchete superior izquierdo", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Sobre el borde superior del corchete: casi blanco (alpha 0.8 sobre negro).
    const [r, g, b] = await pixelEn(png, 45, 40);
    expect(r).toBeGreaterThan(180);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("dibuja el corchete inferior derecho", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    const [r] = await pixelEn(png, 1035, 1039);
    expect(r).toBeGreaterThan(180);
  });

  it("el punto REC es rojo", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Centro del punto, a la derecha de la palabra REC.
    const [r, g, b] = await pixelEn(png, 108, 52);
    expect(r).toBeGreaterThan(200);
    expect(g).toBeLessThan(80);
    expect(b).toBeLessThan(80);
  });
});

describe("bloque de tipografía", () => {
  it("dibuja el nombre en blanco", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Zona del nombre. Se busca cualquier píxel claro en una franja
    // horizontal, porque la posición exacta de una asta depende del shaping.
    // y=280 cae sobre el cuerpo de la primera línea ("NAOMI"); y=340 del plan
    // original caía en el hueco entre líneas y siempre daba 0 (medido, no a ojo).
    let claros = 0;
    for (let x = 70; x < 520; x += 4) {
      const [r] = await pixelEn(png, x, 280);
      if (r > 200) claros++;
    }
    expect(claros).toBeGreaterThan(5);
  });

  it("la etiqueta de género sale del dato, no del template", () => {
    expect(etiquetaInvitado("f")).toBe("INVITADA");
    expect(etiquetaInvitado("m")).toBe("INVITADO");
    expect(etiquetaInvitado("x")).toBe("INVITADX");
  });
});

describe("tamanoNombre", () => {
  // Satori no corta una palabra a mitad de línea, así que si la palabra más
  // larga del nombre no entra al techo de diseño, hay que achicar la fuente
  // en vez de dejar que el texto se salga del contenedor. El ancho se mide
  // con la fuente real (@shuding/opentype.js), no con un promedio por
  // caracter: por eso "María" y "Muñoz" -- misma longitud, 5 caracteres --
  // no dan el mismo resultado.
  const l = LIENZOS["1:1"];
  const anchoColumna = l.ancho * (1 - l.fotoAncho) - l.margen - 40;

  it("usa el techo de diseño cuando la palabra más larga entra sin achicar", async () => {
    expect(await tamanoNombre("Ana Li", anchoColumna, l.nombreTamano)).toBe(l.nombreTamano);
  });

  it("achica más la fuente cuanto más larga es la palabra más larga", async () => {
    const paraNombreCorto = await tamanoNombre("Naomi Couriel", anchoColumna, l.nombreTamano);
    const paraNombreLargo = await tamanoNombre("Guillermo Rauch", anchoColumna, l.nombreTamano);
    expect(paraNombreLargo).toBeLessThan(paraNombreCorto);
    expect(paraNombreLargo).toBeLessThan(l.nombreTamano);
  });

  it("distingue el ancho real en píxeles, no la cuenta de caracteres", async () => {
    // "María" y "Muñoz" tienen los dos 5 caracteres; un promedio por
    // caracter les daría el mismo tamaño. La fuente real no.
    const conMaria = await tamanoNombre("María", anchoColumna, l.nombreTamano);
    const conMunoz = await tamanoNombre("Muñoz", anchoColumna, l.nombreTamano);
    expect(conMaria).not.toBe(conMunoz);
  });
});

describe("caja de datos", () => {
  it("dibuja el borde de la caja", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    // Borde izquierdo de la caja: (x=68, y=830) cae justo sobre la línea de
    // 1px, medido en la imagen. COLOR.linea es rgba(255,255,255,0.1) sobre
    // negro, así que el borde da r≈25, no el >180 de un blanco casi puro:
    // el umbral del plan (30) asumía un color más claro que el del token.
    const [r] = await pixelEn(png, 68, 830);
    expect(r).toBeGreaterThan(20);
  });

  it("omite EN VIVO cuando enVivo es false", async () => {
    const conVivo = await renderizar(DATOS_DEMO, "1:1");
    const sinVivo = await renderizar({ ...DATOS_DEMO, enVivo: false }, "1:1");
    expect(conVivo.equals(sinVivo)).toBe(false);
  });
});

describe("el nombre nunca invade la columna reservada para la foto", () => {
  const l = LIENZOS["1:1"];
  // Frontera real del diseño: a la derecha de esto empieza el 48% que
  // Task 10 va a ocupar con la foto.
  const zonaFoto = Math.round(l.ancho * (1 - l.fotoAncho));

  // "Guillermo Rauch" es el caso peor citado en lib/tipos.ts. Los tres
  // nombres acentuados y la palabra de 24 M son los que la revisión de
  // Round 2 encontró desbordando con el estimador por caracter: una M o una
  // Ñ ocupan más que el ancho medio que asumía ANCHO_GLYPH_NOMBRE.
  it.each([
    ["Naomi Couriel"],
    ["Guillermo Rauch"],
    ["José María Muñoz"],
    ["Íñigo Márquez"],
    ["Ñandú Ñáñez"],
    ["MMMMMMMMMMMMMMMMMMMMMMMM"],
  ])(
    "ningún píxel del bloque de tipografía cruza la frontera con \"%s\"",
    async (nombre) => {
      const datos = { ...DATOS_DEMO, invitado: { ...DATOS_DEMO.invitado, nombre } };
      const png = await renderizar(datos, "1:1");

      // Franja vertical generosa que cubre etiqueta + nombre + rol sea cual
      // sea el tamaño de fuente que termine eligiendo tamanoNombre().
      const hayClaros = await regionTieneClaros(png, {
        left: zonaFoto,
        top: l.margen + 130,
        width: l.ancho - zonaFoto - 1,
        height: 300,
      });
      expect(hayClaros).toBe(false);
    },
  );
});

/** Un PNG gris liso, en lugar de una foto real. */
async function fotoFalsa(): Promise<Buffer> {
  return sharp({
    create: { width: 800, height: 1400, channels: 4, background: { r: 128, g: 128, b: 128, alpha: 1 } },
  })
    .png()
    .toBuffer();
}

describe("foto", () => {
  it("sin foto renderiza igual (la foto es opcional)", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1");
    expect(await medidas(png)).toEqual({ ancho: 1080, alto: 1080 });
  });

  it("con foto pinta la mitad derecha", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1", await fotoFalsa());
    const [r, g, b] = await pixelEn(png, 900, 700);
    expect(r).toBeGreaterThan(100);
    expect(r).toBe(g);
    expect(g).toBe(b);
  });

  it("con foto no tapa el bloque de texto de la izquierda", async () => {
    const png = await renderizar(DATOS_DEMO, "1:1", await fotoFalsa());
    expect(await pixelEn(png, 30, 540)).toEqual([0, 0, 0]);
  });
});
