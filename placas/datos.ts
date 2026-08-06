import { z } from "zod";

/**
 * Todo lo que cambia de una placa a la otra. Nada más.
 *
 * Si algo de la placa no está acá, es del diseño y no se toca por invitado: el
 * timecode, el fondo y el logo son fijos a propósito y viven en la capa
 * horneada (ver `primitivos/Fijo.tsx`).
 *
 * ── Por qué hay un schema y no solo tipos ──
 *
 * Esto lo va a llamar un agente, no una persona mirando el resultado. Sin
 * validación, `{ genero: "otro" }` renderiza la placa con la etiqueta
 * INVITADO/INVITADA **vacía** y sale con código 0; sin `rol`, la placa sale sin
 * la línea del rol. Las dos cosas se postean rotas y nadie se entera. Un tipo
 * de TypeScript no ataja nada de eso, porque los datos llegan de un JSON.
 *
 * Los límites no son defensivos: son las medidas del template. Cuando algo no
 * entra, el mensaje dice cuánto mide y cuánto entra, para que quien llama pueda
 * arreglarlo sin abrir este archivo.
 */

/**
 * Cuántos caracteres entran en una fila de la caja de datos.
 *
 * Sale de la geometría, no de un número redondo: la caja mide `cajaAncho` 480px
 * y le quedan **347px** de texto después del ícono (22), los dos gaps (20+20),
 * el separador (1), el padding (34×2) y el borde (1×2). IBM Plex Mono a 20px
 * avanza 12px por carácter, más 3.2px del tracking del HUD = 15.2px, salvo el
 * último que no lleva tracking. 23 caracteres son 346.4px y 24 son 361.6.
 *
 * Estuvo en 22 hasta que `pruebas/datos.test.ts` lo midió con la fuente real:
 * yo había calculado el presupuesto a partir de `"JUEVES 30 DE SEPTIEMBRE"` y
 * después derivado el límite de ese mismo número, que es circular. El caso peor
 * real —ese mismo string, de 23 caracteres— entra exacto.
 *
 * Si cambiás `cajaAncho`, `HUD.labelTamano` o el padding de la caja, ese test
 * falla y hay que recalcular esto.
 */
export const MAX_CARACTERES_FILA = 23;

/**
 * El techo del nombre no es tipográfico: `tamanoNombre()` achica la fuente
 * hasta que la palabra más ancha entre en la columna, así que un nombre largo
 * *entra* — pero entra chico y deja de leerse como titular. 24 caracteres es
 * donde "GUILLERMO RAUCH" todavía manda y "MAXIMILIANO ETCHECOPAR" ya está en
 * el borde.
 */
export const InvitadoSchema = z.object({
  nombre: z
    .string({ error: "Falta el nombre del invitado." })
    .trim()
    .min(1, "El nombre no puede estar vacío.")
    .max(24, "El nombre no puede pasar de 24 caracteres o queda demasiado chico en la placa."),
  rol: z
    .string({ error: "Falta el rol. Sin él la placa sale con un hueco debajo del nombre." })
    .trim()
    .min(1, "Falta el rol. Sin él la placa sale con un hueco debajo del nombre.")
    .max(70, "El rol no puede pasar de 70 caracteres: arriba de eso empuja la caja de datos."),
  genero: z.enum(["f", "m", "x"], {
    message: 'El género tiene que ser "f", "m" o "x" — decide si la etiqueta dice INVITADA, INVITADO o INVITADX.',
  }),
});

const filaCaja = (campo: string, ejemplo: string) =>
  z
    .string({ error: `Falta ${campo}.` })
    .trim()
    .min(1, `Falta ${campo}.`)
    .max(
      MAX_CARACTERES_FILA,
      `${campo} no puede pasar de ${MAX_CARACTERES_FILA} caracteres: la caja de datos tiene ancho fijo. Ejemplo válido: "${ejemplo}".`,
    );

export const PlacaSchema = z.object({
  invitado: InvitadoSchema,
  /** Ya formateada y en el idioma final. El template no la interpreta. */
  fecha: filaCaja("la fecha", "JUEVES 20 DE AGOSTO"),
  /** Ya formateada. */
  hora: filaCaja("la hora", "21:00 HS"),
  /**
   * La caja de datos tiene tres filas fijas y la tercera dice siempre EN VIVO,
   * porque así son las cinco placas originales y porque una caja de altura
   * variable no se puede hornear.
   *
   * El campo sigue existiendo para que el día que haya un episodio grabado la
   * decisión se tome explícitamente. Hasta entonces `false` falla en vez de
   * renderizar una placa que dice EN VIVO sobre algo que no lo es.
   */
  enVivo: z.literal(true, {
    message:
      "Por ahora la placa sólo soporta episodios en vivo: la tercera fila de la caja dice EN VIVO y es fija. " +
      "Si hay un episodio grabado, hay que decidir qué dice esa fila antes de generarlo.",
  }),
});

export type Invitado = z.infer<typeof InvitadoSchema>;
export type DatosPlaca = z.infer<typeof PlacaSchema>;

/**
 * Valida y devuelve los datos, o tira con todos los problemas juntos en un
 * mensaje legible.
 *
 * Junta *todos* los errores en vez de cortar en el primero: quien llama es un
 * agente que va a arreglar el JSON y volver a intentar, y hacerlo de a un error
 * por vez cuesta una corrida de 1.5s cada una.
 */
export function validarDatos(crudo: unknown): DatosPlaca {
  const r = PlacaSchema.safeParse(crudo);
  if (r.success) return r.data;

  const problemas = r.error.issues.map((i) => {
    const donde = i.path.join(".");
    return donde ? `  · ${donde}: ${i.message}` : `  · ${i.message}`;
  });
  throw new Error(`Los datos de la placa no son válidos:\n${problemas.join("\n")}`);
}

/** El template dice INVITADA, INVITADO o INVITADX según el género. */
export function etiquetaInvitado(genero: Invitado["genero"]): string {
  return { f: "INVITADA", m: "INVITADO", x: "INVITADX" }[genero];
}
