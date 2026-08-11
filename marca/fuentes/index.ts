import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const aca = dirname(fileURLToPath(import.meta.url));

export type Fuente = {
  name: string;
  data: Buffer;
  weight: 400 | 900;
  style: "normal";
};

/**
 * Satori necesita los bytes de la fuente, no un nombre de familia: no tiene
 * acceso a las fuentes del sistema ni a next/font. Por eso los .ttf se
 * versionan en este repo aunque `landing/` los gitignoree.
 */
export async function cargarFuentes(): Promise<Fuente[]> {
  const [archivo, mono] = await Promise.all([
    readFile(join(aca, "Archivo-900-125.ttf")),
    readFile(join(aca, "IBMPlexMono-Regular.ttf")),
  ]);

  return [
    { name: "Archivo", data: archivo, weight: 900, style: "normal" },
    { name: "IBMPlexMono", data: mono, weight: 400, style: "normal" },
  ];
}
