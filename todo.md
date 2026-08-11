# Qué queda

Estado al 2026-08-11: **el bot anda en producción.** Alguien lo menciona en
Slack, sube una foto, y sale la placa en el thread. 156 tests en la raíz + 54 en
`placas/`, `tsc` limpio, `next build` pasa.

Este archivo estuvo desactualizado varios días describiendo un estado anterior a
que existiera el bot. Si volvés a encontrarlo así, borralo — un todo que miente
es peor que no tener uno.

---

## 1. Memoria de la función — el problema abierto más grande

`recortar()` hace un pico de **~1175 MB**, y el default de Vercel es 1024 MB. De
ahí los `SIGKILL (137)` intermitentes.

Medido: el salto es cargar el modelo de `@imgly` en onnxruntime (117 → 1106 MB
en la primera llamada). **El tamaño de la foto casi no influye**: pasar de
561×505 a 2400×2160 sumó 18 MB. Y no crece sin techo — pica y después el GC lo
baja a ~800 MB.

- [ ] Confirmar en el dashboard qué CPU/memoria tiene la función y hasta cuánto
      la deja subir el plan. Con 2 GB (Standard) el pico entra cómodo.
- [ ] Si el plan no da 2 GB: partir el flujo en dos invocaciones (una recorta y
      guarda el PNG, otra renderiza), o sacar `@imgly` y recortar con una API.

**Instrumentar el pipeline** es prerrequisito de todo esto: hoy el camino feliz
no loguea nada, así que un `137` se ve idéntico haya muerto al arrancar o
recortando. Se dedujo mal una vez por eso.

- [ ] Una línea por etapa con la memoria del momento.

## 2. El encuadre se mide en cada render

`medirCara` corre por placa en vez de guardarse con la foto en el estado del
thread. Dos consecuencias: se paga la llamada cada vez, y la misma foto puede
dar placas apenas distintas — entre corridas el modelo varía ~2 puntos en el
alto de la cabeza, o sea ~4% de tamaño.

- [ ] Guardar la medición en `EstadoThreadSchema` junto a la foto.

## 3. Diseño — lo que quedó de la crítica

- [ ] El rol corta donde cae, no en el `" / "` que separa los dos cargos.
- [ ] Dos rojos conviviendo: `#FF2B2B` en tokens y `#E82727` en algún asset.
- [ ] El timecode `00:00:07:21` es un placeholder y se ve en todas las placas.
- [ ] Los otros tres lienzos (4:5, 9:16, 16:9) nunca se calibraron. Están en
      `lienzos.ts` con números de partida y **no hay que exponerlos** hasta
      ajustarlos a ojo.

## 4. Nota sobre `marca/`

No es código muerto aunque producción no lo alcance: es la referencia de marca,
y ahí viven las **cinco placas originales** que medio proyecto cita para
justificar decisiones de diseño. Se borró una vez por confundir "nadie lo
importa" con "no sirve". Ver `marca/README.md`.

## 5. Deuda conocida

- [ ] `salidas/` son ~35 MB de renders sueltos. Está gitignoreado, así que es
      basura local nomás, pero conviene vaciarlo cada tanto.
