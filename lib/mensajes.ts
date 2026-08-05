import type { z } from "zod";
import { etiquetaInvitado, type Copy } from "./tipos";
import { PEDIDO_DE_FOTO } from "./foto";

/**
 * Protocolo interno entre el prompt de `lib/buscar.ts` y quien lo consume:
 * cuando el modelo no sabe nada confiable de la persona, devuelve este
 * literal en `rol` en vez de inventar (ver `PROMPT` en `lib/buscar.ts`). No
 * es una excepción — hay que detectarlo antes de publicarlo tal cual en el
 * canal, que es un protocolo interno, no un rol real.
 */
export const NO_ENCONTRADO = "NO_ENCONTRADO";

/**
 * Lee el máximo real del error de Zod (`issue.maximum`) en vez de repetir
 * "24" acá — si el límite del template cambia algún día, este mensaje se
 * ajusta solo.
 */
export function mensajeNombreLargo(nombre: string, error: z.ZodError): string {
  const issue = error.issues[0];
  const maximo = issue?.code === "too_big" ? issue.maximum : "el máximo permitido";
  return (
    `Ese nombre tiene ${nombre.length} caracteres y la placa admite hasta ${maximo} — ` +
    `si no entra, sale cortado o achicado. Pasame una versión más corta (apodo, sin apellido) y la busco.`
  );
}

/**
 * Lo que se postea cuando `buscarCopy` devolvió `NO_ENCONTRADO`. El estado
 * se guarda igual que en el caso exitoso (mismo `copy`, con ese rol
 * placeholder adentro) para que la corrección por texto del turno siguiente
 * tenga algo de qué partir — no es un callejón sin salida, es el mismo
 * camino de corrección que cualquier otro copy.
 */
export function mensajeNoEncontrado(nombre: string): string {
  return (
    `No encontré nada confiable sobre *${nombre}*. ` +
    `Contame a qué se dedica hoy y armo el copy con eso.`
  );
}

/**
 * Decide qué se publica después de buscar el copy. Vive acá y no adentro del
 * handler para que la rama de `NO_ENCONTRADO` se pueda testear sin mockear el
 * Chat SDK — un mock de librería externa ya escondió un bug real en este
 * proyecto (ver `lib/recorte.ts`).
 *
 * Cuando no hay copy no se pide la foto: primero se resuelve el rol, así el
 * humano contesta una cosa por vez.
 */
export function mensajeCopy(nombre: string, copy: Copy): string {
  if (copy.rol === NO_ENCONTRADO) return mensajeNoEncontrado(nombre);
  return `*${nombre}* — ${etiquetaInvitado(copy.genero)}\n${copy.rol}\n\n${PEDIDO_DE_FOTO}`;
}
