import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";
import sharp from "sharp";
import { medidaCoherente, type MedidaCara } from "../placas/encuadre";

/**
 * Dónde está la cara en la foto del invitado, medida por un modelo con visión.
 *
 * Es la única pieza del encuadre que necesita un modelo, y lo que le pide es
 * **un dato, no una opinión**: cuatro números que dicen dónde está la cabeza.
 * La decisión de encuadre la toma `placas/encuadre.ts` con aritmética.
 *
 * Esa separación es deliberada. La alternativa —mostrarle la placa terminada al
 * agente y pedirle que ajuste— ya se probó y no converge: lo único que puede
 * hacer con esa opinión es mover `escala` a ciegas, un número por vez. Medir la
 * entrada le pide al modelo lo que hace bien (semántica: esto es una cabeza) y
 * deja lo que hace mal (juicio estético iterativo) fuera del lazo.
 *
 * ── Nunca tira ──
 *
 * Devuelve `undefined` ante cualquier problema: red, cuota, schema, o una
 * medida que no tiene sentido como cara. El que llama cae en la escala fija,
 * que siempre produce algo publicable. Que el bot no pueda hacer una placa
 * porque se cayó una API de visión sería peor que una placa con el encuadre
 * genérico.
 */

/**
 * El modelo. Sale del entorno para poder cambiarlo sin tocar código: si el
 * encuadre sale flojo, subir a uno más potente es una variable, no un deploy
 * distinto.
 *
 * `gemini-3.5-flash-lite` es el mismo que usa el resto del bot y alcanza:
 * medido cuatro veces sobre la referencia, la línea de los ojos dio 25.5, 25.7,
 * 25.7 y 25.7 — más firme que lo que se puede medir a ojo.
 */
const MODELO = process.env.MODELO_ENCUADRE ?? process.env.MODELO_COPY ?? "gemini-3.5-flash-lite";

/**
 * Coordenadas de 0 a 1000, que es la convención con la que estos modelos están
 * entrenados para devolver posiciones. Pedirle fracciones decimales da medidas
 * más ruidosas.
 */
const RespuestaSchema = z.object({
  hayPersona: z.boolean(),
  arriba: z.number().int().min(0).max(1000).describe("y del punto más alto del pelo"),
  abajo: z.number().int().min(0).max(1000).describe("y de la punta del mentón"),
  ojos: z.number().int().min(0).max(1000).describe("y de la línea de los ojos"),
  centro: z.number().int().min(0).max(1000).describe("x del centro de la cara"),
});

const PROMPT = `Medí dónde está la cabeza de la persona en esta imagen.

Coordenadas normalizadas de 0 a 1000: y=0 es el borde superior de la imagen,
y=1000 el inferior; x=0 el borde izquierdo, x=1000 el derecho.

- "arriba" es el punto más alto del pelo, no de la frente.
- "abajo" es la punta del mentón, no el cuello.
- "ojos" es la línea que une los dos ojos.
- "centro" es el eje vertical de la cara, que no es lo mismo que el centro de
  la imagen si la persona está corrida o de perfil.

Si no hay ninguna persona, poné hayPersona en false.`;

/**
 * La foto llega con fondo transparente y en PNG. Se aplana sobre negro y se
 * pasa a JPEG antes de mandarla: un PNG con alfa de 4000px pesa varios MB y la
 * medición no necesita ni ese tamaño ni esa fidelidad.
 *
 * 768px de lado es suficiente —la cabeza ocupa cientos de píxeles— y recorta el
 * costo y la latencia de la llamada.
 */
async function paraMedir(foto: Buffer): Promise<Buffer> {
  return sharp(foto)
    .flatten({ background: "#000000" })
    .resize({ width: 768, height: 768, fit: "inside", withoutEnlargement: true })
    .jpeg({ quality: 82 })
    .toBuffer();
}

/**
 * Mide dónde está la cara.
 *
 * **La foto tiene que venir ya recortada al sujeto** (fondo removido y sin aire
 * alrededor), porque las fracciones que devuelve son relativas a *esta* imagen
 * y `prepararRetrato` las va a aplicar sobre la misma. Medir la original y
 * aplicar sobre la recortada daría un encuadre corrido.
 */
export async function medirCara(fotoRecortada: Buffer): Promise<MedidaCara | undefined> {
  try {
    const { object } = await generateObject({
      model: google(MODELO),
      schema: RespuestaSchema,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: PROMPT },
            { type: "file", mediaType: "image/jpeg", data: await paraMedir(fotoRecortada) },
          ],
        },
      ],
    });

    if (!object.hayPersona) return undefined;

    const medida: MedidaCara = {
      arriba: object.arriba / 1000,
      abajo: object.abajo / 1000,
      ojos: object.ojos / 1000,
      centro: object.centro / 1000,
    };

    // El schema acepta cualquier número en rango, incluido uno absurdo. Esto es
    // la diferencia entre "el modelo respondió" y "el modelo midió algo".
    if (!medidaCoherente(medida)) {
      console.error("medida de cara incoherente, se ignora", medida);
      return undefined;
    }

    return medida;
  } catch (e) {
    // Red, cuota, o el modelo no pudo cumplir el schema. Nada de esto tiene que
    // impedir que salga una placa.
    console.error("no se pudo medir la cara, se usa el encuadre por defecto", e);
    return undefined;
  }
}
