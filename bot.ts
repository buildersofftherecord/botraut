import { Chat } from "chat";
import type { z } from "zod";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
// TODO(deploy): en serverless cada mensaje cae en una función que arranca sin
// memoria — ahí hace falta `createRedisState()` de "@chat-adapter/state-redis"
// (ya instalado, REDIS_URL ya configurada). `state-memory` alcanza en local
// porque `next dev` es un proceso vivo.
import { buscarCopy } from "./lib/buscar";
import { InvitadoSchema, etiquetaInvitado } from "./lib/tipos";
import { PEDIDO_DE_FOTO } from "./lib/foto";
import { EstadoThreadSchema, type EstadoThread } from "./lib/estado";

export const bot = new Chat({
  userName: "botraut",
  adapters: { slack: createSlackAdapter() },
  state: createMemoryState(),
});

/**
 * Arma el mensaje de largo excedido leyendo el máximo real del error de Zod
 * (`issue.maximum`), en vez de repetir "24" a mano acá — si el límite del
 * template cambia algún día, este mensaje se ajusta solo.
 */
function mensajeNombreLargo(nombre: string, error: z.ZodError): string {
  const issue = error.issues[0];
  const maximo = issue?.code === "too_big" ? issue.maximum : "el máximo permitido";
  return (
    `Ese nombre tiene ${nombre.length} caracteres y la placa admite hasta ${maximo} — ` +
    `si no entra, sale cortado o achicado. Pasame una versión más corta (apodo, sin apellido) y la busco.`
  );
}

/**
 * Turno 1: alguien tira un nombre en el canal, sin mención de por medio.
 * `onNewMessage` es el hook correcto para eso — solo dispara en threads que
 * el bot todavía no siguió, así que no reacciona a los mensajes de las
 * conversaciones que ya arrancó. El patrón exige al menos un carácter no
 * blanco: un adjunto sin texto no dispara esto.
 */
bot.onNewMessage(/\S/, async (thread, message) => {
  const nombre = message.text.trim();

  // Ack antes de lo largo: Slack corta a los 3s y buscarCopy tarda ~5s. Si el
  // humano no ve nada hasta que Gemini responde, parece que el bot no lo vio.
  await thread.post(`Buscando a *${nombre}*...`);

  const chequeoNombre = InvitadoSchema.shape.nombre.safeParse(nombre);
  if (!chequeoNombre.success) {
    await thread.post(mensajeNombreLargo(nombre, chequeoNombre.error));
    return;
  }

  let copy;
  try {
    copy = await buscarCopy(nombre);
  } catch (e) {
    // buscarCopy no traduce sus errores (a diferencia de recorte.ts/foto.ts):
    // acá es donde se corta el mensaje crudo de Gemini/AI SDK antes de Slack.
    console.error(`buscarCopy falló para "${nombre}"`, e);
    await thread.post(
      `No pude armar el copy de *${nombre}*: se cayó la búsqueda (Gemini, cuota o red). ` +
        `Probá de nuevo en un rato.`,
    );
    return;
  }

  await thread.post(
    `*${nombre}* — ${etiquetaInvitado(copy.genero)}\n${copy.rol}\n\n${PEDIDO_DE_FOTO}`,
  );

  const estado = { nombre, copy } satisfies EstadoThread;
  await thread.setState(EstadoThreadSchema.parse(estado));

  // Sin esto, la próxima respuesta del humano (la foto, o una corrección del
  // copy) vuelve a caer acá como si fuera un nombre nuevo: `onNewMessage`
  // solo deja de disparar cuando el thread está subscribto.
  await thread.subscribe();
});
