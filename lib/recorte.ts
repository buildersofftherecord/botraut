import { removeBackground } from "@imgly/background-removal-node";

/**
 * Implementación provisional: el spike local vs. pago (Task 13) nunca corrió
 * porque falta una foto de prueba real. Si esa decisión cambia por
 * remove.bg u otro servicio, el reemplazo es este archivo — la firma de
 * `recortar` es el contrato con `procesar.ts` y no debería moverse.
 *
 * El recorte es el paso más caro del pipeline, por eso corre una sola vez y
 * solo sobre la foto que el humano eligió, nunca sobre las cuatro candidatas.
 */
export async function recortar(entrada: Buffer): Promise<Buffer> {
  try {
    // `Buffer` sin genérico admite `SharedArrayBuffer`, que `BlobPart` no
    // acepta — de ahí la copia a un `Uint8Array` concreto.
    const salida = await removeBackground(new Blob([new Uint8Array(entrada)]));
    return Buffer.from(await salida.arrayBuffer());
  } catch (e) {
    // `recortar` corre dentro del handler de Slack: si tira, la persona que
    // espera la placa ve este mensaje textual, no el error de onnxruntime —
    // el mismo estándar que `foto.ts` aplica a sus `motivo`. La causa cruda
    // queda en `cause` para quien mire logs, nunca concatenada al texto.
    throw new Error(
      "No pude recortar el fondo de esa foto. Probá con otra, preferentemente con el fondo más despejado.",
      { cause: e },
    );
  }
}
