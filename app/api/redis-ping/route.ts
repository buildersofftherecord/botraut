import { createClient } from "redis";

/**
 * Diagnóstico temporal: ¿las credenciales del store de Upstash funcionan desde
 * adentro de Vercel? Desde afuera dan WRONGPASS, y la hipótesis es que sean de
 * vida corta o que solo valgan en el runtime donde Vercel las inyecta.
 *
 * Si esto devuelve ok:true, la base está sana y el error era probar desde local.
 * Borrar apenas se responda la pregunta.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const url = process.env.REDIS_URL;
  if (!url) {
    return Response.json({ ok: false, motivo: "REDIS_URL no está definida" });
  }

  const cliente = createClient({
    url,
    socket: { connectTimeout: 5000, reconnectStrategy: false },
  });
  cliente.on("error", () => {}); // sin esto el error tumba el proceso

  try {
    await cliente.connect();
    const pong = await cliente.ping();
    await cliente.quit();
    // El host sirve para confirmar contra qué base respondió; no es secreto.
    return Response.json({ ok: true, pong, host: new URL(url).hostname });
  } catch (e) {
    return Response.json({
      ok: false,
      error: e instanceof Error ? e.message : String(e),
      host: new URL(url).hostname,
    });
  }
}
