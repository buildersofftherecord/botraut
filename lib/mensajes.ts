import type { z } from "zod";
import type { Attachment } from "chat";
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
 * Decide qué se publica después de buscar (o rehacer) el copy. Vive acá y no
 * adentro del handler para que la rama de `NO_ENCONTRADO` se pueda testear
 * sin mockear el Chat SDK — un mock de librería externa ya escondió un bug
 * real en este proyecto (ver `lib/recorte.ts`).
 *
 * Cuando no hay copy no se pide la foto: primero se resuelve el rol, así el
 * humano contesta una cosa por vez. `pedirFoto` en `false` cubre los otros
 * dos casos en los que no hace falta pedirla: ya vino adjunta al mismo
 * mensaje que el nombre (turno 1, opción C), o ya se validó en un turno
 * anterior y esto es una corrección de texto (turno 2).
 */
export function mensajeCopy(nombre: string, copy: Copy, opciones?: { pedirFoto?: boolean }): string {
  if (copy.rol === NO_ENCONTRADO) return mensajeNoEncontrado(nombre);
  const pedirFoto = opciones?.pedirFoto ?? true;
  const pie = pedirFoto ? `\n\n${PEDIDO_DE_FOTO}` : "";
  return `*${nombre}* — ${etiquetaInvitado(copy.genero)}\n${copy.rol}${pie}`;
}

/**
 * El mismo mensaje de error, para `buscarCopy` (turno 1) y `rehacerCopy`
 * (turno 2, corrección) — ninguno de los dos traduce sus errores (a
 * diferencia de `recorte.ts`/`foto.ts`), así que el handler necesita este
 * mismo texto en los dos catch. La causa cruda de Gemini/AI SDK nunca llega
 * hasta acá: eso lo loguea el handler con `console.error` antes de llamar a
 * esto.
 */
export function mensajeErrorBusqueda(nombre: string, verbo: "armar" | "rehacer" = "armar"): string {
  return (
    `No pude ${verbo} el copy de *${nombre}*: se cayó la búsqueda (Gemini, cuota o red). ` +
    `Probá de nuevo en un rato.`
  );
}

/**
 * Busca el primer adjunto utilizable como foto de invitado: tiene que ser
 * imagen, con `url` (lo que se guarda en el estado para la Task 23) y
 * `fetchData` (lo que hace falta para bajarla ahora — el adapter de Slack
 * solo lo define cuando hay `url`, así que en la práctica van juntos, pero
 * el chequeo no asume esa relación interna del adapter).
 *
 * Sirve para las dos entradas de foto: el turno 1 (nombre + foto en el mismo
 * mensaje) y el turno 2 (foto sola, en un mensaje posterior) comparten esta
 * función en vez de duplicar la detección.
 */
export function extraerFotoAdjunta(attachments?: Attachment[]): Attachment | undefined {
  return attachments?.find((a) => a.type === "image" && Boolean(a.url) && Boolean(a.fetchData));
}

/**
 * Si ya hay copy y foto, falta un solo paso antes de la placa: cargar fecha
 * y hora. Con `NO_ENCONTRADO` el copy no está resuelto todavía — aunque la
 * foto ya haya llegado y validado, no tiene sentido ofrecer el botón antes
 * de saber a qué se dedica la persona.
 */
export function listoParaFecha(copy: Copy): boolean {
  return copy.rol !== NO_ENCONTRADO;
}

/** Id del botón que arranca la Task 23. No abre el modal acá: ver `bot.tsx`. */
export const ID_BOTON_FECHA = "cargar-datos";
export const TEXTO_BOTON_FECHA = "Cargar fecha y hora";

/**
 * Adjunto sin `url` o sin `fetchData` — no debería pasar con el adapter de
 * Slack real (ver `extraerFotoAdjunta`), pero si pasa no hay bytes que
 * validar ni referencia que guardar.
 */
export const FOTO_SIN_URL = "No pude leer esa imagen — mandámela de nuevo, como JPG o PNG.";

/** `fetchData()` falló contra la API de Slack (red, token, scope). */
export const FOTO_SIN_DESCARGAR = "No pude descargar esa imagen desde Slack. Probá mandarla de nuevo.";

/** El estado del thread no existe o no valida (TTL vencido, o versión vieja del schema). */
export const SIN_ESTADO =
  "Perdí el contexto de esta conversación — mandame de nuevo el nombre del invitado para arrancar.";

/**
 * La foto llegó y es válida, pero el copy sigue en `NO_ENCONTRADO`: falta el
 * único dato que el bot no puede conseguir solo.
 *
 * Existe porque el silencio es el peor modo de falla de este bot: el humano no
 * distingue "la guardé y espero otra cosa" de "se rompió". Antes acá no se
 * publicaba nada y era indistinguible del bug que motivó todo el turno 2.
 */
export function mensajeFotoSinCopy(nombre: string): string {
  return (
    `Foto guardada. Todavía me falta a qué se dedica *${nombre}* — ` +
    `contame y con eso armo el copy y seguimos.`
  );
}

/**
 * Llegó algo que no es ni foto usable ni texto: un PDF, un sticker, un mensaje
 * que queda vacío al recortarlo. Mismo motivo que arriba — contestar algo es
 * mejor que dejarlo pensando si el bot lo vio.
 */
export const NO_ENTENDI =
  "No pude usar eso. Mandame una foto como JPG o PNG, o escribime el dato que falta.";
