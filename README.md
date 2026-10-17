# Mariposas mágicas — Interacción con las manos

Experiencia interactiva con p5.js y MediaPipe Hand Landmarker. La cámara se ve en modo espejo y las mariposas responden a los gestos de tus manos.

## Requisitos

- Node.js 18 o superior (solo para el servidor local).
- Chrome o Edge de escritorio, con cámara web.
- Conexión a internet la primera vez: p5.js, el runtime de MediaPipe y el modelo se descargan desde CDN.

## Cómo ejecutar

```bash
node server.js
```

Abrí <http://localhost:8000> y aceptá el permiso de cámara.

> La cámara solo funciona en `localhost` o HTTPS. Abrir `index.html` con doble clic (`file://`) no va a funcionar.

Para usar otro puerto:

```bash
set PORT=3000 && node server.js
```

## Gestos

| Gesto | Efecto |
| --- | --- |
| Mano abierta | Nacen 5 mariposas por mano, ancladas a esa palma |
| Mover la mano | Las mariposas orbitan y siguen su propia mano |
| Índice levantado | Una mariposa se posa en la punta y persigue el dedo |
| Puño | Se desintegran en partículas |
| Volver a abrir | Nace un ciclo nuevo |
| Dos manos juntas | Remolino mágico |

Con las dos manos abiertas y separadas se forman dos grupos independientes, uno por mano.

## Sonido

- El audio arranca con la primera interacción: hacé clic en la página o en el botón de sonido.
- Botón 🔊 en la esquina superior derecha o tecla `M` para silenciar.
- Todo el sonido es sintetizado con Web Audio API; no hay archivos de audio.

## Estructura

```text
index.html          Estructura, HUD y carga de scripts
css/style.css       Layout, HUD futurista y overlays
js/main.js          Cámara, loop de p5, ambiente visual y errores
js/hands.js         HandLandmarker y mapeo espejado a canvas
js/gestures.js      Clasificación de gestos con histéresis
js/butterfly.js     Dibujo procedural sólido, aleteo y física
js/particles.js     Partículas con pooling
js/scene.js         Máquina de estados, dueño por mariposa y orquestación
js/audio.js         Sintetizador Web Audio
server.js           Servidor estático sin dependencias
spec.md             Especificación funcional y técnica
```

## Rendimiento

- Objetivo 60 FPS con una mano, mínimo 30 FPS con dos.
- Límites: 40 mariposas y 600 partículas simultáneas.
- Si el FPS baja de 45, la detección de manos se limita a 30 Hz.

## Problemas frecuentes

- **"Permiso de cámara denegado"**: habilitá la cámara desde el candado de la barra de direcciones y recargá.
- **"La cámara está siendo usada por otra aplicación"**: cerrá Zoom, Teams o cualquier app que tenga la cámara tomada.
- **No hay sonido**: el navegador exige una interacción previa. Hacé clic en la página y verificá que el botón no esté en silencio.
- **No detecta las manos**: mejorá la luz frontal y mantené las manos a 40–80 cm de la cámara.
- **Va lento**: cerrá otras pestañas con video; el modelo corre mejor con aceleración GPU activa.
