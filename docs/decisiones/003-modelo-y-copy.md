# 003 — Modelo, búsqueda web y qué esperar del copy

**Fecha:** 2026-08-04
**Estado:** decidido
**Spike:** `spikes/copy.ts`

## Qué se probó

Seis nombres reales contra `gemini-3.6-flash` (Google AI Studio, tier gratis, sin
tarjeta), con y sin grounding de Google Search.

## Resultados sin búsqueda

| Nombre | Rol devuelto | Tiempo |
|---|---|---|
| Guillermo Rauch | CEO de Vercel | 4.8s |
| **Naomi Couriel** | **VP of Product en Lightspark** | 6.0s |
| Francisco Veiras | Co-founder & CTO en Awana | 9.8s |
| Santiago Echazu | Co-founder en Paisanos | 4.5s |
| Evil Rabbit | VP of Design en Vercel | 6.4s |
| Gentleman Programming | Software Architect y Creador de Contenido | 5.1s |

Los seis devolvieron algo publicable en forma. Corrigió `Echazu` → `Echazú`.

## 🔴 El hallazgo que decide todo

**Naomi Couriel salió mal.** La placa real de BOTR, publicada para el episodio
del 30 de julio de 2026, dice *"AI Engineering en UdeSA y Data & AI en Ualá"*.
El modelo devolvió *"VP of Product en Lightspark"* — sin relación, y con la
misma confianza que las respuestas correctas.

No dijo "no sé" ni usó el `NO_ENCONTRADO` que el prompt le ofrecía
explícitamente. **Completó con algo plausible.**

Cayó justo en el único nombre con verdad conocida. De los otros cinco no
sabemos cuántos están mal.

## El grounding no lo arregla gratis

`google.tools.googleSearch({})` devuelve 429 `RESOURCE_EXHAUSTED` incluso en una
sola llamada. La doc de Google lo confirma: *"your project is billed for each
search query that the model decides to execute"*. **Requiere facturación.**

## Decisión

**El LLM es un borrador, no una fuente de verdad.**

Se queda `gemini-3.6-flash` en el tier gratis, sin tarjeta, asumiendo que el rol
va a estar mal parte de las veces. Lo que hace el sistema vivible no es la
precisión del modelo sino que **el humano ve el copy en Slack antes de que se
renderice nada.**

El valor real es ahorrar tipeo, no acertar.

### Consecuencia 1 — el prompt tiene que ser conservador

El prompt actual invita a completar. Hay que reescribirlo para que ante la duda
escriba **menos y menos específico**: preferir "Fundador de Awana" a inventar un
cargo exacto. Un rol vago pero cierto es corregible en dos palabras; uno
específico e inventado se publica sin que nadie lo note.

### Consecuencia 2 — la corrección es conversacional, no un modal

Reemplaza el modal de edición que estaba en el plan. El humano contesta en el
thread con **el dato**, y el modelo se encarga de la redacción y del límite de
caracteres:

```
Bot:  NAOMI COURIEL — VP of Product en Lightspark
Vos:  no, es AI Engineering en UdeSA y Data & AI en Ualá
Bot:  NAOMI COURIEL — AI Engineering en UdeSA y Data & AI en Ualá
```

Es menos código que el modal y encaja mejor con cómo se conoce el error: sabés
el hecho, no la redacción que entra en 70 caracteres.

## Valor de configuración

```
MODELO_COPY=gemini-3.6-flash        # vía @ai-sdk/google, GOOGLE_GENERATIVE_AI_API_KEY
```

`AI_GATEWAY_API_KEY` queda en `.env.local` pero sin uso: AI Gateway también pide
tarjeta para liberar sus créditos gratis.

## Qué haría falta para que el copy salga bien solo

Ninguna de estas es necesaria para el v1. Quedan anotadas por si el borrador
molesta más de lo que ahorra:

| Camino | Costo |
|---|---|
| Grounding de Google Search | habilitar facturación en Google Cloud |
| Claude con `web_search` vía AI Gateway | tarjeta en Vercel; sin medir, se sospecha que alucina menos |
| Cargar el rol a mano siempre | gratis, y elimina el LLM del sistema |

## Consecuencia 3 — el nombre es verbatim, el modelo no lo toca

El spike expuso una inconsistencia: con "Evil Rabbit" el modelo devolvió
`nombre: "Evil Rabbit"`, con "Gentleman Programming" devolvió
`nombre: "Alan Buscaglia"`. Sin criterio.

**Decidido (humano, 2026-08-04): la placa muestra exactamente lo que se escribió
en Slack.** En el mundo dev mucha gente es más reconocible por el handle, y esa
elección es del humano, no del modelo.

El modelo pasa a devolver **solo** `{ rol, genero, fuentes }`. `nombre` sale del
mensaje, sin pasar por el LLM. Una superficie menos de alucinación.

**El costo:** nadie puede acortar el nombre si no entra en el template. Antes el
schema le pedía ≤24 caracteres al modelo y este se ajustaba solo. Ahora un
nombre de 30 caracteres es algo que el humano puede tipear, así que el bot tiene
que **avisar** en vez de renderizar algo roto.

Esto convierte el manejo de desborde del nombre —hoy en revisión en la Task 8—
de caso borde en camino normal.

### Cambios que esto implica

| Dónde | Qué |
|---|---|
| `lib/tipos.ts` | separar el schema que devuelve el modelo (sin `nombre`) del `Invitado` completo |
| `lib/buscar.ts` | el prompt deja de pedir `nombre`; recibe el nombre como contexto |
| Task 21 (Slack) | validar el largo del nombre al recibirlo y avisar si no entra |
