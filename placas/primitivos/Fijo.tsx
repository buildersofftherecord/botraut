/** @jsxImportSource react */
import { ImageResponse } from "@vercel/og";
import sharp from "sharp";
import { cargarFuentes } from "../fuentes/index";
import { LIENZOS, type Lienzo, type NombreLienzo } from "../lienzos";
import { COLOR, FUENTE } from "../tokens";
import { Etiqueta, PuntoRec } from "./Hud";
import { generarFondo } from "./Fondo";

/**
 * La capa fija: todo lo que es idéntico en todas las placas.
 *
 * Fondo (degradado + monograma + grano + viñeta), `REC ●` y el timecode. Nada
 * de esto depende del invitado.
 *
 * Existe por dos razones:
 *
 * 1. **Cuesta.** Medido: `generarFondo` sola son 2.05s de los 3.69s que tarda
 *    una placa. Rasterizar el patrón del monograma a 2160² es lo más caro del
 *    pipeline y da siempre el mismo resultado.
 * 2. **Es la marca.** Horneada, un agente que arma placas no puede tocarla sin
 *    querer: recibe un PNG y compone encima.
 *
 * ── Por qué el wordmark ya NO entra acá ──
 *
 * Estuvo horneado mientras iba abajo a la derecha: ahí el retrato ya se había
 * desvanecido, así que daba igual que el logo se dibujara antes que la foto —
 * se verificó que la placa salía idéntica al píxel.
 *
 * Con el layout centrado eso deja de valer. El wordmark va centrado al pie,
 * justo donde está el torso del invitado, y horneado quedaría **tapado por la
 * foto**. Se movió a `Placa.tsx`, después de la foto en el árbol, donde la
 * superposición la garantiza el orden y no una coincidencia del desvanecido.
 *
 * ── Qué NO entra ──
 *
 * El wordmark, por lo de arriba. Y la barra de datos, aunque su marco y sus
 * íconos sean invariantes. Partirla
 * —marco horneado, texto encima— obligaría a que las dos capas calcularan la
 * misma geometría por separado, y eso se desincroniza en el primer cambio de
 * padding. Renderizarla entera cuesta milisegundos. No vale el acoplamiento.
 */
export async function generarFijo(
  nombreLienzo: NombreLienzo,
  factor: number,
  /** Mismos `ajustes` que `renderizarConFactor`: sin esto, iterar el ancho del
   *  logo movería la capa variable y dejaría la fija en su valor de tokens. */
  ajustes?: Partial<Lienzo>,
): Promise<Buffer> {
  const nominal = { ...LIENZOS[nombreLienzo], ...ajustes };
  const s = factor;
  const ancho = nominal.ancho * s;
  const alto = nominal.alto * s;
  const margen = nominal.margen * s;

  const [fondo, fuentes] = await Promise.all([generarFondo(ancho, alto), cargarFuentes()]);

  const respuesta = new ImageResponse(
    (
      <div
        style={{
          display: "flex",
          width: ancho,
          height: alto,
          background: COLOR.negro,
          position: "relative",
          fontFamily: FUENTE.mono,
        }}
      >
        <img
          src={`data:image/png;base64,${fondo.toString("base64")}`}
          style={{ position: "absolute", top: 0, left: 0, width: ancho, height: alto }}
        />

        {/* REC, arriba a la izquierda */}
        <div
          style={{
            position: "absolute",
            top: margen + 8 * s,
            left: margen + 14 * s,
            display: "flex",
            alignItems: "center",
            gap: 10 * s,
          }}
        >
          <Etiqueta escala={s}>REC</Etiqueta>
          <PuntoRec escala={s} />
        </div>

        {/* Timecode, arriba a la derecha. Fijo a propósito: uno que cambiara por
            placa rompería el determinismo del render y no aportaría nada.
            Debajo iba "CAM 01" y se sacó — con dos líneas, la derecha pesaba el
            doble que el `REC ●` de la izquierda y tiraba el eje. */}
        <div
          style={{
            position: "absolute",
            top: margen + 8 * s,
            right: margen + 14 * s,
            display: "flex",
          }}
        >
          <Etiqueta escala={s}>00:00:07:21</Etiqueta>
        </div>

      </div>
    ),
    { width: ancho, height: alto, fonts: fuentes },
  );

  // Se devuelve a la resolución de trabajo (supermuestreada), no a la nominal:
  // esta capa es un paso intermedio del render, no un entregable. Bajarla a
  // 1080 acá y volver a subirla en `Placa.tsx` perdería la mitad del detalle
  // que el supermuestreo existe para conseguir.
  return sharp(Buffer.from(await respuesta.arrayBuffer())).png().toBuffer();
}

/** Dónde vive el PNG horneado de cada lienzo, relativo a la raíz del paquete. */
export function rutaFijo(nombreLienzo: NombreLienzo): string {
  return `fijo/${nombreLienzo.replace(":", "x")}.png`;
}
