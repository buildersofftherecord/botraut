import sharp from "sharp";

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
    // Import dinámico a propósito. En el tope del archivo, `@imgly` (155MB de
    // paquete, 127MB de modelo, binarios nativos de onnxruntime) se carga
    // cuando arranca la función de Slack, aunque el mensaje que llegó no tenga
    // ninguna foto. Si esa carga falla, la función entera muere con un 500 de
    // cuerpo vacío y el bot deja de contestar cualquier cosa — que es
    // exactamente lo que pasó en producción el 2026-08-05.
    //
    // Acá adentro, el costo lo paga solo el camino que recorta, y un fallo de
    // carga cae en el `catch` de abajo como cualquier otro error.
    const { removeBackground } = await import("@imgly/background-removal-node");

    // La librería lee `blob.type` directamente, sin detectar el formato por
    // magic bytes — un Blob sin `type` tira "Unsupported format: " aunque
    // los bytes sean un JPEG válido. `descargar()` no conserva el
    // content-type de la respuesta HTTP, así que se detecta acá con sharp
    // en vez de confiar en el header (que además puede faltar o mentir).
    const { format } = await sharp(entrada).metadata();

    // `Buffer` sin genérico admite `SharedArrayBuffer`, que `BlobPart` no
    // acepta — de ahí la copia a un `Uint8Array` concreto.
    const salida = await removeBackground(
      new Blob([new Uint8Array(entrada)], { type: `image/${format}` }),
    );
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
