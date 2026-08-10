import type { ModelMessage } from "ai";
import { Chat, type Thread, type Message } from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { validarFoto } from "./lib/foto";
import { FotoSchema } from "./lib/tipos";
import { EstadoThreadSchema } from "./lib/estado";
import { extraerFotoAdjunta, FOTO_SIN_URL, FOTO_SIN_DESCARGAR, nombreArchivoPlaca } from "./lib/mensajes";
import { crearAgente, type Conversacion } from "./lib/agente";

export const bot = new Chat({
  userName: "botraut",
  adapters: { slack: createSlackAdapter() },
  // Redis y no memoria: en serverless cada mensaje de Slack cae en una función
  // que arranca en blanco, así que el estado tiene que sobrevivir afuera del
  // proceso.
  state: createRedisState(),
  // Sin esto, cualquier `Thread` reconstruido desde un payload de interacción
  // tira "No Chat singleton registered" al tocar `thread.state`.
}).registerSingleton();

/**
 * Cuántos mensajes del thread se le pasan al agente como contexto.
 *
 * Bajo a propósito: `thread.messages` pagina contra la API de Slack y busca
 * info de cada autor, así que cada mensaje extra es latencia real. Con 30 la
 * función se pasaba del tiempo y Vercel la mataba con SIGTERM. Una placa se
 * arma en pocos mensajes; no hace falta más memoria que eso.
 */
const MENSAJES_DE_CONTEXTO = 12;

/**
 * Arranca **solo si lo mencionan**. Antes también escuchaba cualquier mensaje
 * del canal con `onNewMessage(/\S/)`, y eso lo hacía insoportable: cada cosa
 * que alguien escribía —tuviera o no que ver con placas— le abría una
 * conversación de invitado, y encima gastaba una llamada a Gemini por mensaje
 * ajeno.
 *
 * El costo de sacarlo es que ya no se puede tirar el nombre pelado y que
 * arranque solo. En un canal compartido conviene el intercambio.
 */
bot.onNewMention(async (thread, message) => {
  await atender(thread, message);
  // Sin esto la próxima respuesta del humano no llega: `onSubscribedMessage`
  // solo dispara en threads que el bot ya sigue.
  await thread.subscribe();
});

/** Todo lo que siga en el thread: la foto, correcciones, confirmaciones. */
bot.onSubscribedMessage(atender);

/**
 * El único handler real. No hay ramas por tipo de mensaje: el agente decide
 * qué hacer leyendo la conversación. Lo único que este código resuelve antes
 * es la foto, porque los bytes no pueden viajar como argumento de una
 * herramienta —son JSON— así que el agente orquesta pero nunca los toca.
 */
async function atender(thread: Thread, message: Message): Promise<void> {
  // El historial se lee ANTES de postear nada, si no el propio aviso de "estoy
  // mirando la foto" entra como contexto y el agente se lee a sí mismo.
  const historial = await construirHistorial(thread);

  const adjunto = extraerFotoAdjunta(message.attachments);
  const notaDelSistema = adjunto ? await procesarFoto(thread, adjunto, message.author.fullName) : null;

  const mensajes: ModelMessage[] = [...historial];
  if (notaDelSistema) mensajes.push({ role: "user", content: notaDelSistema });
  if (mensajes.length === 0) return;

  const agente = crearAgente(conversacionDe(thread));
  const respuesta = await agente.stream({ messages: mensajes });
  // `fullStream` y no `textStream`: conserva los límites entre pasos, así el
  // texto de antes y después de una llamada a herramienta no queda pegado.
  await thread.post(respuesta.fullStream);
}

/**
 * Convierte el thread de Slack en mensajes para el modelo. Slack es la
 * memoria: no guardamos historial propio, así que no puede desincronizarse de
 * lo que el humano ve en pantalla.
 */
async function construirHistorial(thread: Thread): Promise<ModelMessage[]> {
  const crudos: Message[] = [];
  for await (const m of thread.messages) {
    crudos.push(m);
    if (crudos.length >= MENSAJES_DE_CONTEXTO) break;
  }

  return crudos
    .reverse() // `thread.messages` viene del más nuevo al más viejo
    .map((m) => ({
      role: m.author.isMe ? ("assistant" as const) : ("user" as const),
      content: m.text.trim() || (m.attachments?.length ? "[mandó un archivo]" : ""),
    }))
    .filter((m) => m.content.length > 0);
}

/**
 * Baja, valida y guarda la foto. Devuelve la nota que va al agente: el
 * resultado se le cuenta en texto porque no puede inspeccionar la imagen.
 */
async function procesarFoto(thread: Thread, adjunto: NonNullable<ReturnType<typeof extraerFotoAdjunta>>, fuente: string): Promise<string> {
  if (!adjunto.url || !adjunto.fetchData) return `[sistema: llegó un adjunto pero no se pudo leer. ${FOTO_SIN_URL}]`;

  // `validarFoto` corre el recorte de fondo y una consulta de visión: son
  // varios segundos, y el silencio se lee como que el bot se colgó.
  await thread.post("Mirando la foto...");

  let bytes: Buffer;
  try {
    // `fetchData()` resuelve solo el auth de Slack; las URLs de archivo son
    // privadas y `descargar()` de procesar.ts no manda el header.
    bytes = await adjunto.fetchData();
  } catch (e) {
    console.error("fetchData falló", e);
    return `[sistema: no se pudo descargar la foto. ${FOTO_SIN_DESCARGAR}]`;
  }

  const resultado = await validarFoto(bytes);
  if (!resultado.ok) {
    return `[sistema: la foto no sirve. Pasale este motivo al humano tal cual, está escrito para que lo lea una persona: ${resultado.motivo}]`;
  }

  await thread.setState({
    foto: FotoSchema.parse({
      url: adjunto.url,
      fuente,
      ancho: resultado.foto.ancho,
      alto: resultado.foto.alto,
    }),
  });
  return "[sistema: la foto llegó, se validó y quedó guardada. Ya no hace falta pedirla.]";
}

/**
 * Adapta el `Thread` del SDK a la interfaz mínima que usan las herramientas.
 * Existe para que `lib/agente.ts` no dependa del Chat SDK y sus herramientas
 * se puedan probar con un objeto plano.
 */
function conversacionDe(thread: Thread): Conversacion {
  return {
    estado: () => Promise.resolve(thread.state),
    guardar: (parcial) => thread.setState(parcial),
    publicarPlaca: async (nombre, png) => {
      await thread.post({
        markdown: `*${nombre}*`,
        files: [{ data: png, filename: nombreArchivoPlaca(nombre), mimeType: "image/png" }],
      });
    },
  };
}

/** Se exporta solo para los tests. */
export const _internos = { construirHistorial, EstadoThreadSchema };
