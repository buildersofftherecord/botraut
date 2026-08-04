import { writeFile, mkdir } from "node:fs/promises";
import { renderizar, DATOS_DEMO } from "../marca/Placa";
import type { NombreLienzo } from "../marca/lienzos";

const lienzo = (process.argv[2] ?? "1:1") as NombreLienzo;

const png = await renderizar(DATOS_DEMO, lienzo);
await mkdir("salidas", { recursive: true });
const destino = `salidas/placa-${lienzo.replace(":", "x")}.png`;
await writeFile(destino, png);

console.log(`→ ${destino}`);
