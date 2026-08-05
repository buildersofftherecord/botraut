import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * `@imgly/background-removal-node` no se puede empaquetar dentro de la
   * función: trae binarios nativos y ubica los archivos del modelo ONNX por
   * ruta relativa a su propio módulo. Al bundlearlo esa ruta deja de existir y
   * el import falla al cargar — en producción eso es un 500 con cuerpo vacío,
   * antes de que corra una sola línea nuestra.
   *
   * `sharp` y `onnxruntime-node` ya están en la lista que Next externaliza
   * solo (`next/dist/lib/server-external-packages.jsonc`); `@imgly` no.
   */
  serverExternalPackages: ["@imgly/background-removal-node"],
};

export default nextConfig;
