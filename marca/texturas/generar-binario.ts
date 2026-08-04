import sharp from "sharp";

/** PRNG determinista: `Math.random()` haría irreproducible la textura. */
function rng(semilla: number): () => number {
  let s = semilla >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

/**
 * Columnas de ceros y unos, muy por debajo del contraste del texto: es
 * atmósfera, no información. Grilla rala (no una celda por línea), fuente
 * chica y techo de luz bajo (0x10 sobre negro) para que a simple vista se
 * lea como grano y no como dígitos: la primera pasada, con grilla densa y
 * fill hasta 0x26, se leía carácter por carácter y competía con el nombre.
 * `probabilidad` deja celdas vacías: sin eso la grilla rala igual se ve
 * como una trama uniforme en vez de ruido disperso.
 */
export async function generarBinario(
  ancho: number,
  alto: number,
  semilla: number,
): Promise<Buffer> {
  const azar = rng(semilla);
  const pasoX = 32;
  const pasoY = 28;
  const probabilidad = 0.55;
  const filas: string[] = [];

  for (let x = 0; x < ancho; x += pasoX) {
    for (let y = 0; y < alto; y += pasoY) {
      if (azar() > probabilidad) continue;
      const digito = azar() > 0.5 ? "1" : "0";
      const luz = Math.floor(5 + azar() * 11);
      const hex = luz.toString(16).padStart(2, "0");
      filas.push(
        `<text x="${x}" y="${y}" font-family="monospace" font-size="11" fill="#${hex}${hex}${hex}">${digito}</text>`,
      );
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <rect width="100%" height="100%" fill="#000000"/>${filas.join("")}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
