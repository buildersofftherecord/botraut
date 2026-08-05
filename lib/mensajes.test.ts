import { describe, it, expect } from "vitest";
import { InvitadoSchema, type Copy } from "./tipos";
import { PEDIDO_DE_FOTO } from "./foto";
import {
  NO_ENCONTRADO,
  mensajeNombreLargo,
  mensajeNoEncontrado,
  mensajeCopy,
} from "./mensajes";

describe("mensajeNombreLargo", () => {
  it("incluye el largo real y el máximo real del schema", () => {
    const nombre = "a".repeat(30);
    // Se arma el error contra el schema real, no un ZodError inventado a
    // mano — así la prueba también pega si InvitadoSchema deja de valer 24.
    const resultado = InvitadoSchema.shape.nombre.safeParse(nombre);
    if (resultado.success) throw new Error("fixture inválido: se esperaba que el nombre fallara");

    const mensaje = mensajeNombreLargo(nombre, resultado.error);

    expect(mensaje).toContain("30");
    expect(mensaje).toContain("24");
  });
});

describe("mensajeNoEncontrado", () => {
  it("menciona el nombre", () => {
    expect(mensajeNoEncontrado("Naomi Couriel")).toContain("Naomi Couriel");
  });

  // La regresión que motivó este archivo: el literal del protocolo con el
  // prompt no tiene que llegar nunca al canal.
  it("no contiene el literal NO_ENCONTRADO", () => {
    expect(mensajeNoEncontrado("Naomi Couriel")).not.toContain(NO_ENCONTRADO);
  });
});

describe("mensajeCopy", () => {
  const copyReal: Copy = {
    rol: "AI Engineering en UdeSA y Data & AI en Ualá",
    genero: "f",
    fuentes: [],
  };

  it("publica el rol y pide la foto cuando hay copy", () => {
    const mensaje = mensajeCopy("Naomi Couriel", copyReal);
    expect(mensaje).toContain(copyReal.rol);
    expect(mensaje).toContain("INVITADA");
    expect(mensaje).toContain(PEDIDO_DE_FOTO);
  });

  // La regresión: el literal del protocolo con el prompt llegaba al canal como
  // si fuera un rol real ("NAOMI COURIEL — NO_ENCONTRADO").
  it("con NO_ENCONTRADO pide el dato en vez de publicar el literal", () => {
    const mensaje = mensajeCopy("Naomi Couriel", { ...copyReal, rol: NO_ENCONTRADO });
    expect(mensaje).not.toContain(NO_ENCONTRADO);
    expect(mensaje).toBe(mensajeNoEncontrado("Naomi Couriel"));
  });

  it("con NO_ENCONTRADO no pide la foto todavía: primero se resuelve el rol", () => {
    const mensaje = mensajeCopy("Naomi Couriel", { ...copyReal, rol: NO_ENCONTRADO });
    expect(mensaje).not.toContain(PEDIDO_DE_FOTO);
  });
});
