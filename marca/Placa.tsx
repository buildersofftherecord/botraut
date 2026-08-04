/** @jsxImportSource react */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type NombreLienzo } from "./lienzos";
import { COLOR, FUENTE } from "./tokens";
import { Esquinas, Etiqueta, PuntoRec } from "./Hud";
import { IconoCalendario, IconoReloj, IconoSenal } from "./Iconos";
import { etiquetaInvitado, type DatosPlaca } from "../lib/tipos";
import { tamanoNombre, NOMBRE_LETTER_SPACING_EM } from "./medirNombre";

const aca = dirname(fileURLToPath(import.meta.url));

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
  const anchoColumna = l.ancho * (1 - l.fotoAncho) - l.margen - 40;
  const sticker = await readFile(join(aca, "svg", "botr-sticker.svg"));
  const [fuentes, tamanoDelNombre] = await Promise.all([
    cargarFuentes(),
    tamanoNombre(datos.invitado.nombre, anchoColumna, l.nombreTamano),
  ]);

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
        {/* La foto: a sangre derecha, cortada abajo. Llega ya recortada y en
            B/N desde lib/procesar.ts — Satori no soporta filter. Va primera
            en el árbol para que el marco HUD y la tipografía pinten encima. */}
        {fotoPng ? (
          <img
            src={`data:image/png;base64,${fotoPng.toString("base64")}`}
            style={{
              position: "absolute",
              right: 0,
              bottom: 0,
              width: l.ancho * l.fotoAncho,
              height: l.alto * 0.94,
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        ) : null}

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
              fontSize: tamanoDelNombre,
              lineHeight: 0.92,
              letterSpacing: `${NOMBRE_LETTER_SPACING_EM}em`,
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

        {/* Caja de datos, abajo a la izquierda */}
        <div
          style={{
            position: "absolute",
            left: l.margen + 28,
            bottom: l.margen + 60,
            display: "flex",
            flexDirection: "column",
            border: `1px solid ${COLOR.linea}`,
            padding: "26px 34px",
            gap: 22,
          }}
        >
          {[
            { icono: <IconoCalendario />, texto: datos.fecha, vivo: false },
            { icono: <IconoReloj />, texto: datos.hora, vivo: false },
            ...(datos.enVivo
              ? [{ icono: <IconoSenal />, texto: "EN VIVO", vivo: true }]
              : []),
          ].map((fila, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 }}>
              {fila.icono}
              <div style={{ display: "flex", width: 1, height: 24, background: COLOR.linea }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {fila.vivo ? <PuntoRec tamano={8} /> : null}
                <Etiqueta color={COLOR.t75}>{fila.texto}</Etiqueta>
              </div>
            </div>
          ))}
        </div>

        {/* El sticker: el wordmark con placa rotado -7°. Es una aplicación de
            la marca, no el logo — ver landing/docs/marca.md. Va última en el
            árbol para quedar por encima de la foto. */}
        <img
          src={`data:image/svg+xml;base64,${sticker.toString("base64")}`}
          style={{
            position: "absolute",
            right: l.margen + 20,
            bottom: l.margen + 24,
            width: 320,
          }}
        />
      </div>
    ),
    { width: l.ancho, height: l.alto, fonts: fuentes },
  );

  return Buffer.from(await respuesta.arrayBuffer());
}
