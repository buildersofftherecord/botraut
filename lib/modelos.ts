import { google } from "@ai-sdk/google";
import type { LanguageModel } from "ai";

/**
 * El único lugar del proyecto que sabe qué modelo corre cada cosa, y el único
 * que importa un proveedor.
 *
 * Antes esto estaba copiado en cuatro archivos —`agente.ts`, `buscar.ts`,
 * `mirar.ts`, `encuadre.ts`— cada uno con su `process.env.MODELO_… ?? "…"` y su
 * `google(MODELO)`. Cuatro copias de la misma decisión es cuatro lugares donde
 * cambiarla, y el proyecto ya se quemó una vez con un valor duplicado que se
 * desincronizó (ver `LADO_MINIMO` en `lib/tipos.ts`).
 *
 * ── Por qué es agnóstico ──
 *
 * `LanguageModel` del AI SDK v7 acepta **un string** además de un objeto de
 * proveedor: un slug `proveedor/modelo` se resuelve contra el proveedor global,
 * que es AI Gateway. Eso es lo que permite cambiar de proveedor sin tocar
 * código:
 *
 *   MODELO_COPY=gemini-3.5-flash-lite          → Google directo, con
 *                                                GOOGLE_GENERATIVE_AI_API_KEY
 *   MODELO_COPY=google/gemini-3.5-flash-lite   → el mismo modelo vía Gateway
 *   MODELO_COPY=anthropic/claude-sonnet-5      → otro proveedor, vía Gateway
 *
 * La barra es el interruptor. No hay una bandera `USAR_GATEWAY` porque sería un
 * segundo estado que puede contradecir al slug; con esto la variable dice a la
 * vez qué modelo y por dónde.
 *
 * El día que se migre a Gateway —hoy no se puede, pide tarjeta, ver
 * `docs/decisiones/003`— el cambio es agregar el prefijo en las variables de
 * entorno de Vercel. Este archivo no se toca.
 */

/** Para qué se usa el modelo. Cada rol puede correr uno distinto. */
export type Rol = "agente" | "copy" | "vision" | "encuadre";

/**
 * Qué variables de entorno mira cada rol, en orden.
 *
 * La segunda entrada existe para no romper lo que ya está desplegado: hasta
 * ahora el agente y el encuadre leían `MODELO_COPY`, así que si alguien la
 * tiene puesta en Vercel tiene que seguir mandando. `MODELO_AGENTE` es nueva y
 * gana cuando está: el agente hace tool calling y el de copy hace extracción
 * estructurada, y no tienen por qué ser el mismo modelo.
 *
 * `vision` a propósito NO cae en `MODELO_COPY`: su default es `flash` y no
 * `flash-lite` porque juzgar una imagen es más duro que redactar un rol.
 * Heredar el de copy lo degradaría en silencio.
 */
const VARIABLES: Record<Rol, readonly string[]> = {
  agente: ["MODELO_AGENTE", "MODELO_COPY"],
  copy: ["MODELO_COPY"],
  vision: ["MODELO_VISION"],
  encuadre: ["MODELO_ENCUADRE", "MODELO_COPY"],
};

/**
 * Lo que corre si no hay nada en el entorno. Son los valores probados hoy.
 *
 * `gemini-3.6-flash` tiene 20 pedidos por día en el tier gratis, y un agente
 * gasta varios por conversación: se agotaba antes de la segunda placa.
 * `gemini-3.5-flash-lite` responde y llama herramientas bien — probado contra
 * la API real, armó un `generar_placa` completo a partir de una conversación
 * desordenada.
 *
 * `encuadre` usa el mismo: medido cuatro veces sobre la referencia, la línea de
 * los ojos dio 25.5, 25.7, 25.7 y 25.7 (ver `lib/encuadre.ts`).
 */
const POR_DEFECTO: Record<Rol, string> = {
  agente: "gemini-3.5-flash-lite",
  copy: "gemini-3.5-flash-lite",
  vision: "gemini-3.5-flash",
  encuadre: "gemini-3.5-flash-lite",
};

/**
 * El slug configurado para un rol.
 *
 * Se exporta aparte de `modelo()` para poder loguearlo y testearlo sin
 * construir un proveedor.
 *
 * Trata el string vacío como "no configurado", que es distinto de lo que hacía
 * el `??` que había en cada archivo. `.env.example` lista `MODELO_COPY=` sin
 * valor: copiarlo a `.env.local` dejaba la variable en `""`, `??` la daba por
 * buena y terminábamos llamando a `google("")`.
 */
export function slugDe(rol: Rol): string {
  for (const variable of VARIABLES[rol]) {
    const valor = process.env[variable]?.trim();
    if (valor) return valor;
  }
  return POR_DEFECTO[rol];
}

/**
 * El modelo listo para pasarle a `generateObject` o a `ToolLoopAgent`.
 *
 * Se resuelve en cada llamada y no una vez al cargar el módulo: en serverless
 * el entorno está disponible siempre, pero los tests necesitan poder cambiar
 * `process.env` entre casos, y un valor congelado al importar lo impide.
 */
export function modelo(rol: Rol): LanguageModel {
  const slug = slugDe(rol);
  return slug.includes("/") ? slug : google(slug);
}
