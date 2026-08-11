import { generateObject } from "ai";
import { z } from "zod";
import { modelo } from "./modelos";

export type Veredicto = { sirve: true } | { sirve: false; motivo: string };

/**
 * Objeto plano, no `z.discriminatedUnion`: sigue la misma forma que
 * `CopySchema` en `lib/buscar.ts` — un objeto chato es más robusto contra un
 * modelo que arma el JSON de a poco (`generateObject`/salida estructurada)
 * que un union discriminado. `Veredicto` (arriba) es la forma tipada que sí
 * expone esta función; acá abajo se arma a mano después de la llamada.
 */
const RespuestaSchema = z.object({
  sirve: z.boolean(),
  motivo: z.string().min(1).optional(),
});

/**
 * Si el modelo dice `sirve: false` pero no llena `motivo` (no debería pasar
 * con el prompt de abajo, que se lo pide explícito) — un motivo vacío en
 * Slack es peor que uno genérico.
 */
const MOTIVO_SIN_EXPLICAR = "Esa foto no queda bien en la placa. Probá con otra.";

/**
 * La spec §8 marca dos de los cuatro requisitos de la foto como "no
 * verificable en código": que el fondo se recorte limpio y que la persona
 * esté bien expuesta. Un modelo de visión sí los puede juzgar, y de paso
 * contesta la pregunta que hoy nadie hace hasta que la placa ya se publicó:
 * ¿el recorte de fondo salió limpio? Por eso se le muestra la silueta ya
 * recortada (ver `lib/silueta.ts`), no la foto original.
 *
 * Permisivo a propósito: el objetivo de la Task 22b es que casi no haya
 * rechazos. Un umbral fijo (como el `PROPORCION_MAXIMA` que reemplaza) no
 * sabe distinguir "esto no es ideal" de "esto va a arruinar la placa"; se le
 * pide al modelo esa misma distinción en criollo, y que ante la duda
 * apruebe.
 */
export const PROMPT = `Estás mirando el recorte de una foto para la placa de anuncio de
un invitado de Builders Off The Record (BOTR), un podcast argentino de tecnología.
El fondo ya se borró: lo que ves es la persona sola, recortada, sin nada alrededor.

Evaluá si esta foto SIRVE para el template. Los únicos motivos válidos de
rechazo son:

- Hay dos o más personas en el recorte (el recorte las agarra a todas juntas,
  no se puede separar)
- Es un primer plano de cara — hace falta que se vea al menos de medio cuerpo
  para arriba
- La persona está de espaldas, o de perfil completo (ni de frente ni de tres cuartos)
- El recorte de fondo quedó sucio: quedan pedazos de fondo pegados, o le
  falta un brazo, una mano o un hombro que el modelo de segmentación cortó
  por error
- No se le ve bien la cara: está tapada, muy oscura, o fuera de foco

Sé PERMISIVO. El objetivo es que casi no haya rechazos: aceptá salvo que
alguno de estos problemas vaya a arruinar la placa de verdad. Una foto
imperfecta pero usable se acepta. Ante la duda, sirve = true.

Si sirve = false, escribí el motivo en castellano rioplatense: corto,
concreto y accionable, como si le escribieras a la persona por Slack. Por
ejemplo: "Se te ve solo la cara, mandame una de medio cuerpo" — nunca algo
como "la imagen no cumple los requisitos" ni jerga técnica.`;

/** Le muestra la silueta ya recortada al modelo y le pide un veredicto. */
export async function mirarSilueta(png: Buffer): Promise<Veredicto> {
  const { object } = await generateObject({
    model: modelo("vision"),
    schema: RespuestaSchema,
    instructions: PROMPT,
    messages: [
      {
        role: "user",
        content: [{ type: "file", mediaType: "image/png", data: png }],
      },
    ],
  });

  if (object.sirve) return { sirve: true };
  return { sirve: false, motivo: object.motivo ?? MOTIVO_SIN_EXPLICAR };
}
