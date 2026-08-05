import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

const MODELO = process.env.MODELO_COPY ?? "gemini-3.6-flash";

export const IntencionSchema = z.object({
  tipo: z.enum(["corregir", "confirmar", "reiniciar", "pedido", "otro"]),
});

export type Intencion = z.infer<typeof IntencionSchema>["tipo"];

/**
 * El bot tenía una sola puerta: cualquier texto que no fuera un adjunto se
 * mandaba a `rehacerCopy` como si fuera un dato del invitado. Entonces "usa
 * esa" volvía a publicar el mismo copy, y "podés recortar esa?" se
 * interpretaba como una corrección sobre la persona.
 *
 * Esto no convierte al bot en agente: el modelo clasifica **qué quisiste**, y
 * qué se hace con cada categoría lo decide el código. La conversación se
 * vuelve flexible en la entrada, el pipeline sigue siendo el mismo de siempre.
 */
const PROMPT = `Clasificás mensajes en un canal de Slack donde se arman placas de
anuncio para un podcast argentino de tecnología.

El flujo es: alguien tira el nombre de un invitado, el bot busca a qué se
dedica, pide una foto, y con eso arma la placa.

Clasificá el último mensaje del humano en una de estas categorías:

- corregir: trae un dato sobre el invitado — a qué se dedica, dónde trabaja,
  cómo se escribe su nombre, su handle. Ejemplos: "no, es founder de Awana",
  "trabaja en Vercel", "es Echazú con acento".

- confirmar: acepta o aprueba lo que el bot propuso, sin aportar datos nuevos.
  Ejemplos: "dale", "usa esa", "está bien", "sí", "perfecto", "esa misma".

- reiniciar: quiere empezar de nuevo o cambiar de invitado. Ejemplos:
  "empecemos de nuevo", "no, otro invitado", "cancelá".

- pedido: le pide al bot que haga algo, en vez de darle un dato. Ejemplos:
  "podés recortar esa?", "hacela más grande", "cambiá la fecha", "mandámela de
  nuevo".

- otro: no encaja en ninguna, o no se entiende.

Ante la duda entre "corregir" y otra, elegí "corregir" solo si el mensaje
efectivamente aporta información sobre la persona. Un mensaje corto de
aprobación no es una corrección.`;

/**
 * Clasifica el mensaje. Nunca tira: si el modelo falla, el mensaje entra como
 * `corregir`, que es el comportamiento que el bot tenía antes de existir esta
 * función — degradar al camino viejo es preferible a dejar al humano sin
 * respuesta por un problema de red.
 */
export async function clasificar(mensaje: string): Promise<Intencion> {
  try {
    const { object } = await generateObject({
      model: google(MODELO),
      schema: IntencionSchema,
      instructions: PROMPT,
      prompt: `Mensaje del humano: ${mensaje}`,
    });
    return IntencionSchema.parse(object).tipo;
  } catch (e) {
    console.error(`clasificar falló para "${mensaje}"`, e);
    return "corregir";
  }
}
