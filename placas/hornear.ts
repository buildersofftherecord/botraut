/**
 * Hornea la capa fija de cada lienzo a `fijo/*.png`.
 *
 *   npm run hornear
 *
 * Los PNG resultantes **se versionan en el repo**: `Placa.tsx` los lee en vez
 * de regenerarlos, que es de dónde sale el ahorro de 2 segundos por placa. Un
 * clon nuevo no tiene que hornear nada para funcionar.
 *
 * Hay que correrlo cada vez que cambie algo de la capa fija: los tokens del
 * fondo, el logo, el timecode, los márgenes o el ancho del logo. Si te olvidás,
 * `npm test` falla y te lo dice — ese test existe justamente porque una capa
 * horneada se desactualiza en silencio.
 */
import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { generarFijo, rutaFijo } from "./primitivos/Fijo";
import { SUPERMUESTREO } from "./Placa";
import { LIENZOS, type NombreLienzo } from "./lienzos";

const lienzos = Object.keys(LIENZOS) as NombreLienzo[];

for (const lienzo of lienzos) {
  const png = await generarFijo(lienzo, SUPERMUESTREO);
  const ruta = rutaFijo(lienzo);
  await mkdir(dirname(ruta), { recursive: true });
  await writeFile(ruta, png);
  console.log(`→ ${ruta}  (${(png.length / 1e6).toFixed(1)} MB)`);
}
