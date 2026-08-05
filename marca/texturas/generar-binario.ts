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
 * chica. El techo de luz sale medido de la referencia, no a ojo: ver el
 * comentario sobre la curva sesgada abajo.
 * `probabilidad` deja celdas vacías: sin eso la grilla rala igual se ve
 * como una trama uniforme en vez de ruido disperso.
 */
export async function generarBinario(
  ancho: number,
  alto: number,
  semilla: number,
): Promise<Buffer> {
  const azar = rng(semilla);
  const pasoX = 26;
  const pasoY = 19;
  const filas: string[] = [];

  // Columnas verticales, no una grilla pareja. En la referencia la textura cae
  // como lluvia: tramos verticales continuos de dígitos, con huecos anchos
  // entre columnas. Una grilla dispersa da una trama uniforme que se lee
  // dígito por dígito y compite con el nombre.
  for (let x = 0; x < ancho; x += pasoX) {
    if (azar() > 0.42) continue;

    // El brillo es de la columna, no del dígito: dentro de un tramo comparten
    // intensidad, y eso es lo que los hace leer como chorro y no como puntos
    // sueltos. La curva sesgada deja pocas columnas visibles y muchas al ras
    // del negro — la referencia mide mediana 1, p90 15, máximo 88.
    const luzColumna = 4 + Math.pow(azar(), 2.2) * 80;

    // Varios tramos por columna, de largo variable, separados por vacío.
    let y = Math.floor(azar() * alto);
    while (y < alto) {
      const largo = 3 + Math.floor(azar() * 22);
      for (let i = 0; i < largo && y < alto; i++, y += pasoY) {
        const digito = azar() > 0.5 ? "1" : "0";
        // Decae hacia el final del tramo, como la estela de la lluvia.
        const luz = Math.max(2, Math.floor(luzColumna * (1 - (i / largo) * 0.65)));
        const hex = luz.toString(16).padStart(2, "0");
        filas.push(
          `<text x="${x}" y="${y}" font-family="monospace" font-size="12" fill="#${hex}${hex}${hex}">${digito}</text>`,
        );
      }
      y += pasoY * (2 + Math.floor(azar() * 8));
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <rect width="100%" height="100%" fill="#000000"/>${filas.join("")}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
