# Interacción con las manos — Mariposas mágicas

Experiencia interactiva de mariposas mágicas con p5.js, JavaScript y MediaPipe Hand Landmarker, con la cámara web activada en tiempo real.

---

## 1. Requerimientos originales

Crea una experiencia interactiva de mariposas mágicas utilizando p5.js, JavaScript y MediaPipe Hand Landmarker, con la cámara web activada en tiempo real.

La cámara debe mostrar mi imagen en modo espejo y detectar los movimientos de mis manos.

### Interacciones:

Mano abierta: aparecen 5 mariposas luminosas que nacen de pequeñas partículas y vuelan alrededor de la palma.

Mover la mano: las mariposas siguen suavemente su movimiento.

Dedo índice levantado: una mariposa se posa sobre la punta del dedo y mueve sus alas.

Cerrar el puño: las mariposas se desintegran en partículas brillantes que desaparecen lentamente.

Volver a abrir la mano: nacen nuevas mariposas y el ciclo se repite.

Juntar ambas manos: las mariposas forman un remolino mágico.

Diseño: mariposas con alas detalladas en tonos lilas, rosados y azules, movimientos naturales, brillo suave y partículas luminosas. Deben dibujarse y animarse con p5.js, no utilizar imágenes estáticas.

La experiencia debe funcionar directamente con los gestos captados por la cámara web, sin usar el mouse. Evita generar mariposas repetidamente mientras mantengo la mano abierta y procura que las animaciones sean fluidas.

---

## 2. Stack técnico

**Asunción:** aplicación web estática, sin bundler ni build step. Se sirve con un servidor local porque `getUserMedia` exige `localhost` o HTTPS.

- **p5.js** 1.9+ en modo global, vía CDN.
- **MediaPipe Tasks Vision** (`@mediapipe/tasks-vision`), módulo `HandLandmarker` con WASM.
- **Modelo:** `hand_landmarker.task` (float16) desde el CDN oficial de MediaPipe.
- **Configuración del detector:**
  - `runningMode: "VIDEO"`
  - `numHands: 2`
  - `minHandDetectionConfidence: 0.5`
  - `minHandPresenceConfidence: 0.5`
  - `minTrackingConfidence: 0.5`
- Navegadores objetivo: Chrome y Edge de escritorio (últimas 2 versiones). Firefox y Safari quedan fuera de alcance.

---

## 3. Estructura de archivos

```text
index.html          Estructura, HUD, overlays y carga de scripts
css/style.css       Layout, HUD futurista y overlays
js/main.js          Cámara, loop de p5, ambiente visual y estados de carga/error
js/hands.js         HandLandmarker y mapeo espejado a canvas
js/gestures.js      Clasificación de gestos con histéresis
js/butterfly.js     Dibujo procedural sólido, aleteo y física
js/particles.js     Sistema de partículas con pooling
js/scene.js         Máquina de estados, dueño por mariposa y orquestación
js/audio.js         Sintetizador Web Audio (ambiente y efectos)
server.js           Servidor estático sin dependencias
spec.md             Especificación funcional y técnica
README.md           Cómo ejecutar y resolver problemas
```

---

## 4. Cámara y coordenadas

- Video capturado con `getUserMedia` a 640x480, oculto en el DOM y dibujado en el canvas.
- La imagen se dibuja **espejada** (`translate(width, 0); scale(-1, 1)`).
- Mapeo de landmarks normalizados `[0,1]` a píxeles del canvas:
  - `x = offsetX + (1 - landmark.x) * anchoDibujado`
  - `y = offsetY + landmark.y * altoDibujado`
- La escala se calcula con cobertura tipo `object-fit: cover` para que el video llene el canvas sin deformarse; se recalculan escala y offsets en `windowResized`.
- La detección corre como máximo **una vez por frame de video nuevo** (comparar `video.currentTime` contra el último procesado). Nunca re-detectar el mismo frame.
- Si el FPS cae por debajo de 45, la detección baja a un máximo de 30 Hz.

---

## 5. Clasificación de gestos

Se evalúa por mano y por frame. Un dedo está **extendido** si la distancia punta–muñeca es mayor que la distancia nudillo (PIP)–muñeca; es robusto a la rotación de la mano.

| Gesto | Regla |
| --- | --- |
| Mano abierta | Índice, medio, anular y meñique extendidos (se tolera un dedo semi-flexionado) |
| Puño | Índice, medio, anular y meñique flexionados |
| Índice levantado | Índice extendido sin llegar a mano abierta; puede acompañarlo otro dedo |
| Dos manos juntas | Distancia entre las muñecas de ambas manos menor a `0.18 × ancho` del canvas |

**Histéresis obligatoria** (evita parpadeo):
- Un gesto se confirma tras sostenerse **120 ms**.
- Un gesto se abandona tras **150 ms** sin cumplirse.
- El estado visual solo cambia con la clasificación confirmada, nunca con el frame crudo.
- Una mano que desaparece conserva su estado hasta **1.5 s**, para no duplicar nacimientos por un parpadeo de detección.

**Anti-repetición:** las 5 mariposas nacen únicamente en la transición a `mano abierta`. Mantener la mano abierta no genera mariposas nuevas.

**Prioridad cuando coexisten señales:** dos manos juntas > índice levantado > puño > mano abierta > reposo.

**Seguidora del dedo:** al detectarse el gesto de índice se elige la mariposa viva más cercana a la punta de esa mano y se mantiene esa misma mientras dure el gesto; no salta entre mariposas. Su resorte es más rígido que el del vuelo libre para que acompañe el dedo cuando se mueve rápido.

---

## 6. Máquina de estados

| Estado | Entrada | Comportamiento |
| --- | --- | --- |
| `IDLE` | Sin mano detectada | Las mariposas existentes derivan y se dispersan |
| `OPEN` | Transición a mano abierta | Nacen 5 mariposas por mano desde partículas alrededor de la palma |
| `FLYING` | Mano abierta sostenida | Las mariposas orbitan y siguen la palma que las generó |
| `LANDING` | Índice levantado | Una mariposa por mano se posa en la punta del índice y aletea |
| `DISSOLVING` | Puño | Todas las mariposas se desintegran en partículas |
| `WHIRLPOOL` | Dos manos juntas | Las mariposas orbitan el punto medio en remolino |

- **Dueño por mariposa:** cada mariposa recuerda la mano que la generó. Con las dos manos abiertas y separadas se forman dos grupos independientes, uno por palma; sin esto todas se agrupan en una sola mano.
- Cada mano en gesto de índice tiene su propia mariposa seguidora, elegida por cercanía y estable hasta que el gesto termina.
- `WHIRLPOOL` tiene prioridad absoluta sobre cualquier otro estado mientras se sostenga.
- Al salir de `WHIRLPOOL`, las mariposas vuelven a su comportamiento previo.
- Si no se detecta ninguna mano durante más de **2 s**, se fuerza `IDLE`.

---

## 7. Diseño visual

- **Paleta:** lila `#BA8CFF`, rosa neón `#FF78D6`, azul cian `#60E0FF`, blanco cálido `#FFF6E5`, fondo profundo `#0B0714`.
- **Alas:** ala superior con ápice y ala inferior grande, dibujadas con `beginShape`/`bezierVertex`; tamaño **64–104 px**; aleteo senoidal de 4.5–7.5 Hz con amplitud variable por mariposa.
- **Cuerpo sólido:** alas opacas con tres capas de sombreado (base oscura, color principal y borde iluminado), ocelo con anillo y brillo, nervaduras, abdomen segmentado, tórax y cabeza con volumen, sombra proyectada sobre el video. La iluminación de las alas se atenúa cuando el aleteo las pone de canto.
- **Estética futurista:** rejilla holográfica animada sobre el video, halos aditivos, borde neón en cada ala, viñeta radial, blobs de luz violeta y cian, y HUD con telemetría en monoespaciada (manos detectadas, FPS y estado) más marco de esquinas.
- **Partículas:** 40–120 por evento de nacimiento o disolución; vida 600–1400 ms; se dibujan como estelas aditivas.
- **Movimiento:** física con ruido Perlin para deriva natural, amortiguación y límites suaves dentro del canvas.
- Todo se dibuja proceduralmente con p5.js. **Cero imágenes estáticas.**

---

## 8. Audio

- Sintetizador propio con Web Audio API, **sin archivos de audio**.
- **Ambiente:** pad continuo de cuatro parciales con filtro pasa-bajos y LFO lento, volumen muy bajo.
- **Eventos:** acorde ascendente al nacer mariposas, barrido descendente de ruido al disolverse, barrido ascendente en el remolino y un pluck agudo al posarse la seguidora.
- El audio arranca con la primera interacción del usuario (política de autoplay del navegador). El HUD muestra "SONIDO · CLIC PARA ACTIVAR" hasta que el contexto queda activo.
- Botón de silencio en pantalla y tecla `M`. El silencio no corta la experiencia ni el reconocimiento de gestos.
- Si Web Audio no está disponible, la experiencia sigue funcionando sin sonido.

---

## 9. Performance

- Objetivo **60 FPS** con una mano; mínimo aceptable **30 FPS** con dos manos.
- Límites duros: **40 mariposas** vivas y **600 partículas** simultáneas.
- `pixelDensity(min(devicePixelRatio, 2))`.
- Reciclar mariposas y partículas (pooling); evitar allocaciones por frame.
- La rejilla y los blobs se dibujan sobre el video con blending aditivo, sin blur por frame.

---

## 10. Carga y errores

- Overlay inicial con "Activando cámara…" mientras se carga el modelo y se pide permiso.
- Permiso denegado → mensaje en español con instrucciones para habilitar la cámara.
- Fallo al cargar modelo o WASM → mensaje de error con botón de reintento.
- Si la cámara no entrega imagen en 4 s, se informa y se ofrece reintentar.
- Instrucciones de gestos visibles los primeros **9 s** y luego se desvanecen.
- Todos los textos de UI en **español neutro**.

---

## 11. Criterios de aceptación

- [ ] La imagen de la cámara se ve en modo espejo.
- [ ] Mano abierta genera exactamente 5 mariposas y no más mientras se mantiene abierta.
- [ ] Con las dos manos abiertas y separadas nacen 10 mariposas y cada grupo sigue su propia palma.
- [ ] Mover la mano arrastra las mariposas de forma suave, sin saltos ni vibración.
- [ ] Índice levantado posa una mariposa en la punta y esta sigue el dedo al moverse.
- [ ] Cerrar el puño desintegra las mariposas en partículas que se apagan.
- [ ] Reabrir la mano genera un ciclo nuevo.
- [ ] Juntar ambas manos forma el remolino y se disuelve al separarlas.
- [ ] El gesto no parpadea entre estados ante temblor normal de la mano.
- [ ] El audio arranca tras la primera interacción y responde a nacimiento, disolución, remolino y posado.
- [ ] 60 FPS con una mano y ≥30 FPS con dos en hardware de escritorio promedio.
- [ ] Todo funciona sin mouse, salvo el permiso inicial del navegador y el control de silencio.

---

## 12. Fuera de alcance

- Grabación o exportación de video.
- Persistencia, cuentas o backend.
- Soporte móvil y tablets.
- Build con bundler, tests automatizados de UI, o despliegue.
