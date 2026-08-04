# Generador de placas — diseño

**Fecha:** 2026-08-03
**Estado:** spec para revisión

---

## 1. Qué es

Un bot de Slack que genera las placas de anuncio de invitados de *Builders Off
The Record*. Escribís un nombre en un canal, el sistema averigua quién es esa
persona, propone fotos, y renderiza la placa con la marca aplicada.

Hoy cada placa se arma a mano en un editor de diseño. El trabajo repetitivo no
es el diseño —está resuelto y documentado— sino **rellenarlo**: buscar quién es
el invitado, redactar el rol, conseguir una foto, recortarla, y acomodar todo
en la grilla.

## 2. Qué NO es

No es un agente. Es un pipeline de pasos fijos con dos puntos de decisión
humana. No razona, no elige herramientas, no persiste contexto entre corridas.

No genera imágenes con IA. La placa se **renderiza** desde un template
determinista: mismos datos producen el mismo PNG, siempre. La única parte
generativa es el texto del rol y la selección de candidatas de foto.

---

## 3. Alcance del v1

**Adentro:**

- Un solo lienzo: **1:1, 1080×1080** (el de la placa de referencia)
- Trigger desde un canal de Slack
- Búsqueda automática de copy (rol / afiliación) del invitado
- **La foto la sube el humano al thread de Slack** (ver §3.1)
- Validación de la foto subida, con feedback explícito si no sirve
- Recorte de fondo + conversión a blanco y negro
- Modal para fecha y hora
- Almacenamiento en Vercel Blob (foto original, foto procesada, placa final)
- Script de render local para iterar el diseño sin Slack

**Afuera, explícitamente:**

- **Búsqueda automática de fotos** — ver §3.1
- Los otros tres lienzos (4:5, 9:16, 16:9) — el template queda parametrizado
  por lienzo para que agregarlos sea configuración, no rediseño
- Publicación automática a Instagram / X / YouTube
- Placas post-episodio con citas de la transcripción
- Cualquier integración con Linear
- Base de datos de invitados

## 3.1 Cambio de alcance: la foto la sube el humano

**Decidido 2026-08-04, reemplaza el diseño original de búsqueda automática.**

El diseño original buscaba hasta 4 fotos candidatas en internet y te las
mostraba para elegir. Se descartó por dos motivos que aparecieron al ver la
placa de referencia:

1. **El template exige mucho de la foto.** Medio cuerpo o más, fondo separable,
   ≥800px, persona bien expuesta. La estimación de acierto de una búsqueda
   automática era 20-30% — el riesgo más grande del proyecto.
2. **Toda API de búsqueda de imágenes con cobertura razonable pide tarjeta.**
   Google Custom Search está cerrada a clientes nuevos y se discontinúa el
   2027-01-01; Brave y SerpAPI piden tarjeta aun en sus tiers gratuitos.

La spec original ya anticipaba esta salida en §9: *"si después de 10 invitados
la tasa de acierto es baja, la respuesta correcta es pedirle la foto al
invitado"*. Se toma esa salida **antes** de gastar en medirlo.

**Lo que gana el proyecto:** desaparece su riesgo principal, desaparece una
cuenta paga, y la calidad de la foto sube — cuando confirmás un invitado ya
estás hablando con esa persona, y una foto que eligió alguien es mejor que
cualquier cosa que devuelva un buscador.

**Lo que no cambia:** el recorte de fondo sigue siendo necesario. Una foto
provista igual viene con fondo, y el template pide una silueta.

### El comportamiento (opción C)

El bot se adapta a si la foto ya viene o no:

```
Con foto adjunta                      Sin foto adjunta
─────────────────                     ────────────────
"Naomi Couriel" + [foto]              "Naomi Couriel"
   ↓ busca copy                          ↓ busca copy
   ↓ valida la foto                   "Es AI Engineering en UdeSA...
   ↓ modal fecha/hora                  Mandame una foto: medio cuerpo,
   ↓ placa                             fondo limpio, 800px o más."
                                          ↓ [foto]
                                          ↓ valida
                                          ↓ modal fecha/hora
                                          ↓ placa
```

Es un `if` sobre la presencia de adjuntos. Cubre tanto el caso de tener la foto
a mano como el de todavía no haberla pedido.

### La validación cambia de sentido

En el diseño original el filtro descartaba candidatas en silencio. Ahora que la
foto la elegís vos, la validación **te habla**:

> *"Esa foto tiene 480px de ancho — va a salir pixelada en la placa. ¿Mandás
> otra?"*

Es mejor que renderizar algo feo y que te des cuenta cuando ya está publicado.

---

## 4. Arquitectura

```
   ┌───────────┐   webhooks    ┌──────────────────────────┐
   │   SLACK   │◄─────────────►│    APP (Vercel)          │
   └───────────┘               │                          │
                               │   Chat SDK   ← el sobre  │
   ┌───────────┐    estado     │   AI SDK     ← el copy   │
   │   REDIS   │◄─────────────►│   sharp      ← la foto   │
   │ (Upstash) │               │   @vercel/og ← el render │
   └───────────┘               └────┬──────────┬──────────┘
                                    │          │
   ┌───────────┐                    │          │
   │   BLOB    │◄───────────────────┘          │
   │ (Vercel)  │   imágenes                    ▼
   └───────────┘                  ┌──────────────────────────┐
                                  │  AI Gateway (Vercel)     │
                                  │  Búsqueda de imágenes    │
                                  │  Background removal      │
                                  └──────────────────────────┘
```

**Proyecto aparte del de la landing.** Comparten cuenta de Vercel, nada más.
Motivo: deploys independientes, build chico, y un bug en el bot no puede tirar
el sitio público.

**Los assets de marca se copian** a `marca/` en el repo nuevo. La marca está
decidida y documentada, así que el riesgo de divergencia es bajo. Si empieza a
molestar, se promueve a monorepo con un `packages/marca` compartido; es un
refactor de una tarde y no bloquea nada hoy.

### Inventario de assets (relevado en `landing/`)

| Asset | Dónde está | Estado |
|---|---|---|
| `botr-sticker.svg` | `landing/public/marca/` | ✅ es el banner rotado de la placa |
| `botr-rec.svg` | `landing/public/marca/` | ✅ el punto rojo, para REC y EN VIVO |
| Otros 10 SVGs del logo | `landing/public/marca/` | ✅ disponibles |
| Tokens de color | `landing/app/globals.css` | ✅ portar a `tokens.ts` |
| Estilos HUD | `landing/app/globals.css` | ✅ ver abajo |
| `Archivo.ttf` (variable) | `landing/tools/marca/` | ⚠️ rescatado, pero **gitignoreado** |
| `Archivo-900-125.ttf` | `landing/tools/marca/` | ⚠️ rescatado, pero **gitignoreado** |
| **IBM Plex Mono `.ttf`** | **ningún lado** | 🔴 **falta, bajar de Google Fonts** |
| Textura de binario | no existe | 🟡 hay que producirla |
| Textura de grano | no existe | 🟡 hay que producirla |

### 🔴 Prerequisito: las fuentes

El sitio carga las fuentes con `next/font/google`. **Eso no sirve para Satori**,
que necesita un buffer de fuente real en disco, en runtime.

`landing/.gitignore` excluye `/tools/marca/*.ttf` por decisión explícita: "la
fuente base se baja y las instancias se derivan, así que ninguna de las dos se
versiona". **Esa política es correcta para la landing** —el sitio nunca toca el
`.ttf`, y los SVGs derivados sí están versionados— **y es incorrecta para
placas**, donde el `.ttf` es una dependencia de runtime. Un deploy sin fuente no
renderiza.

**Placas versiona sus fuentes.** Archivo e IBM Plex Mono son SIL Open Font
License, que permite redistribución; va el `OFL.txt` al lado de cada una. Son
~250 KB en total.

**Acción, antes de tocar el template:**

1. ✅ `Archivo.ttf` y `Archivo-900-125.ttf` rescatados a `landing/tools/marca/`
   (locales, gitignoreados — sirven para correr `marca.py`)
2. ☐ Bajar IBM Plex Mono `.ttf` de Google Fonts
3. ☐ Copiar las tres a `marca/fuentes/` del repo de placas **y commitearlas**,
   con sus licencias

### El HUD ya está resuelto en el sitio

La estética de la placa es la misma del sitio y ya tiene valores decididos en
`globals.css`. El template los porta en vez de derivarlos a ojo:

```css
.hud-corner  { width: 26px; height: 26px; border: 1px rgba(255,255,255,0.8) }
             /* .tl .tr .bl .br — los corchetes de las cuatro esquinas */
.hud-label   { font-size: 11px; letter-spacing: 0.16em; text-transform: uppercase }
             /* el estilo de INVITADA / REC / CAM 01 */
--fs-hud: 11px    --tr-hud: 0.16em
--negro #000000   --carbon #0a0a0a   --gris #141414
--rojo  #ff2b2b   --rojo-hondo #c81a1a
--t100/75/55/35/20                  --linea rgba(255,255,255,0.1)
```

Que la placa y el sitio compartan estos valores es lo que los hace un sistema y
no dos cosas parecidas.

---

## 5. El flujo

Tres turnos. Cada uno es una invocación independiente de una función que muere
al terminar; el estado vive en Redis entre turnos.

```
TURNO 1 ─ alguien escribe "Naomi Couriel" en el canal, con o sin foto adjunta
   │
   ├─ ack inmediato: "Buscando a Naomi Couriel..."
   ├─ copy: quién es, rol, género  (una llamada al LLM)
   ├─ guarda el copy en Redis
   │
   ├─ ¿venía foto adjunta?
   │     SÍ  → valida → si pasa, abre el modal (salta al turno 2)
   │     NO  → postea el copy + "mandame una foto: medio cuerpo,
   │           fondo limpio, 800px o más" + botón [Editar copy]
   │
TURNO 2 ─ subís una foto al thread  (o ya venía del turno 1)
   │
   ├─ valida medidas
   │     no pasa → te dice por qué y espera otra
   │     pasa    → guarda el original en Blob
   │
   └─ abre modal: fecha, hora, ¿en vivo?, INVITADA/INVITADO
   │
TURNO 3 ─ submit del modal
   │
   ├─ procesa la foto: recorte de fondo → B/N → resize
   ├─ renderiza el PNG 1080×1080
   ├─ guarda la placa en Blob
   └─ postea la placa al thread
```

### Salidas de emergencia

| Situación | Salida |
|---|---|
| La foto no pasa la validación | mensaje con el motivo concreto ("tiene 480px, va a salir pixelada") y espera otra |
| El copy no te gusta | botón **"Editar"** → modal con nombre y rol editables |
| No encuentra a la persona | mensaje explícito + opción de cargar el copy a mano |
| Nombre ambiguo | devuelve las opciones que encontró y pregunta cuál |

---

## 6. Contrato de datos

```ts
const Invitado = z.object({
  nombre:      z.string().max(24),   // cabe en dos líneas del template
  rol:         z.string().max(70),   // "AI Engineering en UdeSA y Data & AI en Ualá"
  genero:      z.enum(['f', 'm', 'x']),   // → INVITADA / INVITADO / INVITADX
  fuentes:     z.array(z.string().url()),  // de dónde salió la info
})

const Foto = z.object({
  url:         z.string().url(),     // la URL del archivo en Slack
  fuente:      z.string().optional(), // quién la subió — ver nota abajo
  ancho:       z.number().min(800),
  alto:        z.number().min(800),
})

const Placa = z.object({
  invitado:    Invitado,
  fotoElegida: Foto,
  fecha:       z.string(),   // "JUEVES 30 DE JULIO"
  hora:        z.string(),   // "21:00 HS"
  enVivo:      z.boolean(),
})
```

**Los límites de caracteres son la defensa contra el desborde de texto.** El
modelo se ajusta al límite; el template no hace malabares con CSS. `max(24)` en
el nombre sale de que "GUILLERMO RAUCH" ocupa dos líneas al tamaño de la
referencia.

**`fuente` cambió de significado con §3.1.** Era la página web de donde salía la
foto, obligatoria, para dejar rastro de derechos cuando la encontraba un
buscador. Ahora que la sube un humano, el rastro es quién la subió, y pasa a ser
opcional. `lib/tipos.ts` todavía la tiene como `z.string().url()` obligatoria —
la Task 16 la ajusta.

**Las medidas dejan de ser un filtro silencioso y pasan a ser un mensaje.** Con
búsqueda automática, una foto de 480px se descartaba sin decir nada. Ahora el
bot te dice por qué no sirve y espera otra.

**`genero` existe porque el template dice `INVITADA` o `INVITADO`.** Es un campo
real del diseño, no un detalle. Se infiere en la búsqueda y se puede corregir en
el modal.

---

## 7. El template y la marca

### Anatomía de la placa (1:1)

Leída desde la referencia:

| Zona | Contenido |
|---|---|
| Fondo | negro + textura de binario en columnas, muy bajo contraste |
| Marco | corchetes en las cuatro esquinas |
| Sup. izq. | `REC ●` (punto rojo `#ff2b2b`) |
| Sup. der. | timecode `00:00:07:21` + `CAM 01` — decorativos |
| Izq. superior | `INVITADA` con regla horizontal debajo |
| Izq. centro | **el nombre**, condensada pesada, dos líneas, con grano |
| Izq. bajo nombre | el rol, monoespaciada, dos líneas |
| Izq. inferior | caja con borde: 📅 fecha / 🕐 hora / ((•)) EN VIVO |
| Derecha | **foto recortada**, B/N, a sangre derecha, cortada abajo |
| Inf. der. | logo en banner rotado, con corchetes |

### Dónde vive el design system

```
marca/
├── tokens.ts          ← portados de landing/app/globals.css
├── lienzos.ts         ← definición de cada formato (1:1, 4:5, 9:16, 16:9)
├── Placa.tsx          ← el template, parametrizado por lienzo
├── fuentes/
│   ├── Archivo.ttf              ← variable, origen (bajar de Google Fonts)
│   ├── Archivo-900-125.ttf      ← instancia, generada con marca.py
│   └── IBMPlexMono-Regular.ttf  ← bajar de Google Fonts
├── svg/
│   ├── botr-sticker.svg         ← copiado de landing/public/marca/
│   └── botr-rec.svg             ← copiado de landing/public/marca/
└── texturas/
    ├── binario.png              ← producir
    └── grano.png                ← producir
```

**El modelo nunca toca `marca/`.** Recibe datos, devuelve datos. La marca es
código, no prompt. Ese es el motivo de que el render sea determinista y de que
no haya forma de que "invente" branding: no tiene acceso a esa decisión.

`tokens.ts` es la única fuente de valores. Nada de hex sueltos en el template.

### Parametrización por lienzo

Aunque el v1 solo produce 1:1, `Placa.tsx` toma el lienzo como prop desde el
día uno:

```ts
export const LIENZOS = {
  '1:1':  { w: 1080, h: 1080, nombreSize: 130, fotoAncho: 0.48 },
  '4:5':  { w: 1080, h: 1350, ... },
  '9:16': { w: 1080, h: 1920, ... },
  '16:9': { w: 1280, h: 720,  ... },
}
```

Agregar un formato = agregar una fila y ajustar valores. No se toca la
estructura.

### Riesgos del render

`@vercel/og` (Satori) **no soporta `filter: grayscale()`** ni blend modes
complejos. Consecuencias:

- El B/N de la foto se hace **antes**, con `sharp`, fuera del template
- El recorte de fondo se hace **antes**, el template recibe un PNG con alpha
- El grano sobre las letras es el punto incierto. Plan: intentarlo con una
  textura como máscara SVG; si no sale, el v1 va con texto plano y se resuelve
  después. **No bloquea el resto del sistema.**

---

## 8. Pipeline de la foto

```
1. la subís al thread    →  Slack da una URL de archivo
2. descarga              →  guarda original en Blob
3. validación            →  medidas; si no pasa, te dice por qué y espera otra
4. recorte de fondo      →  PNG con transparencia
5. blanco y negro        →  sharp: .grayscale()
6. resize                →  al alto del lienzo
7. al template
```

Los pasos 4 a 6 corren una sola vez por placa, sobre la foto que ya pasó la
validación. El recorte es el paso caro y no se ejecuta sobre nada descartable.

**Requisitos que tiene que cumplir una foto para servir en este template:**

| | Requisito | ¿Verificable en código? |
|---|---|---|
| 1 | Medio cuerpo o cuerpo entero — un headshot apretado no llega al borde inferior | parcialmente: la proporción lo aproxima |
| 2 | Fondo separable — pelo suelto sobre fondo complejo da un recorte sucio | no |
| 3 | Mínimo 800px de lado, idealmente 1200+ | sí |
| 4 | La persona identificable y bien expuesta | no |

El paso 3 solo puede verificar el requisito 3 y aproximar el 1. **Los otros dos
los verifica el ojo humano al elegir qué foto subir**, que es exactamente el
motivo del cambio de §3.1: mover ese juicio a donde hay un humano mirando, en
vez de pedirle a un buscador que lo adivine.

---

## 9. Riesgos conocidos

### ✅ Cerrado — La tasa de acierto de la búsqueda de fotos

**Era el riesgo principal del proyecto. §3.1 lo elimina** sacando la búsqueda
automática del alcance. La estimación era 20-30% de acierto y la mitigación
prevista ya era "pedirle la foto al invitado"; se tomó esa salida antes de
gastar en medirla.

### ✅ Cerrado — Búsqueda de imágenes ≠ web search

Ya no aplica. Ninguna API de búsqueda de imágenes entra al v1, así que tampoco
hace falta el spike que las comparaba ni una cuenta con tarjeta.

### 🟡 Medio — La calidad del recorte sobre una foto arbitraria

Sigue vigente, aunque atenuado. Una foto elegida por un humano recorta mejor que
una encontrada al azar, pero el pelo suelto sobre fondo complejo sigue dando
bordes sucios.

Mitigación: el mensaje que pide la foto dice explícitamente "fondo limpio", y el
resultado se ve en Slack antes de publicar nada.

### 🟡 Medio — Server tools a través de AI Gateway

No está confirmado que el `web_search` server-side de Anthropic pase por AI
Gateway. El Gateway unifica el API pero puede no exponer features específicas
del proveedor.

**Spike requerido:** probar una llamada con `web_search` vía Gateway. Si no
funciona: usar `@ai-sdk/anthropic` directo para esa llamada, o resolver la
búsqueda con el proveedor de imágenes y pasarle los resultados al modelo como
contexto.

### 🟡 Medio — Costo del background removal

Un servicio pago cuesta ~$0.20 por imagen, lo que lo convierte en **el costo
dominante del sistema** (el LLM sale ~$0.04). Alternativas a evaluar:
`@imgly/background-removal` corriendo local, o Replicate con BiRefNet.

A 52 placas al año cualquiera de las tres es irrelevante en plata. Importa si el
volumen crece.

### 🟡 Medio — El grano sobre el texto

Satori puede no llegar. Mitigación aceptada: v1 con texto plano si hace falta.

### 🟢 Bajo — Timeout de Vercel

El turno 1 hace dos búsquedas y puede tardar 20-30s. Slack exige ack en 3
segundos. Se resuelve confirmando primero y trabajando con `waitUntil`. Hay que
configurar `maxDuration` acorde y verificar el límite del plan.

### 🟢 Bajo — Derechos de las fotos

Cada foto guarda su URL de origen en Blob y en el registro. Es el único rastro
si alguien reclama.

---

## 10. Almacenamiento

Vercel Blob, tres cosas por placa:

| Qué | Por qué |
|---|---|
| Foto original descargada | las URLs de internet se pudren; y la vas a necesitar si rehacés la placa |
| Foto procesada (recortada, B/N) | evita pagar el recorte dos veces |
| La placa final | historial, y es el paso previo para publicar a Instagram, que pide URL pública |

Redis guarda solo el estado **entre turnos** (candidatas, copy propuesto). Es
efímero, con TTL.

---

## 11. Entregables del v1

0. **Rescatar las fuentes** (§4) — `Archivo.ttf`, `Archivo-900-125.ttf`,
   IBM Plex Mono, commiteados. Sin esto no hay template posible.
1. `marca/` con tokens, SVGs, texturas y `Placa.tsx`
2. **`npm run placa`** — script local que renderiza con datos hardcodeados,
   sin Slack ni LLM. Es donde va a pasar el 70% del tiempo de desarrollo.
3. `lib/buscar.ts` — copy del invitado
4. `lib/fotos.ts` — búsqueda, filtro y procesamiento
5. `lib/render.tsx` — datos → PNG
6. `bot.ts` — los tres handlers de Slack
7. `app/api/slack/route.ts` — el webhook

**Orden de construcción sugerido:** 1 y 2 primero, solos. Si el template no
queda bien, nada de lo demás importa.

---

## 12. Criterio de éxito

El v1 está listo cuando, para 5 invitados reales:

- El copy generado se usa sin editar en al menos 3 de 5
- El recorte de fondo sale limpio en al menos 4 de 5
- La placa renderizada es indistinguible de una hecha a mano
- El ciclo completo, de escribir el nombre a tener el PNG, toma menos de 2 minutos

**El criterio de la foto cambió con §3.1.** Antes medía si la búsqueda
encontraba algo usable; ahora mide si el recorte funciona sobre fotos que vos
elegiste. Si falla, la salida no es cambiar de proveedor de recorte antes de
revisar qué tenían en común las fotos que fallaron — probablemente sea el fondo,
y eso se arregla en el mensaje que pide la foto, gratis.
