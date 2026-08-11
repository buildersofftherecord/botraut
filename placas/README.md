# placas — el sistema de las placas de invitado de BOTR

Genera la placa de anuncio de invitado de *Builders Off The Record*. Esta
carpeta es autocontenida: tiene sus fuentes, sus tokens, sus assets de marca y
sus dependencias. No necesitás nada de `landing/` ni de `botraut/` para correrla.

## La placa actual

**`placa-actual.png`** es el diseño elegido. Está en la raíz de la carpeta a
propósito: es la referencia contra la que se compara cualquier cambio. Se
regenera con `npm run actual`, siempre desde `muestra/gr.json` y `muestra/gr.png`.

Si tocás un token y `placa-actual.png` cambia, cambió el diseño. Esa es la idea.

## Armar una placa

```sh
npm install     # sólo la primera vez

npm run placa -- \
  --datos  muestra/gr.json \
  --foto   muestra/gr.png \
  --salida salida/mi-placa.png
```

Sale un PNG de 1080×1080. `--lienzo 4:5` (o `9:16`, `16:9`) cambia el formato;
sin el flag es `1:1`. `--escala` ajusta cuánto ocupa el invitado (ver abajo).

### El JSON de datos

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

Eso es **todo** lo que cambia entre una placa y la siguiente. `fecha` y `hora`
van ya formateadas y en mayúsculas — el template no las interpreta. `genero`
decide si la etiqueta dice INVITADA, INVITADO o INVITADX.

Si algo de la placa no está en el JSON, es del diseño y no se toca por
invitado: el timecode `00:00:07:21` y el logo son fijos a propósito.

### La foto

Tiene que llegar **ya recortada**, con fondo transparente. `primitivos/Retrato.ts`
la recorta al sujeto, la escala, la pasa a B/N, le hunde los negros y le
desvanece el borde izquierdo. No recorta el fondo — eso es otro problema y no
vive acá.

Dos cosas que importan:

- **`--escala`** (default 0.75) es cuánto del **alto** del cuadro ocupa el
  invitado. Sin el flag, el CLI no manda nada y decide `prepararRetrato`: tener
  acá un default copiado del suyo ya rompió el golden file una vez. Depende del
  encuadre de la foto de origen, no del diseño, y por eso es un flag. Con la
  foto de muestra: 0.85 sube la cabeza y el nombre le cruza el brazo, 0.65 lo
  deja flotando en el aire de arriba, 0.75 lo pone donde va.
- **Cuanto más grande la foto, mejor.** `muestra/gr.png` tiene 433×505 de sujeto
  útil y se escala 2.6× para llegar a la resolución de render: está blanda si la
  mirás al 100%. El grano y la curva de negros lo disimulan a tamaño de
  Instagram, pero nada en el sistema lo compensa de verdad.

El invitado va **centrado** y **anclado arriba**. El cuadro de la foto mide el
94% del alto del lienzo y va pegado abajo, así que su borde superior cae al 6%,
que es donde arranca la coronilla en la referencia. Anclado abajo la cara
arrancaba al 27% y la persona quedaba colgando.

Se escala por **alto**, no por ancho. Por ancho, el tamaño final dependía de
cuán abierto estuviera el plano de origen: con los brazos cruzados la silueta es
ancha, se achicaba para entrar, y la persona quedaba baja. Por alto, una foto de
busto y una de medio cuerpo llegan las dos a la misma altura de cabeza.

### Cómo se resuelve la base

El invitado tiene que apoyarse en algo o se lee como un recorte pegado encima.
En las placas originales lo resuelve una bandera de tela que cruza en diagonal
por abajo y le tapa el cuerpo.

Acá lo resuelve el **layout**, no un objeto: el nombre va centrado abajo y se le
apoya encima del torso, y de ahí para abajo el cuerpo se disuelve en negro con
**`desvanecidoBase`** (default 0.3), un degradado sobre el alfa. Se intentó
replicar la bandera —primero componiendo formas, después simulando tela con
Three.js y capturándola en Chrome headless— y las dos veces salió peor que no
tenerla: la simulación da la geometría pero no el material, y una malla lisa con
dos luces direccionales es una sábana, no una bandera. El problema real no era
que faltara un objeto sino que el encuadre no cerraba.

Dos cosas del degradado que costaron encontrar:

- **Va anclado al borde inferior del sujeto, no al del cuadro.** Salvo que la
  persona llegue justo al piso, entre las dos hay transparencia y un degradado
  desde el piso del cuadro se gasta entero sobre esa nada.
- **Cada degradado necesita su propia pasada de `dest-in`.** Meter el de los
  costados y el de la base en un mismo SVG con `mix-blend-mode:multiply` no
  funciona: librsvg lo ignora y el segundo pinta encima del primero, con lo que
  reaparece el rectángulo del cuadro.

Se verifica midiendo el salto máximo de alfa entre filas consecutivas de la foto
preparada: con el canto duro daba 226/255, con el desvanecido da 1.7/255.

Se probó también un **zócalo** —un degradado negro sobre el borde inferior de
toda la placa, entre la foto y el logo— y se descartó: no tapa el canto (está
más abajo que el corte) y una vez que el desvanecido funciona no agrega nada.
Los renders están en `iteracion/comparacion-base.png`.

## Cómo está armado

```
tokens.ts            colores, tipografía, HUD, fondo — la fuente de verdad
lienzos.ts           las medidas de cada formato (1:1, 4:5, 9:16, 16:9)
datos.ts             el tipo de lo que cambia por invitado
medirNombre.ts       cuánto achicar el nombre para que entre en su columna
Placa.tsx            compone los primitivos en el layout
generar.ts           el CLI
fuentes/             Anton + IBM Plex Mono (OFL, versionadas)
marca/               los primitivos de marca en SVG
primitivos/
  Fondo.ts           el monograma tileado + grano + viñeta
  Retrato.ts         recorte, escala, B/N, curva de negros, desvanecido
  Logo.ts            el wordmark recoloreado a gris
  Hud.tsx            Etiqueta y PuntoRec
  Iconos.tsx         calendario, reloj, señal
muestra/             datos y foto de ejemplo
placa-actual.png     el diseño elegido
exploracion-fondos/  cómo se llegó al fondo actual
iteracion/           cómo se llegó al nombre, la foto y el logo
```

### Las tres reglas que hay que saber antes de tocar nada

**1. Todo se multiplica por `s`.** La placa se dibuja al doble de resolución y
baja a 1080 con Lanczos, porque Satori antialiasa mal a 1x. Cualquier medida en
px que quede sin multiplicar por el factor sale a la mitad de tamaño relativo, y
si es un trazo fino desaparece del todo. Ya pasó: la primera versión del fondo
tenía scanlines de 1px y salían en blanco.

**2. Satori no es un navegador.** No soporta `filter`, ni `<pattern>`, ni
`<mask>`, ni `feTurbulence`. Todo lo que sea trama o filtro se resuelve con
sharp *antes* y entra al template como PNG. Por eso `Fondo.ts` devuelve un
buffer y no JSX, y por eso la foto llega ya en B/N.

**3. Los tokens no se re-derivan a ojo.** Salen de
`landing/app/globals.css`, o de medir las placas originales en
`../botraut/marca/referencia/`. Que la placa y el sitio compartan los mismos
valores es lo que los hace un sistema y no dos cosas parecidas. Cada excepción
está comentada en `tokens.ts` con su medición al lado — incluida la más grande,
que es la tipografía display.

## La tipografía display no es la de la landing

La landing usa Archivo en el extremo **ancho** de su eje (`wdth 125`). La placa
usa **Anton**, y es la única pieza donde se separan a propósito.

Lo que importa cuando el nombre vive en una columna de ancho fijo es cuánta
altura de mayúscula da la fuente por unidad de ancho de palabra:

```
placas originales (medido)   0.238
Anton                        0.216
Archivo wdth 75              0.136
Archivo wdth 125             0.087   ← lo que usábamos
```

Con Archivo 125 el nombre ocupaba 10.9% del alto contra 18.7% de la referencia,
y no había ajuste que lo arreglara: `maquetarNombre()` sólo puede achicar o partir en dos. Con
Anton llega a 16.3% sin mover una medida del layout — y cerró casi todo el hueco
que había entre el rol y la barra de datos, porque ese hueco *era* el nombre
siendo chico.

Anton es además, casi con seguridad, la fuente de las placas originales. Ya
estaba en el repo, en `landing/production/placa/fonts/`.


## Contrato para quien construya la tool

Esto es lo que `placas/` garantiza y lo que **espera de quien lo llama**. Si vas
a envolver esto en una tool para un agente, leé esta sección entera.

### Lo que garantiza

- `renderizar(datos, "1:1", foto)` devuelve un PNG de 1080×1080.
- **Determinista**: los mismos datos y la misma foto dan el mismo byte, siempre.
- Los datos se validan con `validarDatos()`. Si algo está mal, tira con todos
  los problemas juntos en un mensaje pensado para que lo lea un agente y arregle
  el JSON — no un stack trace.
- El diseño no puede cambiar por accidente: `npm test` compara contra
  `placa-actual.png` y contra la capa horneada.

### Lo que espera de vos — y no valida

**1. La foto tiene que llegar recortada.** Fondo transparente, PNG. Este paquete
no recorta y **no se da cuenta si no lo hiciste**: probado con un JPEG crudo,
genera la placa igual, con el rectángulo de la foto visible alrededor de la
persona. Resolver el recorte es problema de la tool, no de acá, y es la parte
más difícil de todo esto — ver `botraut/todo.md` §3b, donde está abierto.

**2. `--escala` la elige un humano.** El default 1.15 está calibrado para un
plano de busto. Otro encuadre necesita otro número y no hay forma automática de
saber cuál. Si la tool acepta fotos arbitrarias, alguien tiene que mirar el
resultado.

**3. Sólo usá 1:1.** `4:5`, `9:16` y `16:9` existen en `lienzos.ts` pero sus
números nunca se calibraron: en 9:16 el invitado queda diminuto arriba a la
derecha y hay medio lienzo vacío. No los expongas hasta calibrarlos.

**4. Todo lo que va en la placa ya viene formateado.** `"JUEVES 20 DE AGOSTO"`,
`"21:00 HS"`. El template no interpreta fechas ni traduce nada.

### Las dos capas

La placa se compone de dos capas, y esa división es el punto de entrada para
entender el código:

**La capa fija** (`primitivos/Fijo.tsx` → `fijo/*.png`) es idéntica en todas las
placas: fondo, `REC ●`, el timecode y el wordmark de abajo a la derecha. Se
hornea con `npm run hornear` y **se versiona en el repo**. Existe por dos
razones: cuesta 2.05s de los 3.69s que tardaba una placa —generarla una vez bajó
el render a 1.45s— y porque horneada, un agente que arma placas no puede tocar la
marca sin querer.

**La capa variable** es lo único que cambia: la foto y cinco textos —etiqueta de
género, nombre, rol, fecha y hora— más la barra de datos que los contiene.

Si tocás algo de la capa fija, corré `npm run hornear`. Si te olvidás, `npm test`
falla y te lo dice: una capa horneada se desactualiza en silencio, y ese test es
lo que hace que hornear sea seguro en vez de riesgoso.

## Tests

```sh
npm test
```

Tres cosas: que la placa siga saliendo igual a `placa-actual.png`, que la capa
horneada coincida con lo que produce el código hoy, y que la validación rechace
los casos que antes producían placas rotas en silencio.

Se verificaron mutando el código —cambiar la opacidad del fondo, el gris del
nombre y la posición de la barra de datos hacen fallar la suite—, no sólo mirando
que pasen.

## El fondo

Es el monograma cuadrado de la marca (`botr-monograma-cuadrado-sin-placa-neg`)
tileado en 6 columnas al 3% de opacidad, atenuado sobre la columna del nombre,
encima de un degradado negro→carbón con grano y viñeta.

Reemplaza a la lluvia de ceros y unos de las placas viejas. `exploracion-fondos/`
tiene los renders de los cuatro caminos que se probaron —binario, señal de
video, retícula de encuadre, waveform y monograma— cada uno con la misma placa,
para que la decisión quede documentada y no haya que volver a discutirla desde
cero. `comparacion-limpio.png` es la que cerró.

Dos cosas que se aprendieron ahí y no son obvias:

- El monograma **con placa** (`botr-monograma-cuadrado`) no sirve de fondo: su
  rect es negro pleno y sobre negro no es nada. Va la versión sin placa.
- El asset trae el punto rojo del monograma, así que el fondo reparte
  `COLOR.rojo` por toda la placa sin que haya que pintarlo aparte.

## El pie no lleva leyenda

Hubo un `[ BUILDERS TALKING TO BUILDERS ]` centrado sobre el borde inferior y se
sacó. Está en **una sola** de las cinco originales (Veiras), y ahí va encerrada
entre los dos corchetes inferiores del marco HUD: es parte del marco, no un
elemento suelto. Como los esquineros ya se habían sacado, la leyenda quedaba
flotando sola en un borde vacío.

Además repetía —con el wordmark justo arriba, "BUILDERS" aparecía tres veces en
el quinto inferior— e iba al 55% de opacidad contra el 10% del borde de la caja
de datos, o sea que la decoración se veía cinco veces más que el dato del
evento.

Sin ella el pie lee como dos bloques: datos a la izquierda, marca a la derecha.
Si alguna vez va algo ahí, el camino es el de la placa de Nahuel —`NO FILTER /
ALL REAL` chico y alineado a la izquierda— que dice algo en vez de repetir el
nombre del programa.

## Lo que falta

- **Queda algo de hueco entre el rol y la barra de datos.** Era un tercio de la
  placa; con Anton bajó bastante, pero el nombre sigue en 16.3% contra 18.7% de
  la referencia y se nota. La palanca que falta es el ancho de la columna del
  nombre: en Veiras el nombre llega al 55% del ancho y el invitado arranca al
  64%; en la nuestra es 50% y 57%.
- **El rol corta mal.** "CEO & Founder @Vercel / Creador" / "de Next.js" deja la
  barra huérfana al final de la primera línea. Nadie decidió dónde parte.
- **El borde de la barra de datos está al 10% de opacidad** y casi no se ve, para
  ser lo que dice cuándo es el evento.
- **El recorte de la foto no vive acá** y es el hueco más grande. Ver el
  contrato de arriba.
- **`Placa.tsx` todavía es un solo archivo.** `Fondo`, `Fijo`, `Retrato` y
  `Logo` ya salieron como primitivos; faltan `Titular` y `CajaDatos`.
- **Todo está calibrado contra una sola foto.** `escalaSujeto`, `gamma` y
  `desvanecidoBase` salieron de un busto de 433×505 de alguien vestido de negro.
  Simulando un sujeto claro aguanta, pero se le empieza a ver el filo de la
  silueta. Falta probarlo con una segunda foto real.
- **Los lienzos que no son 1:1 están sin calibrar.** Los números de `4:5`,
  `9:16` y `16:9` en `lienzos.ts` son un punto de partida, no valores medidos.
- **No hay tests.** Los de `botraut/marca/` cubren la versión anterior de este
  template y no se portaron.
