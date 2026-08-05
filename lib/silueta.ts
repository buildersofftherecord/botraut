import sharp from "sharp";

export type Silueta = { png: Buffer; ancho: number; alto: number };

/**
 * Qué cuenta como "parte del sujeto": alpha por encima de este piso, no
 * estrictamente distinto de cero. El borde que deja `recortar()` (Task 22b)
 * tiene antialiasing — una fila de píxeles con alpha parcial rodeando a la
 * persona — y sin un piso ese halo casi invisible ensancha el bbox unos
 * píxeles de más en cada lado. 24 de 255 (~9%) lo descarta sin comerse el
 * borde real.
 */
const UMBRAL_ALPHA = 24;

const SIN_SUJETO =
  "No encontré a la persona en esa foto: el recorte de fondo quedó completamente " +
  "transparente. Probá con otra, con el fondo más despejado o con la persona más centrada.";

/**
 * Recorta un PNG con transparencia al rectángulo que ocupa el sujeto.
 *
 * `sharp().trim()` se descartó a propósito, no por desconocerlo: compara el
 * *color* de cada píxel contra el de la esquina superior izquierda (o el que
 * se le pase), con un `threshold` sobre esa distancia de color — no hay forma
 * de pedirle "alpha > N" directamente. Su doc dice que con canal alpha usa
 * "the combined bounding box of alpha and non-alpha channels", pero eso no
 * es lo mismo que un umbral de alpha: `recortar()` no garantiza qué color
 * queda debajo de alpha=0 (no está premultiplicado a negro), así que ese
 * criterio de color no es fiable acá. Leer el raw y calcular el bbox a mano
 * es más lento pero es exactamente el criterio que hace falta: un solo
 * recorrido de los píxeles ya decodificados, sin heurística de color de por
 * medio.
 */
export async function recortarASilueta(png: Buffer): Promise<Silueta> {
  const { data, info } = await sharp(png)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const { width, height, channels } = info;

  let minX = width;
  let maxX = -1;
  let minY = height;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = data[(y * width + x) * channels + 3];
      if (alpha <= UMBRAL_ALPHA) continue;
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
  }

  // Nadie superó el umbral: el modelo de segmentación no dejó nada en pie.
  // Sin este chequeo, `extract` de abajo recibiría ancho/alto 0 (o
  // coordenadas invertidas) y el reventón ocurriría tres pasos después, en
  // un `resize` o un `<img>` de Satori, lejos de la causa real.
  if (maxX < 0) {
    throw new Error(SIN_SUJETO);
  }

  const ancho = maxX - minX + 1;
  const alto = maxY - minY + 1;

  const recorte = await sharp(png)
    .extract({ left: minX, top: minY, width: ancho, height: alto })
    .png()
    .toBuffer();

  return { png: recorte, ancho, alto };
}
