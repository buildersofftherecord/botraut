import { z } from "zod";

/**
 * Los límites de caracteres no son validación defensiva: son las medidas del
 * template. `nombre` sale de que "GUILLERMO RAUCH" ocupa dos líneas al cuerpo
 * de `LIENZOS["1:1"].nombreTamano`. El modelo recibe estos límites en el
 * prompt y se ajusta solo.
 */
export const InvitadoSchema = z.object({
  nombre: z.string().min(1).max(24),
  rol: z.string().min(1).max(70),
  /** El template dice INVITADA / INVITADO / INVITADX. Es un campo del diseño. */
  genero: z.enum(["f", "m", "x"]),
  fuentes: z.array(z.string().url()).min(1),
});

/**
 * El mínimo de 800px sale de que la foto se renderiza a ~1080 de alto: por
 * debajo de eso se pixela de forma visible.
 */
export const FotoSchema = z.object({
  url: z.string().url(),
  /** La página de donde salió, no el archivo. Es el rastro para derechos. */
  fuente: z.string().url(),
  ancho: z.number().int().min(800),
  alto: z.number().int().min(800),
});

export const PlacaSchema = z.object({
  invitado: InvitadoSchema,
  fotoElegida: FotoSchema,
  fecha: z.string().min(1),
  hora: z.string().min(1),
  enVivo: z.boolean(),
});

export type Invitado = z.infer<typeof InvitadoSchema>;
export type Foto = z.infer<typeof FotoSchema>;
export type DatosPlaca = z.infer<typeof PlacaSchema>;

/** El template dice INVITADA, INVITADO o INVITADX según el género. */
export function etiquetaInvitado(genero: Invitado["genero"]): string {
  return { f: "INVITADA", m: "INVITADO", x: "INVITADX" }[genero];
}
