/** @jsxImportSource react */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";
import sharp from "sharp";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, type Lienzo, type NombreLienzo } from "./lienzos";
import { COLOR, NOMBRE_COLOR, FUENTE } from "./tokens";
import { Etiqueta, PuntoRec } from "./primitivos/Hud";
import { IconoCalendario, IconoReloj, IconoSenal } from "./primitivos/Iconos";
import { generarFijo, rutaFijo } from "./primitivos/Fijo";
import { etiquetaInvitado, type DatosPlaca } from "./datos";
import { tamanoNombre, NOMBRE_LETTER_SPACING_EM } from "./medirNombre";

/**
 * Satori antialiasa a 1x y los bordes de la tipografía display quedan
 * escalonados a simple vista. Renderizar al doble de resolución y bajar con
 * Lanczos da gradación real en el borde.
 *
 * No se resuelve agrandando el lienzo de *salida*: Instagram recomprime todo
 * lo que supere 1080 de ancho, así que lo que se entrega tiene que seguir
 * siendo 1080. El de más resolución es un paso intermedio que se descarta
 * al bajar con Lanczos, no el archivo final.
 *
 * Consecuencia para cualquiera que toque el diseño: **toda medida en px tiene
 * que multiplicarse por `s`**. Si una queda sin escalar, ese elemento sale a
 * la mitad de tamaño relativo, y si es un trazo fino desaparece del todo.
 */
export const SUPERMUESTREO = 2;

const aca = dirname(fileURLToPath(import.meta.url));

export async function renderizarConFactor(
  datos: DatosPlaca,
  nombreLienzo: NombreLienzo,
  factor: number,
  fotoPng?: Buffer,
  /**
   * Pisa medidas del lienzo para una corrida. Existe para iterar el diseño:
   * renderizar la misma placa con cinco anchos de logo y compararlas es la
   * única forma honesta de elegir uno. No lo uses para producir placas
   * reales — si un valor es el bueno, va a `lienzos.ts`.
   */
  ajustes?: Partial<Lienzo>,
): Promise<Buffer> {
  const nominal = { ...LIENZOS[nombreLienzo], ...ajustes };
  const s = factor;

  const l = {
    ...nominal,
    ancho: nominal.ancho * s,
    alto: nominal.alto * s,
    margen: nominal.margen * s,
    logoAncho: nominal.logoAncho * s,
    cajaAncho: nominal.cajaAncho * s,
    nombreTamano: nominal.nombreTamano * s,
    rolTamano: nominal.rolTamano * s,
  };

  const anchoColumna = l.ancho * (1 - l.fotoAncho) - l.margen - 40 * s;
  const [fijo, fuentes, tamanoDelNombre] = await Promise.all([
    cargarFijo(nombreLienzo, factor, ajustes),
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
        {/* La capa fija: fondo + REC + timecode + logo, ya horneada. Ver
            primitivos/Fijo.tsx y `npm run hornear`. */}
        <img
          src={`data:image/png;base64,${fijo.toString("base64")}`}
          style={{ position: "absolute", top: 0, left: 0, width: l.ancho, height: l.alto }}
        />

        {/* La foto: a sangre derecha, cortada abajo. Llega ya recortada y en
            B/N — Satori no soporta `filter`, así que toda transformación de
            imagen pasa por sharp antes de llegar acá. */}
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
              color: NOMBRE_COLOR,
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

        {/* Caja de datos, abajo a la izquierda. Ancho fijo y siempre tres
            filas — ver `cajaAncho` en lienzos.ts. Que su geometría no dependa
            de los datos es lo que permite hornear el marco en la capa fija. */}
        <div
          style={{
            position: "absolute",
            left: l.margen + 28 * s,
            bottom: l.margen + 60 * s,
            display: "flex",
            flexDirection: "column",
            width: l.cajaAncho,
            border: `${1 * s}px solid ${COLOR.linea}`,
            padding: `${26 * s}px ${34 * s}px`,
            gap: 22 * s,
          }}
        >
          {[
            { icono: <IconoCalendario escala={s} />, texto: datos.fecha, vivo: false },
            { icono: <IconoReloj escala={s} />, texto: datos.hora, vivo: false },
            { icono: <IconoSenal escala={s} />, texto: "EN VIVO", vivo: true },
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

        {/* Acá iba el lema "[ BUILDERS TALKING TO BUILDERS ]", centrado sobre el
            borde inferior, y se sacó.

            Está en **una sola** de las cinco placas originales (Veiras), y ahí
            no flota: va encerrada entre los dos corchetes inferiores del marco
            HUD. Al sacar los esquineros, la leyenda perdió el marco que la
            sostenía y quedaba sola en medio de un borde vacío.

            Además repetía: con el wordmark justo arriba, "BUILDERS" aparecía
            tres veces en el quinto inferior de la placa. E iba al 55% de
            opacidad contra el 10% del borde de la caja de datos — la
            decoración se veía cinco veces más que el dato del evento.

            Sin ella el pie lee como dos bloques: datos a la izquierda, marca a
            la derecha. Si alguna vez va algo ahí, el camino es el de la placa
            de Nahuel — "NO FILTER / ALL REAL" chico y a la izquierda, que dice
            algo en vez de repetir el nombre del programa. */}

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

/** Punto de entrada público: fija el factor de supermuestreo, no lo expone. */
export async function renderizar(
  datos: DatosPlaca,
  nombreLienzo: NombreLienzo = "1:1",
  fotoPng?: Buffer,
  ajustes?: Partial<Lienzo>,
): Promise<Buffer> {
  return renderizarConFactor(datos, nombreLienzo, SUPERMUESTREO, fotoPng, ajustes);
}

/**
 * Trae la capa fija del lienzo pedido.
 *
 * Del disco cuando se puede: `fijo/*.png` está versionado y leerlo ahorra los
 * ~2s que cuesta rasterizar el fondo. Se regenera al vuelo solamente cuando el
 * archivo no está o cuando la corrida usa `ajustes` o un factor distinto del de
 * producción — en esos casos el horneado no corresponde a lo que se está
 * pidiendo, y devolverlo daría una placa que no es la que los parámetros
 * describen.
 *
 * Que el horneado siga coincidiendo con lo que produce `generarFijo` lo asegura
 * `pruebas/fijo.test.ts`, no este código.
 */
async function cargarFijo(
  nombreLienzo: NombreLienzo,
  factor: number,
  ajustes?: Partial<Lienzo>,
): Promise<Buffer> {
  if (!ajustes && factor === SUPERMUESTREO) {
    try {
      return await readFile(join(aca, rutaFijo(nombreLienzo)));
    } catch {
      // Sin hornear todavía: se genera al vuelo. Es lento, no incorrecto.
    }
  }
  return generarFijo(nombreLienzo, factor, ajustes);
}
