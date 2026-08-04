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
- Búsqueda automática de hasta 4 fotos candidatas
- Recorte de fondo + conversión a blanco y negro
- Modal para fecha y hora
- Aprobación humana antes de renderizar
- Almacenamiento en Vercel Blob (foto original, foto procesada, placa final)
- Script de render local para iterar el diseño sin Slack

**Afuera, explícitamente:**

- Los otros tres lienzos (4:5, 9:16, 16:9) — el template queda parametrizado
  por lienzo para que agregarlos sea configuración, no rediseño
- Publicación automática a Instagram / X / YouTube
- Placas post-episodio con citas de la transcripción
- Cualquier integración con Linear
- Base de datos de invitados

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
TURNO 1 ─ alguien escribe "Naomi Couriel" en el canal
   │
   ├─ ack inmediato: "Buscando a Naomi Couriel..."
   ├─ [A] copy: quién es, rol, afiliación
   ├─ [B] fotos: hasta 4 candidatas
   ├─ guarda todo en Redis + Blob
   └─ postea card: copy propuesto + las 4 fotos + botones
        │
TURNO 2 ─ click en una foto
   │
   ├─ abre modal: fecha, hora, ¿en vivo?, INVITADA/INVITADO
   │
TURNO 3 ─ submit del modal
   │
   ├─ procesa la foto: recorte de fondo → B/N → resize
   ├─ renderiza el PNG 1080×1080
   ├─ guarda la placa en Blob
   └─ postea la placa al thread
```

### Salidas de emergencia

El flujo tiene que tener final incluso cuando la búsqueda falla:

| Situación | Salida |
|---|---|
| Ninguna de las 4 fotos sirve | botón **"Subo yo la foto"** → subís una imagen al thread → sigue en el turno 2 |
| El copy no te gusta | botón **"Editar"** → modal con título y descripción editables |
| No encuentra a la persona | mensaje explícito + opción de cargar todo a mano |
| Nombre ambiguo | devuelve las opciones que encontró y pregunta cuál |

Sin la primera, el sistema no tiene final cuando la búsqueda de fotos falla —
que según la estimación va a pasar seguido (ver §9).

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
  url:         z.string().url(),
  fuente:      z.string().url(),     // la página, no el archivo — para derechos
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

Es la parte con más piezas móviles y la que concentra el riesgo.

```
1. búsqueda de imágenes  →  URLs candidatas
2. filtro                →  descarta <800px, descarta aspect ratios imposibles
3. descarga              →  guarda original en Blob
4. recorte de fondo      →  PNG con transparencia
5. blanco y negro        →  sharp: .grayscale()
6. resize + posición     →  al alto del lienzo
7. al template
```

Los pasos 4 y 5 corren **solo sobre la foto que elegiste**, no sobre las 4. Eso
mantiene el costo en una sola operación de recorte por placa.

**Requisitos que tiene que cumplir una foto para servir en este template:**

1. Medio cuerpo o cuerpo entero — un headshot apretado no llega al borde inferior
2. Fondo separable — pelo suelto sobre fondo complejo da un recorte sucio
3. Mínimo 800px de lado, idealmente 1200+
4. La persona identificable y bien expuesta

Esos cuatro criterios van explícitos en el prompt de búsqueda y en el filtro
programático del paso 2.

---

## 9. Riesgos conocidos

### 🔴 Alto — La tasa de acierto de la búsqueda de fotos

Estimación: **20-30% de las fotos encontradas van a cumplir los cuatro
requisitos.** Ofrecer 4 candidatas mejora la chance de que al menos una sirva,
pero no la garantiza.

Este riesgo se aceptó explícitamente. La mitigación es la salida de emergencia
de §5 ("Subo yo la foto"). **Si después de 10 invitados reales la tasa de
acierto es baja, la respuesta correcta es pedirle la foto al invitado, no
invertir más en la búsqueda.**

### 🔴 Alto — Búsqueda de imágenes ≠ web search

`web_search` de Anthropic devuelve páginas web, no imágenes. Para conseguir
fotos hace falta una API de búsqueda de imágenes aparte: Google Custom Search,
Brave, o SerpAPI. Son **dos llamadas distintas** con dos proveedores distintos.

**Spike requerido antes de escribir código:** elegir el proveedor de búsqueda de
imágenes y verificar calidad de resultados con 5 nombres reales.

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
- Al menos una de las 4 fotos sirve en al menos 3 de 5
- La placa renderizada es indistinguible de una hecha a mano
- El ciclo completo, de escribir el nombre a tener el PNG, toma menos de 2 minutos

Si el segundo criterio falla, la conclusión no es mejorar la búsqueda: es pedir
la foto al invitado.
