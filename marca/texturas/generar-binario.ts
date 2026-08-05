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
  // Medidos sobre las cinco placas reales, normalizados a 1080 de ancho:
  // columnas cada ~24px, dígitos cada ~9px, cobertura ~11.5% de la franja
  // alta y picos de luz de 150-200. El vertical es lo que hace la
  // diferencia: al doble de separación se leen como puntos sueltos en vez
  // de un chorro continuo.
  const pasoX = 24;
  const pasoY = 9;
  const filas: string[] = [];

  // Columnas verticales, no una grilla pareja. En la referencia la textura cae
  // como lluvia: tramos verticales continuos de dígitos, con huecos anchos
  // entre columnas. Una grilla dispersa da una trama uniforme que se lee
  // dígito por dígito y compite con el nombre.
  for (let x = 0; x < ancho; x += pasoX) {
    // La textura no cubre el lienzo entero: es una franja. Medido en las
    // placas reales, el tercio izquierdo —donde va el nombre— es negro limpio
    // (0% de cobertura entre el 12% y el 37% del ancho), la trama arranca
    // cerca del 40% y tiene su pico entre el 60% y el 75%, o sea detrás de la
    // foto. Una trama pareja compite con la tipografía por más que la
    // densidad total coincida.
    const f = x / ancho;
    const peso = f < 0.34 ? 0 : f < 0.62 ? (f - 0.34) / 0.28 : f < 0.78 ? 1 : Math.max(0.35, 1 - (f - 0.78) * 2.5);
    if (azar() > peso * 0.85) continue;

    // El brillo es de la columna, no del dígito: dentro de un tramo comparten
    // intensidad, y eso es lo que los hace leer como chorro y no como puntos
    // sueltos. La curva sesgada deja pocas columnas visibles y muchas al ras
    // del negro — la referencia mide mediana 1, p90 15, máximo 88.
    const luzColumna = 60 + Math.pow(azar(), 0.8) * 140;

    // Varios tramos por columna, de largo variable, separados por vacío.
    // Arranca por encima del borde, no en una `y` al azar: la versión
    // anterior solo bajaba desde donde caía, así que la mitad de cada
    // columna quedaba vacía y solo el 4% de las posiciones horizontales
    // tenía algo.
    let y = -Math.floor(azar() * 40 * pasoY);
    while (y < alto) {
      const largo = 14 + Math.floor(azar() * 70);
      for (let i = 0; i < largo && y < alto; i++, y += pasoY) {
        const digito = azar() > 0.5 ? "1" : "0";
        // Decae hacia el final del tramo, como la estela de la lluvia.
        const luz = Math.max(2, Math.floor(luzColumna * (1 - (i / largo) * 0.35)));
        const hex = luz.toString(16).padStart(2, "0");
        filas.push(
          `<text x="${x}" y="${y}" font-family="monospace" font-size="17" fill="#${hex}${hex}${hex}">${digito}</text>`,
        );
      }
      y += pasoY * (1 + Math.floor(azar() * 5));
    }
  }

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${ancho}" height="${alto}">
    <rect width="100%" height="100%" fill="#000000"/>
    <filter id="grano"><feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" seed="7"/>
      <feColorMatrix type="matrix" values="0 0 0 0 0.055  0 0 0 0 0.055  0 0 0 0 0.055  0.35 0 0 0 0"/></filter>
    <linearGradient id="franja" x1="0" x2="1">
      <stop offset="0.30" stop-color="#000"/><stop offset="0.60" stop-color="#fff"/><stop offset="1" stop-color="#fff"/>
    </linearGradient>
    <mask id="soloDerecha"><rect width="100%" height="100%" fill="url(#franja)"/></mask>
    <rect width="100%" height="100%" filter="url(#grano)" mask="url(#soloDerecha)"/>${filas.join("")}</svg>`;

  return sharp(Buffer.from(svg)).png().toBuffer();
}
