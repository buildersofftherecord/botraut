import { after } from "next/server";
import { bot } from "@/bot";

/**
 * `bot.webhooks.slack` ya responde 200 sin esperar al handler (fire-and-forget
 * interno del Chat SDK) — así que el ack de Slack nunca depende de cuánto
 * tarde `buscarCopy`. Lo que sí depende de esto es que la función serverless
 * siga viva: sin `waitUntil`, Vercel puede matar la instancia apenas se manda
 * la respuesta, cortando el trabajo de fondo a mitad de camino. `after()` la
 * mantiene viva hasta que la promesa termine o hasta `maxDuration`.
 */
export async function POST(request: Request) {
  return bot.webhooks.slack(request, {
    waitUntil: (tarea) => after(() => tarea),
  });
}

/**
 * El camino largo es historial de Slack + varias vueltas del agente + recorte
 * de fondo + render. Con 60s la función moría a mitad de camino y Vercel la
 * mataba con SIGTERM, sin dejar nada publicado en el thread.
 */
export const maxDuration = 300;
