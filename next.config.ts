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

  /**
   * El modelo de `@imgly` son ~50 archivos sin extensión, nombrados por hash,
   * que la librería resuelve leyendo `resources.json` en runtime. El trazado
   * automático de Next sigue los `import`, no los `readFile` dinámicos, así que
   * detectaba **uno solo** de esos archivos y el resto no viajaba al despliegue.
   *
   * Verificado: `recortar()` funciona en local (1.7s, 17.9% de píxeles
   * transparentes) y falla en Vercel con cualquier foto, incluida una de fondo
   * gris liso. La librería llega; sus datos no.
   *
   * Para comprobar el trazado después de un build:
   *   python3 -c "import json;d=json.load(open('.next/server/app/api/slack/route.js.nft.json'));print(len([x for x in d['files'] if 'imgly' in x]))"
   */
  outputFileTracingIncludes: {
    "/api/slack": [
      "./node_modules/@imgly/background-removal-node/dist/**/*",
      // El binding `.node` de onnxruntime se enlaza dinámicamente contra
      // `libonnxruntime.so.1.17.3`, y un enlace dinámico de un binario es
      // invisible para el trazador, que sigue `require`s de JavaScript. En
      // Vercel eso daba, literal:
      //   libonnxruntime.so.1.17.3: cannot open shared object file
      // Solo `linux`: es la plataforma donde corre la función, y traer darwin y
      // win32 sería cargar el despliegue con binarios que nunca se ejecutan.
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/**/*",

      // `placas/` lee su capa horneada, sus fuentes y los assets de marca con
      // `readFile` en runtime, y el trazador sigue `import`, no rutas armadas
      // con `join()`. Verificado tras un build: las dos .ttf se trazaban solas
      // pero `fijo/1x1.png` no, así que el render habría fallado en Vercel con
      // todo funcionando en local — el mismo modo de falla que el modelo de
      // @imgly.
      "./placas/fijo/**/*",
      "./placas/fuentes/**/*",
      "./placas/marca/**/*",
    ],
  },
};

export default nextConfig;
