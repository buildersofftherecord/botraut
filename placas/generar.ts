/**
 * CLI: arma una placa desde un JSON de datos y una foto.
 *
 *   npm run placa -- --datos muestra/gr.json --foto muestra/gr.png \
 *                    --salida salida/mi-placa.png
 *
 * La foto tiene que llegar ya recortada (fondo transparente). Este script la
 * pasa a B/N y la encuadra, pero no recorta: eso es otro problema.
 */
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { renderizar } from "./Placa";
import { prepararRetrato } from "./primitivos/Retrato";
import { LIENZOS, altoDeFoto, type NombreLienzo } from "./lienzos";
import { validarDatos } from "./datos";

function flag(nombre: string): string | undefined {
  const i = process.argv.indexOf(`--${nombre}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

const rutaDatos = flag("datos") ?? "muestra/gr.json";
const rutaFoto = flag("foto");
const rutaSalida = flag("salida") ?? "salida/placa.png";
const lienzo = (flag("lienzo") ?? "1:1") as NombreLienzo;
/**
 * Cuánto del ancho del cuadro ocupa el invitado. Depende del encuadre de la
 * foto de origen, no del diseño: con la foto de muestra, 1.15 deja al invitado del tamaño
 * que tiene en las placas originales; 1.45 lo agrandaba tanto que se leía una
 * cabeza en vez de una persona, y 0.95 lo dejaba chico y perdido. Depende del
 * encuadre de la foto de origen, no del diseño, y por eso es un flag.
 */
const escalaSujeto = Number(flag("escala") ?? 1.15);

if (!(lienzo in LIENZOS)) {
  console.error(`Lienzo desconocido: ${lienzo}. Opciones: ${Object.keys(LIENZOS).join(", ")}`);
  process.exit(1);
}

let datos;
try {
  datos = validarDatos(JSON.parse(await readFile(rutaDatos, "utf8")));
} catch (e) {
  // Mensaje humano y código 1: quien llama es un agente que tiene que poder
  // leer qué arreglar sin parsear un stack trace.
  console.error(e instanceof Error ? e.message : String(e));
  process.exit(1);
}
const l = LIENZOS[lienzo];

/**
 * La foto se prepara acá y no adentro de `Placa.tsx` porque el template recibe
 * píxeles listos: Satori no soporta `filter`, así que el B/N, la curva de
 * negros y el desvanecido son trabajo de sharp. Se prepara al doble de
 * resolución por el supermuestreo.
 */
const foto = rutaFoto
  ? await prepararRetrato(await readFile(rutaFoto), {
      ancho: Math.round(l.ancho * l.fotoAncho * 2),
      alto: altoDeFoto(l) * 2,
      escalaSujeto,
    })
  : undefined;

const png = await renderizar(datos, lienzo, foto);
await mkdir(dirname(rutaSalida), { recursive: true });
await writeFile(rutaSalida, png);

console.log(`→ ${rutaSalida}  (${l.ancho}×${l.alto})`);
