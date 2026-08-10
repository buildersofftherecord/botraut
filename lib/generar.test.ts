import { describe, it, expect, vi, beforeEach } from "vitest";

const descargar = vi.fn();
const recortar = vi.fn();
const armarPlaca = vi.fn();

vi.mock("./procesar", () => ({ descargar }));
vi.mock("./recorte", () => ({ recortar }));
vi.mock("./placa", () => ({ armarPlaca }));

const { generarPlaca } = await import("./generar");

const URL_SLACK = "https://files.slack.com/files-pri/T0/F0/foto.png";
const DATOS = {
  invitado: { nombre: "Guillermo Rauch", rol: "CEO & Founder @Vercel", genero: "m" },
  fecha: "JUEVES 20 DE AGOSTO",
  hora: "21:00 HS",
  enVivo: true,
};

const ORIGINAL = Buffer.from("jpeg-de-slack");
const RECORTADA = Buffer.from("png-con-alfa");
const PLACA = Buffer.from("placa-final");

beforeEach(() => {
  descargar.mockResolvedValue(ORIGINAL);
  recortar.mockResolvedValue(RECORTADA);
  armarPlaca.mockResolvedValue({ ok: true, png: PLACA });
  delete process.env.SLACK_BOT_TOKEN;
});

describe("generarPlaca — el orden importa", () => {
  /**
   * `placas/` espera una foto ya recortada y **no verifica que lo esté**: con
   * un JPEG crudo genera la placa igual, con el rectángulo visible alrededor
   * de la persona. Si alguien mueve `recortar` después de `armarPlaca`, o lo
   * saca, el sistema no se queja — sale una placa fea en silencio.
   */
  it("recorta el fondo antes de armar la placa", async () => {
    await generarPlaca(DATOS, URL_SLACK);

    expect(recortar).toHaveBeenCalledWith(ORIGINAL);
    expect(armarPlaca).toHaveBeenCalledWith(DATOS, RECORTADA, { escalaSujeto: undefined });
    expect(recortar.mock.invocationCallOrder[0]).toBeLessThan(armarPlaca.mock.invocationCallOrder[0]);
  });

  it("devuelve lo que armó placas/", async () => {
    const r = await generarPlaca(DATOS, URL_SLACK);
    expect(r).toEqual({ ok: true, png: PLACA });
  });
});

describe("generarPlaca — autenticación de Slack", () => {
  // Las URLs de archivo de Slack son privadas y no devuelven 401: sin el
  // header, Slack responde 200 con el HTML de su página de login.
  it("manda el bearer cuando hay token", async () => {
    process.env.SLACK_BOT_TOKEN = "xoxb-falso";

    await generarPlaca(DATOS, URL_SLACK);

    expect(descargar).toHaveBeenCalledWith(URL_SLACK, { Authorization: "Bearer xoxb-falso" });
  });

  it("sin token no inventa un header", async () => {
    await generarPlaca(DATOS, URL_SLACK);
    expect(descargar).toHaveBeenCalledWith(URL_SLACK, undefined);
  });
});

describe("generarPlaca — errores hacia el humano", () => {
  /**
   * Lo que devuelve esta función lo repite el agente en el canal. `descargar`
   * tira `descarga: HTTP 404 en <url>`, que filtra la URL del archivo privado
   * de Slack.
   */
  it("no filtra el texto crudo ni la url si falla la descarga", async () => {
    descargar.mockRejectedValue(new Error(`descarga: HTTP 404 en ${URL_SLACK}`));

    const r = await generarPlaca(DATOS, URL_SLACK);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).not.toMatch(/HTTP|descarga:|files\.slack\.com/);
    expect(armarPlaca).not.toHaveBeenCalled();
  });

  // `recortar` sí traduce sus errores, así que su mensaje se publica tal cual
  // en vez de reemplazarlo por uno genérico que diría menos.
  it("pasa el mensaje de recortar tal cual", async () => {
    const humano = "No pude recortar el fondo de esa foto. Puede ser la imagen o un problema mío.";
    recortar.mockRejectedValue(new Error(humano));

    const r = await generarPlaca(DATOS, URL_SLACK);

    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.motivo).toBe(humano);
    expect(armarPlaca).not.toHaveBeenCalled();
  });
});

describe("generarPlaca — la escala del invitado", () => {
  /**
   * `prepararRetrato` escala la silueta por el ancho y deriva el alto, así que
   * el tamaño final depende del encuadre de la foto: con los brazos cruzados
   * la silueta es ancha, se achica para entrar, y el invitado queda bajo.
   *
   * Se probó calcularla para que llene el alto del cuadro y da peor: el número
   * coincide con la referencia pero sale una cabeza gigante, porque el alto
   * ocupado no es lo mismo que el encuadre. Por eso se pasa desde afuera,
   * como pide `placas/README.md`.
   */
  it("le pasa la escala a armarPlaca cuando se la dan", async () => {
    await generarPlaca(DATOS, URL_SLACK, 1.6);
    expect(armarPlaca).toHaveBeenCalledWith(DATOS, RECORTADA, { escalaSujeto: 1.6 });
  });
});
