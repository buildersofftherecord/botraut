import { generateObject } from "ai";
import { google } from "@ai-sdk/google";
import { CopySchema, type Copy } from "./tipos";

const MODELO = process.env.MODELO_COPY ?? "gemini-3.6-flash";

/**
 * El spike de la Task 14 midió que el modelo inventa antes que admitir que no
 * sabe: devolvió "VP of Product en Lightspark" para alguien que hace AI
 * Engineering en UdeSA, con la misma confianza que las respuestas correctas.
 *
 * Por eso el prompt empuja hacia lo impreciso-pero-cierto. Un rol vago se
 * corrige en dos palabras; uno específico e inventado se publica sin que nadie
 * lo note. El humano ve esto en Slack antes de que se renderice nada, así que
 * el modo de falla caro no es "quedó corto" sino "sonaba bien y era falso".
 */
export const PROMPT = `Sos quien escribe las placas de anuncio de Builders Off The Record,
un podcast argentino de tecnología.

Devolvé sobre la persona:
- rol: a qué se dedica HOY. Máximo 70 caracteres.
- genero: f, m o x — la placa dice INVITADA, INVITADO o INVITADX
- fuentes: las URLs de donde sacaste la información

Castellano rioplatense. El rol describe lo que la persona hace, no lo que vale:
nada de "referente", "pionero", "líder", "visionario", ni adjetivos de bio de
LinkedIn.

Sé conservador. Preferí un rol impreciso y cierto antes que uno específico y
dudoso: "Fundador de Awana" es mejor que inventar un cargo exacto que no podés
verificar. Si no estás seguro del lugar donde trabaja hoy, no lo pongas. Si no
sabés nada confiable de la persona, devolvé exactamente NO_ENCONTRADO en el rol.
No completes con algo que suene bien.

No devuelvas el nombre: ya lo tenemos.`;

export async function buscarCopy(nombre: string): Promise<Copy> {
  const { object } = await generateObject({
    model: google(MODELO),
    schema: CopySchema,
    instructions: PROMPT,
    prompt: `La persona es: ${nombre}`,
  });
  return CopySchema.parse(object);
}

/**
 * El humano sabe el dato, no la redacción que entra en 70 caracteres. Le pasa
 * el hecho en lenguaje natural y el modelo se encarga del formato y del tono.
 * Reemplaza el modal de edición que tenía el diseño original.
 */
export async function rehacerCopy(
  nombre: string,
  previo: Copy,
  correccion: string,
): Promise<Copy> {
  const { object } = await generateObject({
    model: google(MODELO),
    schema: CopySchema,
    instructions: PROMPT,
    prompt:
      `La persona es: ${nombre}\n` +
      `Habías dicho: "${previo.rol}"\n` +
      `La corrección del humano es: "${correccion}"\n` +
      `Rehacé el rol respetando la corrección. El humano tiene razón: no discutas el dato.`,
  });
  return CopySchema.parse(object);
}
