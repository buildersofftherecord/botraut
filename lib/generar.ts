import { descargar } from "./procesar";
import { recortar } from "./recorte";
import { armarPlaca, type ResultadoPlaca } from "./placa";

/**
 * El puente entre Slack y `placas/`.
 *
 * `placas/` recibe una foto **ya recortada** y no verifica que lo esté — con un
 * JPEG crudo genera la placa igual, con el rectángulo visible. El recorte es
 * responsabilidad de quien llama, y acá es donde vive: la foto llega de Slack
 * como el humano la subió.
 *
 * Todo lo demás que antes hacía este archivo —pasar a B/N, ajustar el alto,
 * recortar al sujeto— ahora lo hace `prepararRetrato` adentro de `placas/`,
 * junto con la curva de negros y el desvanecido del borde. Eso es diseño y
 * pertenece al paquete del diseño.
 */

/**
 * Las URLs de archivo de Slack son privadas: sin el header, Slack devuelve 200
 * con el HTML de su página de login en vez de un 401.
 */
function autorizacionSlack(): HeadersInit | undefined {
  const token = process.env.SLACK_BOT_TOKEN;
  return token ? { Authorization: `Bearer ${token}` } : undefined;
}

const NO_SE_PUDO_BAJAR =
  "No pude bajar la foto de Slack. Probá subirla de nuevo.";

/**
 * Nunca tira: devuelve el motivo como texto publicable. Lo que sale de acá lo
 * repite el agente en el canal.
 */
export async function generarPlaca(datos: unknown, urlFoto: string): Promise<ResultadoPlaca> {
  let original: Buffer;
  try {
    original = await descargar(urlFoto, autorizacionSlack());
  } catch (e) {
    // `descargar` no traduce sus errores: salen como `descarga: HTTP 404 en
    // <url>`, que además filtra la URL del archivo privado.
    console.error("no se pudo bajar la foto de Slack", e);
    return { ok: false, motivo: NO_SE_PUDO_BAJAR };
  }

  let recortada: Buffer;
  try {
    recortada = await recortar(original);
  } catch (e) {
    // `recortar` ya deja un mensaje humano — se publica tal cual.
    console.error("falló el recorte de fondo", e);
    return { ok: false, motivo: e instanceof Error ? e.message : NO_SE_PUDO_BAJAR };
  }

  return armarPlaca(datos, recortada);
}
