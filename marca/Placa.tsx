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
 * escalonados a simple vista. Renderizar al doble de resolución y bajar con
 * Lanczos da gradación real en el borde — medido en `Placa.test.tsx`,
 * comparando el mismo recorte con y sin supersampling, no contra un número
 * fijo (ese número depende de qué letra caiga en el recorte, no de la
 * calidad del antialiasing).
 *
 * No se resuelve agrandando el lienzo de *salida*: Instagram recomprime todo
 * lo que supere 1080 de ancho, así que lo que se entrega tiene que seguir
 * siendo 1080. El de más resolución es un paso intermedio que se descarta
 * al bajar con Lanczos, no el archivo final.
 */
const SUPERMUESTREO = 2;

const aca = dirname(fileURLToPath(import.meta.url));

/**
 * Una textura por lienzo, no una estirada. Un PNG cuadrado escalado a 1080×1350
 * deforma los dígitos un 25% en vertical y arruina el trabajo de sutileza de la
 * Task 11. Los assets se committean al tamaño *nominal* del lienzo (no al
 * doble del supermuestreo): así siguen el mismo camino que ya recorre
 * `binario.png` para el 1:1 — Satori los estira al lienzo de render (que sí
 * está a 2x) y el Lanczos final los vuelve a bajar junto con todo lo demás.
 * Generarlos ya al doble no ahorra nada porque no hay información extra que
 * ganar escalando un PNG, y acoplaría el asset committeado a un detalle
 * interno (`SUPERMUESTREO`) que Task 11b puede volver a cambiar.
 *
 * `9:16` y `16:9` no tienen asset todavía: son lienzos no activados. Que el
 * `readFile` de más abajo tire ENOENT es el comportamiento correcto — un
 * lienzo sin su textura tiene que romper en desarrollo, no renderizar
 * estirado en producción.
 */
const TEXTURAS: Record<NombreLienzo, string> = {
  "1:1": "binario.png",
  "4:5": "binario-4x5.png",
  "9:16": "binario-9x16.png",
  "16:9": "binario-16x9.png",
};

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
 * Cuerpo real de `renderizar`, parametrizado por el factor de supersampling.
 * Separado así para que `Placa.test.tsx` pueda comparar factor 1 contra
 * factor 2 sobre el mismo recorte de píxeles — la única forma honesta de
 * medir que el supersampling mejora algo, en vez de comparar contra un
 * número fijo que depende del contenido del recorte. Nada fuera de los
 * tests debería llamar a esta función: el factor es un detalle interno,
 * `renderizar` de abajo lo fija en `SUPERMUESTREO` y no lo expone.
 *
 * `fotoPng` viene ya recortada y en B/N: Satori no soporta `filter`, así que
 * toda transformación de imagen pasa por sharp antes de llegar acá.
 */
export async function renderizarConFactor(
  datos: DatosPlaca,
  nombreLienzo: NombreLienzo,
  factor: number,
  fotoPng?: Buffer,
): Promise<Buffer> {
  const nominal = LIENZOS[nombreLienzo];
  const s = factor;

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
  const binario = await readFile(join(aca, "texturas", TEXTURAS[nombreLienzo]));
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

/** Punto de entrada público: fija el factor de supersampling, no lo expone. */
export async function renderizar(
  datos: DatosPlaca,
  nombreLienzo: NombreLienzo,
  fotoPng?: Buffer,
): Promise<Buffer> {
  return renderizarConFactor(datos, nombreLienzo, SUPERMUESTREO, fotoPng);
}
