# Referencia

Acá va **a qué tiene que parecerse** la placa. No es lo mismo que
`../placa-actual.png`, y la diferencia importa:

- `placa-actual.png` es el **golden file**: lo que el sistema produce hoy. Su
  test falla cuando el render cambia, y sirve para que no cambie sin que nadie
  lo note. No dice si lo que produce está bien.
- Esto es el **objetivo**: cómo se ve una placa bien hecha. Cuando el golden y
  la referencia difieren, el que está mal es el golden.

`1x1-objetivo.jpeg` es la placa de Guillermo Rauch hecha a mano. Es la que fijó
el layout centrado: invitado a todo el cuadro, nombre apoyado sobre el torso,
barra de datos de una fila, wordmark centrado al pie.

## Para qué se usa

Para **medir**, no para que un modelo la mire y opine.

El encuadre de la foto no se puede resolver mostrándole esta imagen a un agente
y pidiéndole que ajuste: lo único que puede hacer con esa opinión es mover
`escala` a ciegas, un número por vez. Y ya se probó que ese lazo no converge.

El camino es al revés, y en tres pasos separados:

1. **De acá salen números** —dónde cae la coronilla, qué fracción del alto ocupa
   la cabeza, dónde quedan los ojos— medidos una sola vez y escritos en el
   sistema como objetivo.
2. **De la foto que sube el humano salen otros números**, medidos por un modelo
   con visión: dónde está la cabeza *en esa foto*.
3. **El encuadre es aritmética**: la escala y el recorte que llevan (2) a (1).

Así el modelo aporta lo único que el código no puede sacar de los píxeles
—semántica: esto es una cabeza, acá están los ojos— y la decisión de encuadre
sigue siendo determinística y testeable.

Los dos intentos de saltarse esto fallaron, y por la misma razón: `escalaSujeto`
derivada del alto de la silueta daba una cabeza gigante, y normalizada por el
ancho de la cabeza agarraba el pelo. Las dos son **estadísticas de píxeles**, no
semántica. Una silueta con los brazos cruzados y un primer plano dan números
parecidos y encuadres opuestos.

## Qué NO copiar de la referencia

- El timecode `00:00:07:21` es un placeholder, igual que en la nuestra.
- La fecha va sin el día de la semana en algunas versiones; el sistema pide
  `"JUEVES 20 DE AGOSTO"` porque el programa es siempre jueves.
