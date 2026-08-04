/**
 * Spike: ¿el copy generado sirve para publicar, o lo vas a reescribir siempre?
 * Descartable. No es código de producción.
 */
import { generateObject, generateText } from "ai";
import { google } from "@ai-sdk/google";
import { InvitadoSchema } from "../lib/tipos.ts";

const SISTEMA = `Sos quien escribe las placas de anuncio de Builders Off The Record,
un podcast argentino de tecnología.

Devolvé sobre la persona:
- nombre: como se escribe, máximo 24 caracteres
- rol: a qué se dedica HOY. Máximo 70 caracteres. Concreto y verificable:
  cargo y lugar. Ejemplo bueno: "AI Engineering en UdeSA y Data & AI en Ualá".
- genero: f, m o x
- fuentes: las URLs de donde sacaste la información

Castellano rioplatense. El rol describe lo que la persona hace, no lo que vale:
nada de "referente", "pionero", "líder", "visionario", ni adjetivos de bio de
LinkedIn. Si no encontrás información confiable, decilo en el rol con el texto
exacto NO_ENCONTRADO en vez de inventar.`;

const NOMBRES = [
  "Guillermo Rauch",
  "Naomi Couriel",
  "Francisco Veiras",
  "Santiago Echazu",
  "Evil Rabbit",
  "Gentleman Programming",
];

const MODELO = "gemini-3.6-flash";

for (const nombre of NOMBRES) {
  console.log(`\n═══════ ${nombre} ═══════`);

  // A — sin búsqueda: solo lo que el modelo sabe de memoria
  const t0 = Date.now();
  try {
    const { object } = await generateObject({
      model: google(MODELO),
      schema: InvitadoSchema,
      system: SISTEMA,
      prompt: `La persona es: ${nombre}`,
    });
    console.log(`  SIN BÚSQUEDA (${((Date.now() - t0) / 1000).toFixed(1)}s)`);
    console.log(`    rol   : ${object.rol}`);
    console.log(`    nombre: ${object.nombre}   genero: ${object.genero}`);
  } catch (e) {
    console.log(`  SIN BÚSQUEDA ✗ ${(e as Error).message.split("\n")[0].slice(0, 90)}`);
  }

  // B — con grounding de Google Search
  const t1 = Date.now();
  try {
    const { text, sources } = await generateText({
      model: google(MODELO),
      tools: { google_search: google.tools.googleSearch({}) },
      system: SISTEMA,
      prompt: `La persona es: ${nombre}. Buscá en la web y devolvé SOLO un JSON con las claves nombre, rol, genero, fuentes.`,
    });
    const json = text.match(/\{[\s\S]*\}/)?.[0];
    const o = json ? JSON.parse(json) : null;
    console.log(`  CON BÚSQUEDA (${((Date.now() - t1) / 1000).toFixed(1)}s, ${sources?.length ?? 0} fuentes)`);
    console.log(`    rol   : ${o?.rol ?? "(no parseó)"}`);
  } catch (e) {
    console.log(`  CON BÚSQUEDA ✗ ${(e as Error).message.split("\n")[0].slice(0, 90)}`);
  }
}
