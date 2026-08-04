/** @jsxImportSource react */
import { ImageResponse } from "@vercel/og";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type NombreLienzo } from "./lienzos";
import { COLOR, FUENTE } from "./tokens";
import { Esquinas, Etiqueta, PuntoRec } from "./Hud";
import { etiquetaInvitado, type DatosPlaca } from "../lib/tipos";

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
 * Ancho medio de un glyph mayúscula de Archivo 900, como fracción del
 * font-size. Medido renderizando el bloque a varios tamaños y comparando el
 * píxel más a la derecha del texto contra el font-size usado (ver
 * "el nombre nunca invade la columna de la foto" en Placa.test.tsx).
 * Redondeado hacia arriba para dejar margen a glyphs anchos (M, W).
 */
const ANCHO_GLYPH_NOMBRE = 0.9;

/**
 * Satori no corta una palabra a mitad de línea: si la palabra más larga del
 * nombre no entra en el ancho disponible al tamaño de diseño, sigue de largo
 * más allá del contenedor en vez de ajustarse (así se descubrió el bug con
 * "Guillermo Rauch" desbordando hacia la columna de la foto). Por eso el
 * tamaño real es dinámico: se calcula el más grande que hace entrar la
 * palabra más larga, sin superar el techo de diseño `tamanoMax`.
 */
export function tamanoNombre(nombre: string, anchoDisponible: number, tamanoMax: number): number {
  const palabraMasLarga = Math.max(...nombre.split(" ").map((p) => p.length));
  const maximoQueEntra = anchoDisponible / (palabraMasLarga * ANCHO_GLYPH_NOMBRE);
  return Math.min(tamanoMax, Math.floor(maximoQueEntra));
}

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
  const anchoColumna = l.ancho * (1 - l.fotoAncho) - l.margen - 40;

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

        {/* Columna izquierda: etiqueta, nombre, rol */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 130,
            left: l.margen + 28,
            width: anchoColumna,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Etiqueta>{etiquetaInvitado(datos.invitado.genero)}</Etiqueta>

          {/* La regla debajo de la etiqueta, como en .hud-label del sitio */}
          <div
            style={{
              display: "flex",
              width: 140,
              height: 1,
              background: COLOR.lineaViva,
              marginTop: 14,
              marginBottom: 34,
            }}
          />

          <div
            style={{
              display: "flex",
              fontFamily: FUENTE.display,
              fontSize: tamanoNombre(datos.invitado.nombre, anchoColumna, l.nombreTamano),
              lineHeight: 0.92,
              letterSpacing: "-0.01em",
              textTransform: "uppercase",
              color: COLOR.blanco,
            }}
          >
            {datos.invitado.nombre}
          </div>

          <div
            style={{
              display: "flex",
              fontFamily: FUENTE.mono,
              fontSize: l.rolTamano,
              lineHeight: 1.5,
              color: COLOR.t75,
              marginTop: 30,
            }}
          >
            {datos.invitado.rol}
          </div>
        </div>
      </div>
    ),
    { width: l.ancho, height: l.alto, fonts: fuentes },
  );

  return Buffer.from(await respuesta.arrayBuffer());
}
