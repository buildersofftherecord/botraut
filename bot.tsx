import { after } from "next/server";
import {
  Chat,
  Card,
  CardText,
  Actions,
  Button,
  Modal,
  TextInput,
  RadioSelect,
  SelectOption,
  type Thread,
  type Attachment,
} from "chat";
import { createSlackAdapter } from "@chat-adapter/slack";
import { createRedisState } from "@chat-adapter/state-redis";
import { buscarCopy, rehacerCopy } from "./lib/buscar";
import { validarFoto } from "./lib/foto";
import { generarPlaca } from "./lib/generar";
import { InvitadoSchema, FotoSchema, PlacaSchema, type Copy } from "./lib/tipos";
import { EstadoThreadSchema, type EstadoThread } from "./lib/estado";
import {
  mensajeNombreLargo,
  mensajeCopy,
  mensajeErrorBusqueda,
  mensajeNoEncontrado,
  extraerFotoAdjunta,
  listoParaFecha,
  ID_BOTON_FECHA,
  TEXTO_BOTON_FECHA,
  CALLBACK_ID_MODAL_FECHA,
  TITULO_MODAL_FECHA,
  FOTO_SIN_URL,
  FOTO_SIN_DESCARGAR,
  SIN_ESTADO,
  mensajeFotoSinCopy,
  mensajeSinFotoParaPlaca,
  mensajeGenerando,
  mensajePlacaLista,
  mensajeErrorPlaca,
  nombreArchivoPlaca,
  SUBIDA_FALLIDA,
  erroresModalFecha,
  NO_ENTENDI,
  CONFIRMAR_LISTO,
  mensajeConfirmarSinFoto,
  REINICIAR,
  PEDIDO_FUERA_DE_ALCANCE,
} from "./lib/mensajes";
import { clasificar } from "./lib/intencion";

export const bot = new Chat({
  userName: "botraut",
  adapters: { slack: createSlackAdapter() },
  // Redis y no memoria: en serverless cada mensaje de Slack cae en una función
  // que arranca en blanco, así que el estado que escribe el turno 1 tiene que
  // sobrevivir afuera del proceso para que el turno 2 lo lea.
  state: createRedisState(),
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

  let copy: Copy;
  try {
    copy = await buscarCopy(nombre);
  } catch (e) {
    // buscarCopy no traduce sus errores (a diferencia de recorte.ts/foto.ts):
    // acá es donde se corta el mensaje crudo de Gemini/AI SDK antes de Slack.
    console.error(`buscarCopy falló para "${nombre}"`, e);
    await thread.post(mensajeErrorBusqueda(nombre));
    return;
  }

  // Opción C de la spec (§3.1): si el nombre vino con una foto adjunta en el
  // mismo mensaje, no hace falta pedirla — se valida directo más abajo en vez
  // de esperar un segundo mensaje que ya no va a llegar.
  const adjunto = extraerFotoAdjunta(message.attachments);
  await thread.post(mensajeCopy(nombre, copy, { pedirFoto: !adjunto }));

  const estado = { nombre, copy } satisfies EstadoThread;
  await thread.setState(EstadoThreadSchema.parse(estado));

  // Sin esto, la próxima respuesta del humano (la foto, o una corrección del
  // copy) vuelve a caer acá como si fuera un nombre nuevo: `onNewMessage`
  // solo deja de disparar cuando el thread está subscripto.
  await thread.subscribe();

  if (adjunto) {
    await procesarFotoRecibida(thread, estado, adjunto, message.author.fullName);
  }
});

/**
 * Turno 2: el thread ya está subscripto, así que todo lo que el humano
 * conteste a partir de acá —la foto, una corrección del copy, o (con
 * NO_ENCONTRADO) el dato que el turno 1 pidió— entra por acá en vez de por
 * `onNewMessage`.
 */
bot.onSubscribedMessage(async (thread, message) => {
  const estado = await leerEstado(thread);
  if (!estado) {
    await thread.post(SIN_ESTADO);
    return;
  }

  const adjunto = extraerFotoAdjunta(message.attachments);
  if (adjunto) {
    await procesarFotoRecibida(thread, estado, adjunto, message.author.fullName);
    return;
  }

  const texto = message.text.trim();
  if (!texto) {
    // Un PDF, un sticker, un mensaje que queda vacío al recortarlo. No hay nada
    // que hacer con eso, pero decirlo es mejor que el silencio.
    await thread.post(NO_ENTENDI);
    return;
  }

  // Antes todo texto entraba como corrección del copy: "usa esa" republicaba el
  // mismo rol y volvía a pedir la foto. El modelo clasifica qué quiso decir; qué
  // se hace con cada categoría lo decide este switch, no el modelo.
  switch (await clasificar(texto)) {
    case "confirmar":
      await thread.post(
        estado.foto ? CONFIRMAR_LISTO : mensajeConfirmarSinFoto(estado.nombre),
      );
      if (estado.foto && listoParaFecha(estado.copy)) {
        await postarBotonFecha(thread, estado.nombre);
      }
      return;

    case "reiniciar":
      // Se borra el estado, no se pisa: un `setState` parcial mergea y dejaría
      // el nombre viejo colgado. Sin estado, el próximo mensaje arranca limpio.
      await thread.setState({}, { replace: true });
      await thread.post(REINICIAR);
      return;

    case "pedido":
      await thread.post(PEDIDO_FUERA_DE_ALCANCE);
      return;

    case "otro":
      await thread.post(NO_ENTENDI);
      return;

    case "corregir":
      await procesarCorreccion(thread, estado, texto);
      return;
  }
});

/**
 * Postea sin dejar que un fallo de red se lleve puesto al que llama.
 *
 * Adentro de `after()` no hay nadie escuchando: una excepción acá termina en
 * un rechazo que nadie atrapa, y el humano se queda esperando una placa que
 * nunca llega después de que el bot le dijo "generando". Si el aviso no sale,
 * al menos queda en los logs.
 */
async function avisar(thread: Thread, texto: string): Promise<void> {
  try {
    await thread.post(texto);
  } catch (e) {
    console.error(`no se pudo avisar en ${thread.id}: "${texto}"`, e);
  }
}

/**
 * Lee y valida el estado del thread. Nunca confía en lo que vuelve del
 * adapter: de Redis (o de `state-memory`) llega como JSON sin tipo, y un
 * thread sin `subscribe()` previo (o con el TTL de 30 días vencido) vuelve
 * `null`. Los dos casos se tratan igual del lado del humano: no hay de dónde
 * partir, así que arranca de nuevo con el nombre.
 */
async function leerEstado(thread: Thread): Promise<EstadoThread | null> {
  const crudo = await thread.state;
  if (!crudo) return null;

  try {
    return EstadoThreadSchema.parse(crudo);
  } catch (e) {
    console.error(`Estado corrupto en ${thread.id}`, e);
    return null;
  }
}

/**
 * Descarga, valida y guarda una foto. La comparten las dos entradas posibles:
 * el turno 1, cuando el nombre vino con la foto adjunta en el mismo mensaje,
 * y el turno 2, cuando la foto llega en un mensaje aparte — así la validación
 * no se duplica entre `onNewMessage` y `onSubscribedMessage`.
 */
async function procesarFotoRecibida(
  thread: Thread,
  estado: EstadoThread,
  adjunto: Attachment,
  fuente: string,
): Promise<void> {
  if (!adjunto.url || !adjunto.fetchData) {
    await thread.post(FOTO_SIN_URL);
    return;
  }

  let bytes: Buffer;
  try {
    // `fetchData()` resuelve el auth de Slack sola (header Bearer con el bot
    // token) — por eso esto no pasa por `descargar()` de `lib/procesar.ts`,
    // que no lo hace y fallaría contra una URL de archivo privado.
    bytes = await adjunto.fetchData();
  } catch (e) {
    console.error(`fetchData falló para la foto de "${estado.nombre}"`, e);
    await thread.post(FOTO_SIN_DESCARGAR);
    return;
  }

  // Task 22b: `validarFoto` ahora corre `recortar()` (carga un modelo de
  // 155MB) y le muestra el resultado a Gemini — varios segundos, no la
  // validación de metadata instantánea que era antes. Mismo criterio que
  // "Buscando a X..." en el turno 1: el silencio se lee como que se colgó.
  await thread.post(`Mirando la foto de *${estado.nombre}*...`);

  const resultado = await validarFoto(bytes);
  if (!resultado.ok) {
    // El motivo ya viene en castellano accionable — se publica tal cual.
    await thread.post(resultado.motivo);
    return;
  }

  const foto = FotoSchema.parse({
    url: adjunto.url,
    fuente,
    ancho: resultado.foto.ancho,
    alto: resultado.foto.alto,
  });
  // Merge, no replace: no toca `nombre` ni `copy` ya guardados.
  await thread.setState({ foto });

  if (listoParaFecha(estado.copy)) {
    await postarBotonFecha(thread, estado.nombre);
    return;
  }

  // Con el copy todavía en NO_ENCONTRADO no se ofrece el botón, pero igual hay
  // que contestar: quedarse callado acá es indistinguible de estar roto.
  await thread.post(mensajeFotoSinCopy(estado.nombre));
}

/**
 * Turno 2, rama de texto: una corrección del copy (o, si el turno 1 devolvió
 * NO_ENCONTRADO, el dato que faltaba). `rehacerCopy` hace la redacción; acá
 * solo se decide qué se publica y si falta pedir la foto.
 */
async function procesarCorreccion(thread: Thread, estado: EstadoThread, correccion: string): Promise<void> {
  let copyNuevo: Copy;
  try {
    copyNuevo = await rehacerCopy(estado.nombre, estado.copy, correccion);
  } catch (e) {
    console.error(`rehacerCopy falló para "${estado.nombre}"`, e);
    await thread.post(mensajeErrorBusqueda(estado.nombre, "rehacer"));
    return;
  }

  await thread.post(mensajeCopy(estado.nombre, copyNuevo, { pedirFoto: !estado.foto }));
  await thread.setState({ copy: copyNuevo });

  if (estado.foto && listoParaFecha(copyNuevo)) {
    await postarBotonFecha(thread, estado.nombre);
  }
}

/**
 * La card que cierra el turno 2. Solo deja el botón puesto — el `trigger_id`
 * que abre un modal solo viene en interacciones (clics, slash commands), no
 * en eventos de mensaje, así que abrirlo acá es imposible. Eso es la Task 23,
 * con `onAction("cargar-datos", ...)`.
 */
async function postarBotonFecha(thread: Thread, nombre: string): Promise<void> {
  await thread.post(
    <Card title={`${nombre} — listo para la fecha`}>
      <CardText>Copy y foto listos.</CardText>
      <Actions>
        <Button id={ID_BOTON_FECHA} style="primary">
          {TEXTO_BOTON_FECHA}
        </Button>
      </Actions>
    </Card>,
  );
}

/**
 * Turno 3, paso 1: el clic en "Cargar fecha y hora" abre el modal. El
 * `trigger_id` de Slack vence en ~3 segundos, así que `openModal` tiene que
 * ser el primer `await` de este handler — nada de leer estado, validar, ni
 * postear antes: si se demora, el modal no abre y el humano ve un error de
 * Slack sin explicación.
 *
 * El género no va acá: ya está en `copy.genero` desde el turno 1
 * (`etiquetaInvitado()` lo traduce a INVITADO/INVITADA/INVITADE) — si el
 * humano lo quiere corregir, lo hace por texto como cualquier otra parte
 * del copy, no por este modal.
 */
bot.onAction(ID_BOTON_FECHA, async (event) => {
  await event.openModal(
    <Modal callbackId={CALLBACK_ID_MODAL_FECHA} title={TITULO_MODAL_FECHA} submitLabel="Generar">
      <TextInput id="fecha" label="Fecha" placeholder="JUEVES 30 DE JULIO" />
      <TextInput id="hora" label="Hora" placeholder="21:00 HS" />
      <RadioSelect id="enVivo" label="¿En vivo?">
        <SelectOption label="Sí" value="si" />
        <SelectOption label="No" value="no" />
      </RadioSelect>
    </Modal>,
  );
});

/**
 * Turno 3, paso 2: submit del modal. Arma los datos, dispara el render en
 * segundo plano y cierra el modal.
 *
 * El adapter de Slack espera a que este handler resuelva antes de
 * contestarle a Slack el `view_submission` — a diferencia de los eventos de
 * mensaje, que Slack ya ackea solo y de ahí en más el trabajo corre en
 * segundo plano (ver el comentario de `onNewMessage`). `view_submission`
 * tiene su propia ventana de ~3 segundos, muy por debajo de los ~15s que
 * tarda `generarPlaca` (bajar, recortar fondo con un modelo de 155MB,
 * silueta, B/N, resize, Satori a 2x y bajar). Por eso el pipeline pesado no
 * se espera acá: corre dentro de `after()` (el mismo `after` que ya usa
 * `app/api/slack/route.ts`), que sigue vivo después de que la respuesta ya
 * salió — el handler cierra el modal rápido, y la placa llega al thread por
 * su lado unos segundos después.
 */
bot.onModalSubmit(CALLBACK_ID_MODAL_FECHA, async (event) => {
  const thread = event.relatedThread;
  if (!thread) return;

  const estado = await leerEstado(thread);
  if (!estado) {
    await thread.post(SIN_ESTADO);
    return;
  }
  if (!estado.foto) {
    // No debería pasar: el botón que abre este modal solo aparece después de
    // que la foto ya validó (ver `postarBotonFecha`). Pero un TTL vencido a
    // mitad de camino, o un botón viejo en un thread reabierto, sí lo permiten.
    await thread.post(mensajeSinFotoParaPlaca(estado.nombre));
    return;
  }
  if (!listoParaFecha(estado.copy)) {
    await thread.post(mensajeNoEncontrado(estado.nombre));
    return;
  }

  const candidato = PlacaSchema.safeParse({
    invitado: { nombre: estado.nombre, ...estado.copy },
    fotoElegida: estado.foto,
    // Sin mayúscula acá a propósito: `Etiqueta` en `marca/Hud.tsx` ya aplica
    // `textTransform: uppercase` a fecha y hora. Pasarlas en mayúscula
    // también acá duplicaría la misma regla en dos lugares.
    fecha: event.values.fecha?.trim() ?? "",
    hora: event.values.hora?.trim() ?? "",
    enVivo: event.values.enVivo === "si",
  });

  if (!candidato.success) {
    const errores = erroresModalFecha(candidato.error);
    if (Object.keys(errores).length > 0) {
      return { action: "errors", errors: errores };
    }
    // `invitado`/`fotoElegida` salen del estado, no del modal — si fallan
    // acá no hay ningún campo del formulario al que apuntar.
    await thread.post(SIN_ESTADO);
    return;
  }

  const datos = candidato.data;

  // Todo lo pesado va adentro de `after()`, incluido el aviso: a diferencia de
  // los eventos de mensaje, `view_submission` espera a que este handler
  // resuelva antes de ackear a Slack, y ahí hay ~3 segundos. Hasta un `post`
  // es una llamada de red que compite con esa ventana.
  after(async () => {
    // El render tarda ~9s: avisar antes de arrancar, mismo criterio que
    // "Buscando a X..." (turno 1) y "Mirando la foto..." (turno 2) — el
    // silencio es el peor modo de falla de este bot.
    await avisar(thread, mensajeGenerando(estado.nombre));

    let png: Buffer;
    try {
      ({ png } = await generarPlaca(datos));
    } catch (e) {
      // `descargar()` no traduce sus errores (ver mensajeErrorPlaca) — la
      // causa cruda se corta acá, antes de Slack.
      console.error(`generarPlaca falló para "${estado.nombre}"`, e);
      await avisar(thread, mensajeErrorPlaca(estado.nombre, e));
      return;
    }

    // Separado del render: si falla la subida, la placa se generó bien y el
    // mensaje tiene que decir eso, no un error de render.
    try {
      await thread.post({
        markdown: mensajePlacaLista(estado.nombre),
        files: [{ data: png, filename: nombreArchivoPlaca(estado.nombre), mimeType: "image/png" }],
      });
    } catch (e) {
      console.error(`falló la subida de la placa de "${estado.nombre}"`, e);
      await avisar(thread, SUBIDA_FALLIDA);
    }
  });

  return { action: "close" };
});
