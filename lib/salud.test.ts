import { describe, it, expect } from "vitest";

/**
 * No prueba el producto: prueba que la cadena de herramientas corre. Si esto
 * falla, ninguna otra falla del proyecto significa nada.
 */
describe("toolchain", () => {
  it("corre vitest", () => {
    expect(1 + 1).toBe(2);
  });
});
