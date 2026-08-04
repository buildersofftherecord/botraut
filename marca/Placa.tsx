/** @jsxImportSource react */
import { ImageResponse } from "@vercel/og";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type NombreLienzo } from "./lienzos";
import { COLOR, FUENTE } from "./tokens";
import { Esquinas, Etiqueta, PuntoRec } from "./Hud";
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
          fontFamily: FUENTE.mono,
        }}
      >
        <Esquinas lienzo={l} />

        {/* REC, arriba a la izquierda */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 8,
            left: l.margen + 28,
            display: "flex",
            alignItems: "center",
            gap: 10,
          }}
        >
          <Etiqueta>REC</Etiqueta>
          <PuntoRec />
        </div>

        {/* Timecode y cámara, arriba a la derecha. Decorativos y fijos: un
            timecode que cambiara por placa rompería el determinismo. */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 8,
            right: l.margen + 28,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6,
          }}
        >
          <Etiqueta>00:00:07:21</Etiqueta>
          <Etiqueta color={COLOR.t55}>CAM 01</Etiqueta>
        </div>
      </div>
    ),
    { width: l.ancho, height: l.alto, fonts: fuentes },
  );

  return Buffer.from(await respuesta.arrayBuffer());
}
