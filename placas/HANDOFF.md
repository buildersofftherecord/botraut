# Prompt de handoff

Copiá todo lo que sigue a la conversación nueva.

---

## Contexto

*Builders Off The Record* es un programa semanal. Cada semana se anuncia un
invitado con una placa cuadrada para Instagram. El diseño de esa placa ya está
terminado y vive en `placas/` — es un paquete npm autocontenido con sus fuentes,
sus tokens de marca y sus tests.

**Tu tarea es construir la tool que un agente de Slack va a usar para generar
esas placas.** No vas a diseñar nada: el diseño está cerrado y verificado.

## Antes de escribir código

1. Leé `placas/README.md` **entero**, empezando por la sección **"Contrato para
   quien construya la tool"**. Ahí está qué garantiza el paquete y qué espera de
   quien lo llama.
2. Corré `cd placas && npm install && npm test`. Tienen que pasar 16 tests. Si no
   pasan, pará y avisá antes de seguir — algo está roto en el punto de partida.
3. Mirá `placas/placa-actual.png`. Eso es exactamente lo que la tool tiene que
   producir, con otros datos y otra foto.

## La API

```ts
import { renderizar } from "./placas/Placa";
import { validarDatos } from "./placas/datos";
import { prepararRetrato } from "./placas/primitivos/Retrato";
import { LIENZOS, altoDeFoto } from "./placas/lienzos";

// 1. Validar. Tira con todos los problemas juntos, en un mensaje legible.
const datos = validarDatos(jsonCrudo);

// 2. Preparar la foto. Tiene que llegar YA RECORTADA (PNG con alfa).
//    El ×2 es el supermuestreo; no lo saques.
const l = LIENZOS["1:1"];
const foto = await prepararRetrato(bufferDeLaFoto, {
  ancho: l.ancho * 2,
  alto: altoDeFoto(l) * 2,
});

// 3. Renderizar. Devuelve un PNG de 1080×1080.
const png = await renderizar(datos, "1:1", foto);
```

Datos válidos:

```json
{
  "invitado": {
    "nombre": "Guillermo Rauch",
    "rol": "CEO & Founder @Vercel / Creador de Next.js",
    "genero": "m"
  },
  "fecha": "JUEVES 20 DE AGOSTO",
  "hora": "21:00 HS",
  "enVivo": true
}
```

Todo llega ya formateado y en mayúsculas. El template no interpreta fechas ni
traduce nada. `fecha` y `hora` no pueden pasar de 23 caracteres: la barra de datos
tiene ancho fijo.

## Tres límites duros

**1. La foto llega recortada, con fondo transparente — y el paquete no verifica
que lo esté.** Probado: con un JPEG crudo genera la placa igual, con el
rectángulo de la foto visible alrededor de la persona. Si tu tool acepta fotos de
Slack, el recorte lo tenés que resolver vos *antes* de llamar a
`prepararRetrato`.

**2. Sólo `"1:1"`.** Los formatos `4:5`, `9:16` y `16:9` existen en
`lienzos.ts` pero sus números nunca se calibraron: en 9:16 el invitado sale
diminuto arriba a la derecha y queda medio lienzo vacío. No los expongas.

**3. `--escala` la elige un humano.** El default (1.15) está calibrado para una
foto de busto. Otro encuadre necesita otro número y no hay forma automática de
saberlo. Si la tool acepta fotos arbitrarias, alguien tiene que mirar el
resultado antes de publicar.

## Lo que NO tenés que resolver

**El recorte de fondo.** Es un problema abierto y difícil, documentado en
`botraut/todo.md` §3b: usa `@imgly/background-removal-node`, funciona en local y
falla en Vercel porque el trazado de archivos no incluye el modelo. **No intentes
arreglarlo dentro de esta tarea.** Definí la interfaz asumiendo que la foto llega
recortada y dejá el recorte como una pieza aparte.

Si la foto no viene recortada, la tool tiene que **rechazarla con un mensaje
claro**, no generar una placa fea en silencio.

## Reglas sobre `placas/`

- No cambies el diseño. Los tokens, las medidas y los assets están cerrados.
- Si necesitás tocar algo adentro de `placas/`, **`npm test` tiene que seguir
  pasando**. Si falla el test del golden file (`placa-actual.png`), pará y
  preguntá: significa que cambiaste el diseño, y eso no es parte de tu tarea.
- Si tocás la capa fija (fondo, `REC`, timecode, logo), corré `npm run hornear`.
  El test te lo va a recordar si te olvidás.

## Cómo sabés que terminaste

- `npm test` pasa en `placas/`.
- Tu tool genera una placa desde datos + una foto recortada, y el PNG es de
  1080×1080.
- Datos inválidos (falta el rol, género mal, fecha muy larga) devuelven un
  mensaje legible que el agente de Slack pueda mostrarle a la persona — no un
  stack trace.
- Una foto sin recortar se rechaza con un mensaje, no genera una placa mala.
- Corriendo dos veces con los mismos datos sale el mismo archivo.
