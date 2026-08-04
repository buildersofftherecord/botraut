/** @jsxImportSource react */
import { ImageResponse } from "@vercel/og";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type NombreLienzo } from "./lienzos";
import { COLOR } from "./tokens";
import type { DatosPlaca } from "../lib/tipos";

export const DATOS_DEMO: DatosPlaca = {
  invitado: {
    nombre: "Naomi Couriel",
    rol: "AI Engineering en UdeSA y Data & AI en Ualá",
    genero: "f",
    fuentes: ["https://ejemplo.com/naomi"],
  },
  fotoElegida: {
    url: "https://ejemplo.com/foto.jpg",
    fuente: "https://ejemplo.com/nota",
    ancho: 1200,
    alto: 1600,
  },
  fecha: "JUEVES 30 DE JULIO",
  hora: "21:00 HS",
  enVivo: true,
};

/**
 * `fotoPng` viene ya recortada y en B/N: Satori no soporta `filter`, así que
 * toda transformación de imagen pasa por sharp antes de llegar acá.
 */
export async function renderizar(
  datos: DatosPlaca,
  nombreLienzo: NombreLienzo,
  fotoPng?: Buffer,
): Promise<Buffer> {
  const l = LIENZOS[nombreLienzo];
  const fuentes = await cargarFuentes();

  const respuesta = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: l.ancho,
          height: l.alto,
          background: COLOR.negro,
          position: "relative",
        }}
      />
    ),
    { width: l.ancho, height: l.alto, fonts: fuentes },
  );

  return Buffer.from(await respuesta.arrayBuffer());
}
