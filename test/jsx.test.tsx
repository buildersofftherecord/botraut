/** @jsxImportSource react */
import { describe, it, expect } from "vitest";

describe("dos runtimes de JSX", () => {
  it("el pragma de react produce un elemento de react", () => {
    const el = <div style={{ color: "red" }}>hola</div>;
    expect((el as any).$$typeof.toString()).toContain("react.transitional.element");
  });
});
