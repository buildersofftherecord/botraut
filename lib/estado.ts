import { z } from "zod";
import { FotoSchema } from "./tipos";

/**
 * Lo único que vive fuera de la conversación: la referencia a la foto.
 *
 * El nombre y el copy no se guardan más. Con el flujo de tres turnos hacían
 * falta porque cada mensaje caía en una función que arrancaba en blanco; con
 * el agente están en el historial de Slack, que es la memoria real. Guardar
 * una segunda copia sería arriesgarse a que las dos digan cosas distintas.
 *
 * La foto sí, porque no es texto: son bytes que se bajan una vez, se validan y
 * se vuelven a necesitar al renderizar.
 *
 * Se valida al leer: de Redis vuelve JSON sin tipo, y un estado guardado por
 * una versión anterior de este schema llegaría como `any` hasta romper adentro
 * del render.
 */
export const EstadoThreadSchema = z.object({
  foto: FotoSchema.optional(),
});

export type EstadoThread = z.infer<typeof EstadoThreadSchema>;
