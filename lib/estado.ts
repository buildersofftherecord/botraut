import { z } from "zod";
import { CopySchema, FotoSchema, InvitadoSchema } from "./tipos";

/**
 * Lo que vive entre el turno 1 y los siguientes. Se valida **al leer**, no
 * solo al escribir: de Redis (o de `state-memory`) vuelve JSON sin tipo, y un
 * estado guardado por una versión anterior de este schema llegaría como `any`
 * hasta romper adentro del render, en vez de fallar acá con un mensaje claro.
 *
 * `foto` es opcional porque el estado existe desde el turno 1 (nombre + copy)
 * sin ella — la agrega el turno 2 cuando el humano la sube, o el propio turno
 * 1 si vino adjunta al mismo mensaje que el nombre. No guarda los bytes: solo
 * la URL (para volver a bajarla en la Task 23) y las medidas ya validadas.
 */
export const EstadoThreadSchema = z.object({
  // Deriva de `InvitadoSchema` en vez de repetir el límite: son el mismo
  // nombre, y dos declaraciones podrían divergir sin que nada avise.
  nombre: InvitadoSchema.shape.nombre,
  copy: CopySchema,
  foto: FotoSchema.optional(),
});

export type EstadoThread = z.infer<typeof EstadoThreadSchema>;
