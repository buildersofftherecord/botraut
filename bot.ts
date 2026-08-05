import { Chat } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createMemoryState } from "@chat-adapter/state-memory";
// TODO(deploy): en serverless cada mensaje cae en una función que arranca sin
// memoria — ahí hace falta `createRedisState()` de "@chat-adapter/state-redis"
// (ya instalado, REDIS_URL ya configurada). `state-memory` alcanza en local
// porque `next dev` es un proceso vivo.
import { buscarCopy } from "./lib/buscar";
import { InvitadoSchema } from "./lib/tipos";
import { EstadoThreadSchema, type EstadoThread } from "./lib/estado";
import { mensajeNombreLargo, mensajeCopy } from "./lib/mensajes";

export const bot = new Chat({
  userName: "botraut",
  adapters: { slack: createSlackAdapter() },
  state: createMemoryState(),
});

/**
 * Turno 1: alguien tira un nombre en el canal, sin mención de por medio.
 * `onNewMessage` es el hook correcto para eso — solo dispara en threads que
 * el bot todavía no siguió, así que no reacciona a los mensajes de las
 * conversaciones que ya arrancó. El patrón exige al menos un carácter no
 * blanco: un adjunto sin texto no dispara esto.
 */
bot.onNewMessage(/\S/, async (thread, message) => {
  const nombre = message.text.trim();

  // Esto NO es lo que evita que Slack reintente: el adapter ya contesta 200 de
  // forma síncrona sin esperar a este handler, y de los reintentos que igual
  // lleguen se ocupa su deduplicado por `event_id`. Es feedback para el humano,
  // porque buscarCopy tarda ~5s y el silencio parece que el bot no lo vio.
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

  await thread.post(mensajeCopy(nombre, copy));

  const estado = { nombre, copy } satisfies EstadoThread;
  await thread.setState(EstadoThreadSchema.parse(estado));

  // Sin esto, la próxima respuesta del humano (la foto, o una corrección del
  // copy) vuelve a caer acá como si fuera un nombre nuevo: `onNewMessage`
  // solo deja de disparar cuando el thread está subscribto.
  await thread.subscribe();
});
