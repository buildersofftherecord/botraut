import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Conversacion } from "./agente";

const buscarCopy = vi.fn();
const generarPlaca = vi.fn();
vi.mock("./buscar", () => ({ buscarCopy }));
vi.mock("./generar", () => ({ generarPlaca }));

const { crearHerramientas, INSTRUCCIONES } = await import("./agente");
const { NO_ENCONTRADO } = await import("./mensajes");

const PNG = Buffer.from("png-falso");

const DATOS_COMPLETOS = {
  nombre: "Guillermo Rauch",
  rol: "CEO de Vercel",
  genero: "m" as const,
  fecha: "jueves 6 de agosto",
  hora: "21:00 hs",
  enVivo: true,
};

const FOTO = { url: "https://files.slack.com/a.jpg", fuente: "Gastón", ancho: 1200, alto: 1600 };

function conversacionFalsa(estado: unknown): Conversacion & { publicadas: [string, Buffer][] } {
  const publicadas: [string, Buffer][] = [];
  return {
    publicadas,
    estado: async () => estado,
    guardar: async () => {},
    publicarPlaca: async (nombre, png) => {
      publicadas.push([nombre, png]);
    },
  };
}

beforeEach(() => {
  generarPlaca.mockResolvedValue({ png: PNG });
  buscarCopy.mockResolvedValue({ rol: "CEO de Vercel", genero: "m", fuentes: [] });
});

describe("INSTRUCCIONES", () => {
  // El riesgo concreto de sacar el modal: sin un campo que obligue a tipear la
  // fecha, el agente puede llamar a generar_placa con una que le sonó bien. Una
  // placa publicada con la fecha equivocada es el peor error posible acá.
  it("prohíbe inventar la fecha y la hora", () => {
    expect(INSTRUCCIONES).toMatch(/NUNCA inventes la fecha/);
  });

  it("le dice qué hacer con NO_ENCONTRADO en vez de mostrarlo", () => {
    expect(INSTRUCCIONES).toContain(NO_ENCONTRADO);
    expect(INSTRUCCIONES).toMatch(/no lo muestres/);
  });

  it("fija que el nombre va tal cual", () => {
    expect(INSTRUCCIONES).toMatch(/nombre va tal cual/);
  });
});

describe("buscar_copy", () => {
  it("devuelve el borrador del rol", async () => {
    const h = crearHerramientas(conversacionFalsa(null));
    const r = (await h.buscar_copy.execute({ nombre: "Guillermo Rauch" }, {} as never)) as unknown;
    expect(r).toEqual({ rol: "CEO de Vercel", genero: "m" });
  });
});

describe("generar_placa", () => {
  it("se niega si no hay foto validada en el thread", async () => {
    const conv = conversacionFalsa({ nombre: "Guillermo Rauch", copy: { rol: "CEO de Vercel", genero: "m", fuentes: [] } });
    const h = crearHerramientas(conv);

    const r = (await h.generar_placa.execute(DATOS_COMPLETOS, {} as never)) as { ok: boolean };

    expect(r.ok).toBe(false);
    expect(generarPlaca).not.toHaveBeenCalled();
    expect(conv.publicadas).toHaveLength(0);
  });

  it("se niega si el thread no tiene estado", async () => {
    const h = crearHerramientas(conversacionFalsa(null));
    const r = (await h.generar_placa.execute(DATOS_COMPLETOS, {} as never)) as { ok: boolean };
    expect(r.ok).toBe(false);
    expect(generarPlaca).not.toHaveBeenCalled();
  });

  it("con foto, renderiza y publica el PNG en el thread", async () => {
    const conv = conversacionFalsa({
      nombre: "Guillermo Rauch",
      copy: { rol: "CEO de Vercel", genero: "m", fuentes: [] },
      foto: FOTO,
    });
    const h = crearHerramientas(conv);

    const r = (await h.generar_placa.execute(DATOS_COMPLETOS, {} as never)) as { ok: boolean };

    expect(r.ok).toBe(true);
    expect(conv.publicadas).toEqual([["Guillermo Rauch", PNG]]);
  });

  // El nombre no pasa por el modelo en ningún punto del pipeline: va tal cual
  // desde el mensaje de Slack hasta el render.
  it("le pasa a generarPlaca el nombre y la foto del estado, sin tocarlos", async () => {
    const conv = conversacionFalsa({
      nombre: "viejo",
      copy: { rol: "x", genero: "m", fuentes: [] },
      foto: FOTO,
    });
    const h = crearHerramientas(conv);

    await h.generar_placa.execute(DATOS_COMPLETOS, {} as never);

    const [datos] = generarPlaca.mock.calls[0];
    expect(datos.invitado.nombre).toBe("Guillermo Rauch");
    expect(datos.fotoElegida).toEqual(FOTO);
    expect(datos.fecha).toBe("jueves 6 de agosto");
    expect(datos.enVivo).toBe(true);
  });
});
