import { ToolLoopAgent, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import { buscarCopy } from "./buscar";
import { generarPlaca } from "./generar";
import { PlacaSchema, InvitadoSchema, CopySchema } from "./tipos";
import { NO_ENCONTRADO } from "./mensajes";
import { EstadoThreadSchema } from "./estado";

const MODELO = process.env.MODELO_COPY ?? "gemini-3.6-flash";

/**
 * Lo mínimo que el agente necesita del thread. Se define acá y no se importa
 * el `Thread` del Chat SDK para que las herramientas se puedan probar con un
 * objeto plano, sin mockear el SDK — el patrón que ya usa el resto del
 * proyecto después de que un mock de librería externa escondiera un bug real
 * en `lib/recorte.ts`.
 */
export type Conversacion = {
  estado(): Promise<unknown>;
  guardar(parcial: Record<string, unknown>): Promise<void>;
  publicarPlaca(nombre: string, png: Buffer): Promise<void>;
};

export const INSTRUCCIONES = `Sos el asistente que arma las placas de anuncio de
Builders Off The Record, un podcast argentino de tecnología. Trabajás en un canal
de Slack con el equipo.

Para armar una placa necesitás cinco cosas:
1. el nombre del invitado
2. a qué se dedica (el rol que va debajo del nombre)
3. una foto — la sube el humano al thread, vos no la buscás
4. la fecha del episodio
5. la hora, y si es en vivo

Cómo trabajás:

- Cuando te tiran un nombre, usá "buscar_copy" para proponer a qué se dedica. Lo
  que devuelve es un borrador: mostráselo al humano y aceptá correcciones. Si
  devuelve ${NO_ENCONTRADO}, no lo muestres — decí que no encontraste nada
  confiable y pedile el dato.

- La foto la maneja el sistema, no vos. Cuando llega, te van a avisar si sirve o
  por qué no. Si todavía no llegó, pedila. Si el sistema la rechazó, pasale el
  motivo tal cual: está escrito para que lo lea una persona.

- NUNCA inventes la fecha ni la hora. Ni las deduzcas, ni las estimes, ni pongas
  la de la semana que viene porque parece razonable. Si no te las dijeron,
  preguntá. Una placa publicada con la fecha equivocada es peor que una que
  tarda un mensaje más.

- El nombre va tal cual te lo escribieron. No lo corrijas, no lo completes, no
  le cambies mayúsculas. En el mundo dev mucha gente es más reconocible por su
  handle que por su nombre legal, y esa elección es del humano.

- Cuando tengas las cinco cosas, llamá a "generar_placa". La placa aparece sola
  en el thread; no hace falta que la describas ni que anuncies que la vas a
  mandar.

Hablás en castellano rioplatense, corto y directo, como un compañero de trabajo.
Nada de "¡Perfecto!" ni "¡Excelente elección!". Si algo falta, lo pedís y ya.`;

/**
 * Las herramientas se crean por conversación porque `generar_placa` necesita
 * leer la foto del estado del thread y publicar el PNG ahí. Los bytes no
 * pueden viajar como argumento de una herramienta —son JSON— así que el agente
 * orquesta pero nunca toca la imagen.
 */
export function crearHerramientas(conv: Conversacion) {
  return {
    buscar_copy: tool({
      description:
        "Busca a qué se dedica una persona. Devuelve un borrador para revisar con el humano, no un dato verificado.",
      inputSchema: z.object({
        nombre: z.string().describe("El nombre tal como lo escribió el humano"),
      }),
      execute: async ({ nombre }) => {
        const copy = await buscarCopy(nombre);
        return { rol: copy.rol, genero: copy.genero };
      },
    }),

    generar_placa: tool({
      description:
        "Renderiza la placa y la publica en el thread. Requiere que la foto ya haya sido enviada y validada.",
      inputSchema: z.object({
        nombre: z.string(),
        rol: z.string(),
        genero: InvitadoSchema.shape.genero,
        fecha: z.string().describe('Como lo dijo el humano, por ejemplo "jueves 6 de agosto"'),
        hora: z.string().describe('Por ejemplo "21:00 hs"'),
        enVivo: z.boolean(),
      }),
      execute: async (datos) => {
        const crudo = await conv.estado();
        const estado = EstadoThreadSchema.safeParse(crudo);
        if (!estado.success || !estado.data.foto) {
          return { ok: false, motivo: "Todavía no hay una foto validada en este thread." };
        }

        const placa = PlacaSchema.parse({
          invitado: {
            nombre: datos.nombre,
            rol: datos.rol,
            genero: datos.genero,
            fuentes: [],
          },
          fotoElegida: estado.data.foto,
          fecha: datos.fecha,
          hora: datos.hora,
          enVivo: datos.enVivo,
        });

        const { png } = await generarPlaca(placa);
        await conv.publicarPlaca(datos.nombre, png);
        await conv.guardar({ nombre: datos.nombre, copy: CopySchema.parse({ ...datos, fuentes: [] }) });
        return { ok: true };
      },
    }),
  };
}

export function crearAgente(conv: Conversacion) {
  return new ToolLoopAgent({
    model: google(MODELO),
    instructions: INSTRUCCIONES,
    tools: crearHerramientas(conv),
  });
}
