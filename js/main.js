(function () {
  "use strict";

  const VIDEO_W = 640;
  const VIDEO_H = 480;

  const STATE_LABELS = {
    IDLE: "EN ESPERA",
    FLYING: "VUELO",
    LANDING: "POSADA",
    DISSOLVING: "DISOLUCIÓN",
    WHIRLPOOL: "REMOLINO"
  };

  const audio = new AudioEngine();

  let tracker = null;
  let gestureTracker = null;
  let scene = null;
  let videoEl = null;
  let mapping = null;
  let ready = false;
  let initializing = false;
  let lastFrameTs = 0;
  let lastTelemetry = 0;
  let lastAudioCheck = 0;
  let fpsSmoothed = 60;

  function byId(id) {
    return document.getElementById(id);
  }

  function setText(id, text) {
    const node = byId(id);
    if (node && node.textContent !== text) node.textContent = text;
  }

  function setHud(message, options) {
    const opts = options || {};
    const hud = byId("hud");
    const status = byId("hud-status");
    const retry = byId("retry");
    if (!hud || !status || !retry) return;

    if (opts.hide) {
      hud.classList.add("hidden");
      return;
    }

    hud.classList.remove("hidden");
    status.textContent = message;
    status.classList.toggle("error", !!opts.error);
    retry.classList.toggle("hidden", !opts.retry);
  }

  function cameraErrorMessage(error) {
    const name = error && error.name ? error.name : "";

    if (name === "NotAllowedError" || name === "SecurityError") {
      return "Permiso de cámara denegado. Habilitá el acceso a la cámara para este sitio y volvé a intentar.";
    }
    if (name === "NotFoundError" || name === "OverconstrainedError") {
      return "No encontramos una cámara conectada. Conectá una y volvé a intentar.";
    }
    if (name === "NotReadableError") {
      return "La cámara está siendo usada por otra aplicación. Cerrala y volvé a intentar.";
    }

    const detail = error && error.message ? error.message : "error desconocido";
    return "No pudimos iniciar la experiencia: " + detail + ".";
  }

  async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: VIDEO_W },
        height: { ideal: VIDEO_H },
        facingMode: "user"
      },
      audio: false
    });

    const video = document.createElement("video");
    video.srcObject = stream;
    video.muted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.style.cssText =
      "position:fixed;top:0;left:0;width:2px;height:2px;opacity:0;pointer-events:none;";
    document.body.appendChild(video);

    try {
      await video.play();
    } catch (playError) {
      // El autoplay puede bloquearse; el reintento por clic lo resuelve.
      console.warn("No se pudo iniciar la reproducción automática.", playError);
    }

    if (video.readyState < 2) {
      await new Promise(function (resolve) {
        const done = function () {
          resolve();
        };
        video.addEventListener("loadeddata", done, { once: true });
        setTimeout(done, 4000);
      });
    }

    if (video.readyState < 2 || !video.videoWidth) {
      throw new Error("La cámara no entregó imagen. Revisá que no esté en uso por otra aplicación.");
    }

    videoEl = video;
  }

  async function init() {
    if (initializing) return;
    initializing = true;

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setHud("Este navegador no permite acceder a la cámara. Probá con Chrome o Edge actualizados.", {
        error: true
      });
      initializing = false;
      return;
    }

    try {
      setHud("Activando cámara…");
      if (!videoEl) await startCamera();

      setHud("Cargando modelo de manos…");
      if (!tracker) {
        tracker = new HandTracker();
        await tracker.init();
      }

      gestureTracker = new GestureTracker();
      mapping = coverMapping(width, height, videoEl.videoWidth || VIDEO_W, videoEl.videoHeight || VIDEO_H);
      ready = true;
      setHud("", { hide: true });

      setTimeout(function () {
        const guide = byId("guide");
        if (guide) guide.classList.add("faded");
      }, 9000);
    } catch (error) {
      console.error(error);
      ready = false;
      setHud(cameraErrorMessage(error), { error: true, retry: true });
    } finally {
      initializing = false;
    }
  }

  function drawVideoFrame() {
    if (!videoEl || videoEl.readyState < 2) return;

    const vw = videoEl.videoWidth || VIDEO_W;
    const vh = videoEl.videoHeight || VIDEO_H;
    mapping = coverMapping(width, height, vw, vh);

    const ctx = drawingContext;
    ctx.save();
    ctx.translate(width, 0);
    ctx.scale(-1, 1);
    ctx.globalAlpha = 0.82;
    ctx.drawImage(videoEl, mapping.ox, mapping.oy, mapping.dw, mapping.dh);
    ctx.restore();
  }

  function drawBlob(x, y, radius, color, alpha) {
    const ctx = drawingContext;
    const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius);
    gradient.addColorStop(0, "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + alpha + ")");
    gradient.addColorStop(1, "rgba(" + color[0] + "," + color[1] + "," + color[2] + ",0)");

    ctx.save();
    ctx.globalCompositeOperation = "lighter";
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function drawEnvironment() {
    const ctx = drawingContext;
    const seconds = millis() * 0.001;

    // Rejilla holográfica en movimiento.
    push();
    stroke(96, 224, 255, 16);
    strokeWeight(1);
    const step = 96;
    const offset = (millis() * 0.012) % step;
    for (let x = -offset; x < width + step; x += step) line(x, 0, x, height);
    for (let y = -offset; y < height + step; y += step) line(0, y, width, y);
    pop();

    drawBlob(
      width * (0.28 + Math.sin(seconds * 0.35) * 0.06),
      height * 0.34,
      480,
      [186, 140, 255],
      0.1
    );
    drawBlob(
      width * (0.72 + Math.cos(seconds * 0.45) * 0.06),
      height * 0.64,
      560,
      [96, 224, 255],
      0.08
    );

    // Viñeta para que las mariposas despeguen del video.
    const vignette = ctx.createRadialGradient(
      width / 2,
      height / 2,
      Math.min(width, height) * 0.22,
      width / 2,
      height / 2,
      Math.max(width, height) * 0.78
    );
    vignette.addColorStop(0, "rgba(11,7,20,0)");
    vignette.addColorStop(1, "rgba(11,7,20,0.82)");

    ctx.save();
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  function updateTelemetry(hands) {
    setText("telemetry-hands", "MANOS " + hands.length);
    setText("telemetry-fps", Math.round(fpsSmoothed) + " FPS");
    setText("telemetry-state", STATE_LABELS[scene.state] || "EN ESPERA");
  }

  function syncSoundHint() {
    const hint = byId("sound-hint");
    const mute = byId("mute");
    if (mute) {
      mute.textContent = audio.muted ? "🔇" : "🔊";
      mute.classList.toggle("muted", audio.muted);
    }
    if (!hint) return;
    hint.classList.toggle("hidden", audio.ready());
  }

  function unlockAudio() {
    audio.unlock();
    syncSoundHint();
  }

  window.setup = function () {
    const canvas = createCanvas(windowWidth, windowHeight);
    canvas.parent(document.getElementById("stage"));
    pixelDensity(Math.min(window.devicePixelRatio || 1, 2));
    scene = new Scene();
    scene.audio = audio;
    mapping = coverMapping(width, height, VIDEO_W, VIDEO_H);
    init();
  };

  window.draw = function () {
    const now = performance.now();
    let dt = (now - lastFrameTs) / 1000;
    if (!lastFrameTs || !isFinite(dt) || dt <= 0) dt = 1 / 60;
    dt = Math.min(dt, 0.05);
    lastFrameTs = now;

    fpsSmoothed = fpsSmoothed * 0.95 + (1 / dt) * 0.05;
    if (tracker) tracker.minIntervalMs = fpsSmoothed < 45 ? 33 : 0;

    background(11, 7, 20);
    drawVideoFrame();
    drawEnvironment();

    let hands = [];

    if (ready && videoEl && tracker && gestureTracker) {
      const result = tracker.detect(videoEl, now);
      hands = gestureTracker.update(result, mapping, now);
    }

    scene.update(dt, hands, { now: now, width: width, height: height });
    scene.draw();

    if (now - lastTelemetry > 200) {
      lastTelemetry = now;
      updateTelemetry(hands);
    }

    if (now - lastAudioCheck > 500) {
      lastAudioCheck = now;
      syncSoundHint();
    }
  };

  window.windowResized = function () {
    resizeCanvas(windowWidth, windowHeight);
    if (videoEl) {
      mapping = coverMapping(width, height, videoEl.videoWidth || VIDEO_W, videoEl.videoHeight || VIDEO_H);
    }
  };

  window.addEventListener("pointerdown", unlockAudio);
  window.addEventListener("keydown", function (event) {
    unlockAudio();
    if (event.key === "m" || event.key === "M") {
      audio.toggleMute();
      syncSoundHint();
    }
  });

  const retryButton = byId("retry");
  if (retryButton) {
    retryButton.addEventListener("click", function () {
      init();
    });
  }

  const muteButton = byId("mute");
  if (muteButton) {
    muteButton.addEventListener("click", function (event) {
      event.stopPropagation();
      audio.unlock();
      audio.toggleMute();
      syncSoundHint();
    });
  }
})();
