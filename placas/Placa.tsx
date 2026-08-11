/** @jsxImportSource react */
import { readFile } from "node:fs/promises";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { ImageResponse } from "@vercel/og";
import sharp from "sharp";
import { cargarFuentes } from "./fuentes/index";
import { LIENZOS, anchoContenido, altoDeFoto, type Lienzo, type NombreLienzo } from "./lienzos";
import { COLOR, NOMBRE_COLOR, FUENTE, HUD } from "./tokens";
import { Etiqueta, PuntoRec } from "./primitivos/Hud";
import { IconoCalendario, IconoReloj, IconoSenal } from "./primitivos/Iconos";
import { generarFijo, rutaFijo } from "./primitivos/Fijo";
import { cargarLogo } from "./primitivos/Logo";
import { etiquetaInvitado, type DatosPlaca } from "./datos";
import { maquetarNombre, NOMBRE_LETTER_SPACING_EM } from "./medirNombre";

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

/**
 * Separación vertical entre las piezas del pie, en px nominales.
 *
 * El pie es una sola columna centrada anclada abajo —nombre, rol, barra,
 * wordmark— y estos son los aires entre sus piezas. Están juntos acá y no
 * repartidos por el JSX porque el ritmo vertical se elige mirándolos como
 * serie, no de a uno.
 *
 * `pie` es el aire debajo del wordmark. Es mayor que el `margen` del HUD a
 * propósito: ópticamente un bloque apoyado sobre el borde inferior necesita
 * más aire abajo que arriba, o se lee cayéndose de la placa. En la referencia
 * quedó en 44 y ahí se ve apretado.
 */
const AIRE = { rol: 24, barra: 27, logo: 30, pie: 56 } as const;

/**
 * Cuánto del alto del lienzo cubre el velo negro del pie, desde abajo.
 *
 * El velo hace algo que el desvanecido del retrato **no puede**: el desvanecido
 * saca a la persona, pero el fondo sigue ahí, así que la trama BO/TR se veía por
 * detrás de la barra de datos y del wordmark y el pie no leía negro.
 *
 * 0.35 arranca al 65% del alto, que es la mitad del nombre — el mismo punto
 * donde corta `pisoTexto`. Medido sobre el fondo del pie, la luminancia pasa de
 * 10 a 0; detrás del rol queda en 4 y detrás de la barra en 2.
 *
 * Se probó también a 0.45 y 0.55: el pie queda igual de negro en los tres, lo
 * único que cambia es cuánta trama sobrevive en la banda del medio. 0.35 es el
 * que más deja.
 *
 * **No reemplaza a `pisoTexto`.** Ese es una garantía estructural, con test
 * detrás: que el cuerpo no invada la zona del texto pase lo que pase con la
 * escala que mande el agente. El velo es lo que además lo hace ver negro. Uno
 * es corrección, el otro es apariencia.
 */
const VELO_DESDE = 0.35;

/**
 * Geometría interna de la barra de datos, en px nominales.
 *
 * Exportada porque `pruebas/datos.test.ts` la usa para calcular cuánto texto
 * entra en el campo de la fecha, y de ahí sale `MAX_CARACTERES_FILA`. Antes
 * esos números estaban escritos a mano en el test, copiados del JSX: cualquier
 * cambio de padding acá dejaba el test midiendo una caja que ya no existía, y
 * el límite de caracteres quedaba mal sin que nada fallara.
 *
 * `separacion` es el aire a cada lado del filete que separa dos grupos. Sale
 * duplicado en el render (gap del flex + margen del filete) y por eso el
 * presupuesto lo cuenta dos veces.
 */
export const BARRA = { padding: 20, gap: 12, icono: 22, filete: 1, punto: 8, gapPunto: 10, borde: 2 } as const;

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
    contenidoMargen: nominal.contenidoMargen * s,
    logoAncho: nominal.logoAncho * s,
    nombreTamano: nominal.nombreTamano * s,
    nombreMinimo: nominal.nombreMinimo * s,
    rolTamano: nominal.rolTamano * s,
    barraAlto: nominal.barraAlto * s,
  };

  // El nombre se mide contra el **mismo** ancho que ocupa la barra de datos.
  // Que compartan la medida es lo que hace que el pie lea como un bloque.
  const anchoCont = anchoContenido(l);
  const [fijo, logo, fuentes, nombre] = await Promise.all([
    cargarFijo(nombreLienzo, factor, ajustes),
    cargarLogo(),
    cargarFuentes(),
    maquetarNombre(datos.invitado.nombre, anchoCont, l.nombreTamano, l.nombreMinimo),
  ]);

  const filas = [
    { icono: <IconoCalendario escala={s} />, texto: datos.fecha, vivo: false },
    { icono: <IconoReloj escala={s} />, texto: datos.hora, vivo: false },
    { icono: <IconoSenal escala={s} />, texto: "EN VIVO", vivo: datos.enVivo },
  ];

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
        {/* La capa fija: fondo + REC + timecode, ya horneada. Ver
            primitivos/Fijo.tsx y `npm run hornear`. El wordmark ya **no** está
            acá: ver el bloque del pie más abajo. */}
        <img
          src={`data:image/png;base64,${fijo.toString("base64")}`}
          style={{ position: "absolute", top: 0, left: 0, width: l.ancho, height: l.alto }}
        />

        {/* El invitado: centrado, a todo el ancho, sangrando por abajo.
            Llega ya recortado y en B/N — Satori no soporta `filter`, así que
            toda transformación de imagen pasa por sharp antes de llegar acá.

            Va **debajo** del pie en el árbol: el nombre se le apoya encima del
            torso, y esa superposición es lo que ancla a la persona a la placa.
            Es la razón por la que no hace falta ningún objeto tapando la base. */}
        {fotoPng ? (
          <img
            src={`data:image/png;base64,${fotoPng.toString("base64")}`}
            style={{
              position: "absolute",
              left: 0,
              bottom: 0,
              width: l.ancho,
              height: altoDeFoto(l),
              objectFit: "cover",
              objectPosition: "top center",
            }}
          />
        ) : null}

        {/* El velo: degradado a negro sobre el pie. Va **encima de la foto** y
            debajo del texto — encima, porque si fuera parte del fondo horneado
            el retrato lo taparía y volveríamos a tener textura detrás de la
            barra de datos. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: l.ancho,
            height: l.alto * VELO_DESDE,
            display: "flex",
            backgroundImage:
              "linear-gradient(to bottom, rgba(0,0,0,0) 0%, rgba(0,0,0,1) 60%, rgba(0,0,0,1) 100%)",
          }}
        />

        {/* El pie: una sola columna centrada, anclada abajo. Nombre, rol,
            barra y wordmark comparten eje y —nombre y barra— ancho. */}
        <div
          style={{
            position: "absolute",
            left: 0,
            bottom: 0,
            width: l.ancho,
            paddingBottom: AIRE.pie * s,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              fontFamily: FUENTE.display,
              fontSize: nombre.tamano,
              lineHeight: 0.94,
              letterSpacing: `${NOMBRE_LETTER_SPACING_EM}em`,
              textTransform: "uppercase",
              color: NOMBRE_COLOR,
            }}
          >
            {/* Una línea por elemento en vez de dejar que Satori envuelva: el
                corte lo elige `maquetarNombre` midiendo con la fuente real,
                para que las dos líneas queden parejas de ancho. */}
            {nombre.lineas.map((linea, i) => (
              <div key={i} style={{ display: "flex" }}>{linea}</div>
            ))}
          </div>

          <div
            style={{
              display: "flex",
              marginTop: AIRE.rol * s,
              maxWidth: anchoCont,
              fontFamily: FUENTE.mono,
              fontSize: l.rolTamano,
              lineHeight: 1.45,
              textAlign: "center",
              color: COLOR.rol,
            }}
          >
            {datos.invitado.rol}
          </div>

          {/* La barra de datos: una sola fila a todo el ancho de contenido.
              Reemplaza a la caja apilada de tres filas. No es sólo compactar:
              una franja horizontal al pie lee como un lower third de
              transmisión, que es la idea que el REC y el timecode venían
              insinuando sin comprometerse.

              El marco tiene ancho fijo y los grupos se reparten con
              `space-between`, así que una fecha más larga mueve las
              separaciones internas pero **no** la geometría de la barra. Eso
              es lo que hace que la placa sea el mismo template todas las
              semanas. */}
          <div
            style={{
              display: "flex",
              marginTop: AIRE.barra * s,
              width: anchoCont,
              height: l.barraAlto,
              alignItems: "center",
              justifyContent: "space-between",
              paddingLeft: BARRA.padding * s,
              paddingRight: BARRA.padding * s,
              // El filete va a `lineaViva` y 2px. Al alfa 0.1 y 1px daba
              // contraste 1.3:1 contra el fondo: invisible en el feed y lo
              // primero que se come la compresión de Instagram.
              border: `${BARRA.borde * s}px solid ${COLOR.lineaViva}`,
            }}
          >
            {filas.map((fila, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: BARRA.gap * s }}>
                {/* Un solo separador por grupo, y va **entre** grupos.
                    La caja apilada llevaba además uno corto entre el ícono y su
                    dato: en tres filas apiladas eso ordenaba, pero en una franja
                    de una línea son cinco filetes verticales en 824px y se lee
                    como una tabla. Además cada uno cuesta ancho, y el ancho es
                    justo lo que escasea acá: los tres campos ahora comparten la
                    barra en vez de tener una fila cada uno. */}
                {i > 0 ? (
                  <div
                    style={{
                      display: "flex",
                      width: BARRA.filete * s,
                      height: l.barraAlto * 0.5,
                      background: COLOR.linea,
                      marginRight: BARRA.gap * s,
                    }}
                  />
                ) : null}
                {fila.icono}
                <div style={{ display: "flex", alignItems: "center", gap: BARRA.gapPunto * s }}>
                  {fila.vivo ? <PuntoRec tamano={BARRA.punto} escala={s} /> : null}
                  <Etiqueta color={COLOR.datos} escala={s} tamano={HUD.datosTamano}>
                    {fila.texto}
                  </Etiqueta>
                </div>
              </div>
            ))}
          </div>

          {/* El wordmark, centrado al pie.

              Salió de la capa fija cuando el invitado se centró. Horneado
              estaba abajo a la derecha, donde el retrato ya se había
              desvanecido; centrado cae justo sobre el torso, y horneado
              quedaría **detrás** de la foto. Acá va después de la foto en el
              árbol, así que la superposición está garantizada por el orden y
              no por que el desvanecido llegue. Cuesta milisegundos: es un SVG. */}
          <img
            src={`data:image/svg+xml;base64,${logo.toString("base64")}`}
            style={{ marginTop: AIRE.logo * s, width: l.logoAncho }}
          />
        </div>
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
