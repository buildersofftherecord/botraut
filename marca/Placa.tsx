/** @jsxImportSource react */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";
import sharp from "sharp";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type NombreLienzo } from "./lienzos";
import { COLOR, FUENTE } from "./tokens";
import { Esquinas, Etiqueta, PuntoRec } from "./Hud";
import { IconoCalendario, IconoReloj, IconoSenal } from "./Iconos";
import { etiquetaInvitado, type DatosPlaca } from "../lib/tipos";
import { tamanoNombre, NOMBRE_LETTER_SPACING_EM } from "./medirNombre";

/**
 * Satori antialiasa a 1x y los bordes de la tipografía display quedan
 * escalonados a simple vista. Renderizar al doble y bajar con Lanczos da
 * gradación real: medido, el borde de una letra pasa de ~160 a ~223 niveles
 * de gris distintos.
 *
 * No se resuelve agrandando el lienzo de salida: Instagram recomprime todo lo
 * que supere 1080 de ancho, así que la salida tiene que seguir siendo 1080.
 */
const SUPERMUESTREO = 2;

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
  const nominal = LIENZOS[nombreLienzo];
  const s = SUPERMUESTREO;

  // Todas las medidas que el template usa en px se escalan juntas. Si alguna
  // queda sin escalar, ese elemento sale a la mitad de tamaño relativo.
  const l = {
    ...nominal,
    ancho: nominal.ancho * s,
    alto: nominal.alto * s,
    margen: nominal.margen * s,
    nombreTamano: nominal.nombreTamano * s,
    rolTamano: nominal.rolTamano * s,
  };

  const anchoColumna = l.ancho * (1 - l.fotoAncho) - l.margen - 40 * s;
  const sticker = await readFile(join(aca, "svg", "botr-sticker.svg"));
  const binario = await readFile(join(aca, "texturas", "binario.png"));
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
        {/* Textura de binario: atmósfera de fondo, no información. Va
            primera en el árbol para que todo lo demás pinte encima. */}
        <img
          src={`data:image/png;base64,${binario.toString("base64")}`}
          style={{ position: "absolute", top: 0, left: 0, width: l.ancho, height: l.alto }}
        />

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

        <Esquinas lienzo={l} escala={s} />

        {/* REC, arriba a la izquierda */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 8 * s,
            left: l.margen + 28 * s,
            display: "flex",
            alignItems: "center",
            gap: 10 * s,
          }}
        >
          <Etiqueta escala={s}>REC</Etiqueta>
          <PuntoRec escala={s} />
        </div>

        {/* Timecode y cámara, arriba a la derecha. Decorativos y fijos: un
            timecode que cambiara por placa rompería el determinismo. */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 8 * s,
            right: l.margen + 28 * s,
            display: "flex",
            flexDirection: "column",
            alignItems: "flex-end",
            gap: 6 * s,
          }}
        >
          <Etiqueta escala={s}>00:00:07:21</Etiqueta>
          <Etiqueta color={COLOR.t55} escala={s}>CAM 01</Etiqueta>
        </div>

        {/* Columna izquierda: etiqueta, nombre, rol */}
        <div
          style={{
            position: "absolute",
            top: l.margen + 130 * s,
            left: l.margen + 28 * s,
            width: anchoColumna,
            display: "flex",
            flexDirection: "column",
          }}
        >
          <Etiqueta escala={s}>{etiquetaInvitado(datos.invitado.genero)}</Etiqueta>

          {/* La regla debajo de la etiqueta, como en .hud-label del sitio */}
          <div
            style={{
              display: "flex",
              width: 140 * s,
              height: 1 * s,
              background: COLOR.lineaViva,
              marginTop: 14 * s,
              marginBottom: 34 * s,
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
              marginTop: 30 * s,
            }}
          >
            {datos.invitado.rol}
          </div>
        </div>

        {/* Caja de datos, abajo a la izquierda */}
        <div
          style={{
            position: "absolute",
            left: l.margen + 28 * s,
            bottom: l.margen + 60 * s,
            display: "flex",
            flexDirection: "column",
            border: `${1 * s}px solid ${COLOR.linea}`,
            padding: `${26 * s}px ${34 * s}px`,
            gap: 22 * s,
          }}
        >
          {[
            { icono: <IconoCalendario escala={s} />, texto: datos.fecha, vivo: false },
            { icono: <IconoReloj escala={s} />, texto: datos.hora, vivo: false },
            ...(datos.enVivo
              ? [{ icono: <IconoSenal escala={s} />, texto: "EN VIVO", vivo: true }]
              : []),
          ].map((fila, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 20 * s }}>
              {fila.icono}
              <div style={{ display: "flex", width: 1 * s, height: 24 * s, background: COLOR.linea }} />
              <div style={{ display: "flex", alignItems: "center", gap: 10 * s }}>
                {fila.vivo ? <PuntoRec tamano={8} escala={s} /> : null}
                <Etiqueta color={COLOR.t75} escala={s}>{fila.texto}</Etiqueta>
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
            right: l.margen + 20 * s,
            bottom: l.margen + 24 * s,
            width: 320 * s,
          }}
        />
      </div>
    ),
    { width: l.ancho, height: l.alto, fonts: fuentes },
  );

  const grande = Buffer.from(await respuesta.arrayBuffer());

  // Baja del doble de resolución al tamaño nominal con Lanczos: acá es donde
  // aparece la gradación que Satori no da a 1x.
  return sharp(grande)
    .resize(nominal.ancho, nominal.alto, { kernel: sharp.kernel.lanczos3 })
    .png()
    .toBuffer();
}
