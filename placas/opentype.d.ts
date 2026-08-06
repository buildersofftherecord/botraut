/**
 * `@shuding/opentype.js` no publica tipos propios. Esto no es la superficie
 * completa de la librería, es la porción mínima que usa `medirNombre.ts`.
 */
declare module "@shuding/opentype.js" {
  export class Font {
    getAdvanceWidth(
      text: string,
      fontSize?: number,
      options?: { letterSpacing?: number; tracking?: number; kerning?: boolean },
    ): number;
  }

  export function parse(buffer: ArrayBuffer): Font;
}
