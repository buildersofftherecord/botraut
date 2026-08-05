import { z } from "zod";
import { CopySchema } from "./tipos";

/**
 * Lo que vive entre el turno 1 y los siguientes. Se valida **al leer**, no
 * solo al escribir: de Redis (o de `state-memory`) vuelve JSON sin tipo, y un
 * estado guardado por una versión anterior de este schema llegaría como `any`
 * hasta romper adentro del render, en vez de fallar acá con un mensaje claro.
 *
 * Todavía no incluye la foto — la agrega la Task 22 cuando el humano la sube.
 * Extender esto es sumar un campo (p. ej. `foto: FotoSchema.optional()`), no
 * rehacer el schema.
 */
export const EstadoThreadSchema = z.object({
  nombre: z.string().min(1).max(24),
  copy: CopySchema,
});

export type EstadoThread = z.infer<typeof EstadoThreadSchema>;
