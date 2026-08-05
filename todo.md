# Qué queda — al cierre del 2026-08-05

Estado: **32 commits, 83 tests, `tsc` limpio, `next build` pasa.**
El pipeline de generación anda de punta a punta y se probó contra una foto real.

Lo que **no** existe todavía: el bot. Ninguna ruta de API, ningún handler de
Slack. Todo lo hecho hasta acá se ejecuta desde scripts, no desde una conversación.

---

## 1. Las tres tasks que faltan del plan

Van en orden; cada una depende de la anterior. Están escritas completas en
`docs/superpowers/plans/2026-08-03-placas.md`.

- [ ] **Task 21 — Bot y primer turno** (línea 2984)
      El webhook, el `Chat` del SDK, y el primer intercambio: alguien escribe un
      nombre en el canal, el bot busca el copy con Gemini y **pide la foto**.
      Acá también hay que validar el largo del nombre: como el nombre va verbatim
      a la placa, uno de 30 caracteres no entra y el bot tiene que avisar en vez
      de renderizar algo roto (ver `docs/decisiones/003-modelo-y-copy.md`).
- [ ] **Task 22 — Modal de fecha y hora** (línea 3167)
- [ ] **Task 23 — Render y entrega** (línea 3259)

**Para local no hace falta Redis.** Usar `@chat-adapter/state-memory`:
`next dev` es un proceso vivo y retiene estado entre mensajes. Redis recién es
obligatorio en serverless.

**Hace falta un túnel** (ngrok o `cloudflared`) y cargar la URL pública en la
config de la app de Slack, en Event Subscriptions e Interactivity. Eso lo tiene
que hacer Gastón.

---

## 2. Deploy

- [ ] **Task 24 — Deploy a Vercel** (línea 3346)
- [ ] **Task 25 — Medir contra el criterio de éxito** (línea 3429), con 5
      invitados reales

Estado de la infra:

| | |
|---|---|
| Repo | `buildersofftherecord/botraut`, **público** |
| Deploy | integración de Git — push a `main` deploya solo |
| Cuenta | la de BOTR (mail de la empresa), plan free. **No se llega desde el login personal de Gastón** |
| Redis | ❌ roto, ver abajo |

---

## 3. Redis — pendiente concreto

El store de Upstash (`prompt-earwig-149142.upstash.io`) **rechaza su propia
credencial**, incluso la que sale del environment de Vercel:

```
REST → WRONGPASS invalid username-password pair or user is disabled
TCP  → WRONGPASS      ← este es el que usa el adapter
```

No es error de copiado: el valor vino del almacén de Vercel y lo rechazan los dos
protocolos.

**Se recreó el store el 2026-08-05 y falló igual.** Base nueva
(`subtle-salmon-74535`), mismo `WRONGPASS`. Descartado el parseo de la URL y el
encoding: conectando con `username`/`password` explícitos, sin pasar por la URL,
falla idéntico. La contraseña son 62 caracteres limpios, sin `%`, `:` ni `@`.

Dos bases independientes creadas por el mismo camino rechazan las dos su propia
credencial. **El problema es el camino, no el recurso.**

Se probó también **desde adentro de Vercel** (`/api/redis-ping`, ruta temporal
que sigue en el repo): mismo `WRONGPASS`, mismo host. Eso descarta la última
explicación benigna — que las credenciales fueran de vida corta o válidas solo en
el runtime donde Vercel las inyecta. Vercel la inyectó en su propio runtime y
Upstash la rechazó igual.

Dato que aporta el diagnóstico: un token basura devuelve `"invalid or missing
auth token"`, mientras que el nuestro devuelve `"invalid username-password pair
or user is disabled"`. Son mensajes **distintos**, así que el token es correcto y
rutea bien a la base; lo que está apagado es el usuario. **Rotar la contraseña no
sirve** — un usuario deshabilitado falla con cualquier contraseña.

- [ ] Crear cuenta en **console.upstash.com** con el mail de BOTR. Es la cuenta
      propia de Upstash, distinta de la que gestiona Vercel — por eso antes no
      aparecía nada ahí
- [ ] Create Database → Redis, región cercana a la de Vercel, tier gratis
- [ ] Copiar el `rediss://...` de la página de la base, en Upstash directo
- [ ] Pegarlo en `.env.local` **con comillas** y verificar con un ping
- [ ] Para el deploy: cargar `REDIS_URL` **a mano** en Settings → Environment
      Variables de Vercel. No volver a usar el Marketplace para esto
- [ ] Verificar desde producción abriendo `/api/redis-ping`. Cuando dé
      `ok:true`, **borrar esa ruta** (`app/api/redis-ping/route.ts`) — es
      diagnóstico temporal, no parte del producto

---

## 4. Deuda técnica a resolver antes o durante el deploy

- [ ] **`@imgly/background-removal-node` pesa 155MB** y arrastra tres copias de
      libvips. Estaba anotado como bloqueante contra el límite de 250MB de Vercel,
      **pero ese límite subió a 5GB con Fluid Compute**, así que probablemente ya
      no sea un problema. **Sin verificar:** los deploys de hoy no lo prueban
      porque ninguna ruta importa `lib/recorte.ts` todavía y Next no lo bundlea.
      Se contesta solo en el primer deploy con los handlers puestos.
      Si igual no entra, el plan B es un servicio hosted (remove.bg / Replicate),
      ~10 USD/año. La firma `recortar(bytes) => Promise<Buffer>` no filtra nada de
      @imgly, así que el cambio toca un archivo.

- [ ] **Los errores de `descargar()` salen sin traducir.** `recortar()` y
      `validarFoto()` devuelven castellano accionable; `descargar()` devuelve
      `descarga: HTTP 404 en <url>`. Quien escriba los handlers **no debe asumir
      que lo que sale del pipeline ya sirve para mostrarle a un humano.**

- [ ] **`lib/almacenar.ts` (Vercel Blob) no existe** — la Task 19 nunca corrió y
      no hay `BLOB_READ_WRITE_TOKEN`. `generarPlaca` devuelve `{ png }` sin `url`.
      Decidido a propósito; si alguna vez se hace la Task 19, el test "guarda las
      tres etapas" es parte de ella.

- [ ] **`fuentes` en los schemas solo puede guardar URLs inventadas** y nadie lo
      lee. O se usa o se saca.

- [ ] Ajustes finos del lienzo 4:5: colisión de acentos en nombres de 3 líneas,
      desborde vertical con nombres de muchas palabras cortas, umbral de la
      textura (15% → 8-10%, el piso de ruido real medido es 4.68%).

---

## 5. Cierre del proceso

- [ ] **Review final de toda la rama** con el modelo más capaz, apuntándole a las
      deudas de arriba y al roll-up de hallazgos menores del ledger
      (`.superpowers/sdd/2026-08-03-placas/progress.md`)
- [ ] Buscar si queda **algún otro módulo cuya única cobertura sea un mock de
      librería externa**. Ese patrón ya escondió un bug real: `recortar()` estaba
      rota para toda foto real mientras sus tests pasaban en verde
