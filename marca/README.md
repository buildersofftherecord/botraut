# marca/

**Esto no es código muerto. No lo borres porque nadie lo importe.**

Es la referencia de marca de BOTR. Su valor no es ejecutarse: es que esté acá
para consultarlo — a mano o por el agente, cuando haya que responder algo sobre
la marca.

Ya se borró una vez, el 2026-08-11, con el razonamiento de que producción
alcanzaba 0 de sus 14 archivos fuente. El razonamiento era correcto y la
conclusión estaba mal: un análisis de alcance mide qué se ejecuta, y esto no
está para ejecutarse.

## Qué hay

- **`referencia/`** — las cinco placas originales: evil-rabbit,
  francisco-veiras, nahuel-alberti, naomi-couriel, ariana-onega. **Son las más
  importantes de todo el directorio.** Medio proyecto cita "las cinco placas de
  referencia" para justificar decisiones —dónde arranca la cara, cuánto pesa el
  nombre, por qué la bandera de tela va donde va— y son estas. Sin ellas, esas
  justificaciones quedan sin nada detrás que las respalde.
- **`tokens.ts`** — colores, tipografía y tracking de la marca.
- **`lienzos.ts`** — la geometría de cada formato en la versión anterior.
- **`Placa.tsx`, `Hud.tsx`, `Iconos.tsx`, `medirNombre.ts`** — el template
  anterior. Sirve como documentación viva de cómo se resolvieron cosas antes,
  y varias de sus decisiones sobreviven en `placas/`.
- **`fuentes/`** — Archivo y IBM Plex Mono, con sus licencias.
- **`svg/`, `texturas/`** — assets: el sticker y la lluvia de ceros y unos que
  usaba el fondo viejo.

## Relación con `placas/`

`placas/` es el sistema de diseño **vivo**: lo que el bot renderiza hoy. Es una
reescritura completa, con layout centrado, y no comparte código con esto.

Ojo con la ambigüedad de nombres: `placas/marca/` es otra cosa — son los SVG de
marca que el render usa de verdad (monograma y wordmark). Este directorio es la
referencia; aquel son assets en producción.

## Sus tests

Los 43 tests de acá siguen corriendo con `npm test`. Verifican la coherencia de
la referencia, no el producto. Si algún día molestan por tiempo, la salida es
excluirlos de la corrida por defecto — **no borrar los archivos**.
