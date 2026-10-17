(function () {
  "use strict";

  const PALETTES = [
    { wing: [186, 140, 255], accent: [255, 120, 214] },
    { wing: [255, 120, 214], accent: [96, 224, 255] },
    { wing: [96, 224, 255], accent: [186, 140, 255] },
    { wing: [214, 176, 255], accent: [255, 246, 229] },
    { wing: [255, 96, 190], accent: [186, 140, 255] }
  ];

  // Contornos en unidades de ala (se multiplican por la escala s).
  const FORE = [
    [0, -3],
    [11, -24, 27, -31, 34, -20],
    [32, -10, 27, -2, 22, 2],
    [14, 5, 6, 4, 0, 1]
  ];

  const HIND = [
    [0, 2],
    [18, 3, 30, 17, 19, 30],
    [12, 35, 4, 26, 0, 8]
  ];

  function rand(min, max) {
    return min + Math.random() * (max - min);
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function shade(color, factor) {
    return [
      Math.max(0, Math.min(255, Math.round(color[0] * factor))),
      Math.max(0, Math.min(255, Math.round(color[1] * factor))),
      Math.max(0, Math.min(255, Math.round(color[2] * factor)))
    ];
  }

  function rgba(color, alpha) {
    return "rgba(" + color[0] + "," + color[1] + "," + color[2] + "," + alpha + ")";
  }

  function tracePath(ctx, s, points) {
    ctx.beginPath();
    ctx.moveTo(points[0][0] * s, points[0][1] * s);
    for (let i = 1; i < points.length; i += 1) {
      const seg = points[i];
      ctx.bezierCurveTo(seg[0] * s, seg[1] * s, seg[2] * s, seg[3] * s, seg[4] * s, seg[5] * s);
    }
    ctx.closePath();
  }

  class Butterfly {
    constructor(index) {
      this.index = index;
      this.alive = false;
      this.ownerKey = null;
    }

    spawn(x, y, paletteIndex, ownerKey) {
      this.alive = true;
      this.ownerKey = ownerKey || null;
      this.x = x + rand(-70, 70);
      this.y = y + rand(-70, 70);
      this.vx = rand(-40, 40);
      this.vy = rand(-40, 40);
      this.size = rand(64, 104);
      this.flapPhase = Math.random() * Math.PI * 2;
      this.flapSpeed = rand(4.5, 7.5) * Math.PI * 2;
      this.orbitAngle = Math.random() * Math.PI * 2;
      this.orbitRadius = rand(85, 180);
      this.orbitDir = Math.random() < 0.5 ? -1 : 1;
      this.orbitSpeed = rand(0.45, 0.95);
      this.landed = false;
      this.birth = 0;
      this.tilt = 0;
      this.noiseSeed = Math.random() * 1000;
      this.palette = PALETTES[paletteIndex % PALETTES.length];
    }

    speed() {
      return Math.hypot(this.vx, this.vy);
    }

    update(dt, target, opts) {
      if (!this.alive) return;
      const o = opts || {};

      this.birth = Math.min(1, this.birth + dt * 2.2);
      this.flapPhase += this.flapSpeed * dt;
      this.noiseSeed += dt * 0.8;

      const stiffness = o.landed ? 80 : 30;
      const damping = 0.9;

      const wanderX = (noise(this.noiseSeed, 1) - 0.5) * 140;
      const wanderY = (noise(this.noiseSeed, 7) - 0.5) * 140;

      this.vx += ((target.x - this.x) * stiffness + wanderX) * dt;
      this.vy += ((target.y - this.y) * stiffness + wanderY) * dt;

      const friction = Math.pow(damping, dt * 60);
      this.vx *= friction;
      this.vy *= friction;

      this.x += this.vx * dt;
      this.y += this.vy * dt;

      this.tilt = constrain(this.vx * 0.004, -0.4, 0.4);
      this.landed = !!o.landed;
    }

    drawHalo() {
      const ctx = drawingContext;
      const w = this.palette.wing;
      const flap = 0.26 + 0.74 * Math.abs(Math.sin(this.flapPhase));
      const s = (this.size / 30) * easeOut(this.birth);

      noStroke();
      fill(w[0], w[1], w[2], 26);
      circle(this.x, this.y, this.size * 1.9);
      fill(w[0], w[1], w[2], 15);
      circle(this.x, this.y, this.size * 2.7);

      push();
      translate(this.x, this.y);
      rotate(this.tilt);
      ctx.lineJoin = "round";

      for (const side of [-1, 1]) {
        push();
        scale(side * flap, 1);
        ctx.strokeStyle = rgba(shade(w, 1.25), 0.5);
        ctx.lineWidth = 2.4 * s;
        tracePath(ctx, s * 1.01, HIND);
        ctx.stroke();
        tracePath(ctx, s * 1.01, FORE);
        ctx.stroke();
        pop();
      }

      pop();
    }

    draw() {
      const ctx = drawingContext;
      const flap = 0.26 + 0.74 * Math.abs(Math.sin(this.flapPhase));
      const s = (this.size / 30) * easeOut(this.birth);
      const light = 0.62 + 0.38 * flap;
      const bob = Math.sin(this.flapPhase * 0.5) * 2 * s;

      push();
      translate(this.x, this.y + bob);
      rotate(this.tilt);

      // Sombra proyectada: separa la mariposa del video y da volumen.
      noStroke();
      fill(6, 3, 14, 72);
      ellipse(4 * s, 7 * s, 46 * s, 28 * s);

      for (const side of [-1, 1]) {
        push();
        scale(side * flap, 1);
        // Luz direccional: el ala izquierda recibe más luz que la derecha.
        this.drawWings(ctx, s, light * (side < 0 ? 1.06 : 0.9));
        pop();
      }

      this.drawBody(ctx, s, light);
      pop();
    }

    drawWings(ctx, s, light) {
      const wing = this.palette.wing;
      const accent = this.palette.accent;

      // Ala inferior, detrás.
      this.fillWing(ctx, s, HIND, accent, light * 0.9);
      this.gloss(ctx, s, HIND, 10, 13, 12, 0.55);
      this.spotsHind(ctx, s);

      // Ala superior, delante.
      this.fillWing(ctx, s, FORE, wing, light);
      this.gloss(ctx, s, FORE, 21, -15, 18);
      this.spotsFore(ctx, s);

      // Oclusión en la raíz del ala.
      const root = ctx.createRadialGradient(0, 0, 0, 0, 0, 9 * s);
      root.addColorStop(0, "rgba(22,10,38,0.55)");
      root.addColorStop(1, "rgba(22,10,38,0)");
      ctx.fillStyle = root;
      ctx.beginPath();
      ctx.arc(0, 0, 9 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    fillWing(ctx, s, points, color, light) {
      tracePath(ctx, s, points);

      const gradient = ctx.createLinearGradient(0, -20 * s, 22 * s, 30 * s);
      gradient.addColorStop(0, rgba(shade(color, Math.min(1.45, 1.2 * light + 0.12)), 1));
      gradient.addColorStop(0.45, rgba(shade(color, light), 1));
      gradient.addColorStop(1, rgba(shade(color, 0.5 * light + 0.06), 1));

      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.lineWidth = 1.5 * s;
      ctx.lineJoin = "round";
      ctx.strokeStyle = rgba(shade(color, Math.min(1.5, 1.32 * light)), 0.85);
      ctx.stroke();
    }

    gloss(ctx, s, points, hx, hy, hr, strength) {
      const k = strength === undefined ? 1 : strength;

      ctx.save();
      tracePath(ctx, s, points);
      ctx.clip();

      const gradient = ctx.createRadialGradient(hx * s, hy * s, 0, hx * s, hy * s, hr * s);
      gradient.addColorStop(0, "rgba(255,255,255," + (0.45 * k) + ")");
      gradient.addColorStop(0.45, "rgba(255,255,255," + (0.14 * k) + ")");
      gradient.addColorStop(1, "rgba(255,255,255,0)");

      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(hx * s, hy * s, hr * s, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }

    spotsFore(ctx, s) {
      // Ocelo con anillo y brillo.
      ctx.fillStyle = "rgba(252,244,226,0.96)";
      ctx.beginPath();
      ctx.arc(15 * s, -10 * s, 3.6 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(30,14,46,0.92)";
      ctx.beginPath();
      ctx.arc(15 * s, -10 * s, 1.9 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.beginPath();
      ctx.arc(13.8 * s, -11.2 * s, 0.75 * s, 0, Math.PI * 2);
      ctx.fill();

      // Nervaduras.
      ctx.strokeStyle = "rgba(34,16,52,0.28)";
      ctx.lineWidth = 0.8 * s;
      ctx.beginPath();
      ctx.moveTo(1 * s, -3 * s);
      ctx.bezierCurveTo(10 * s, -19 * s, 21 * s, -15 * s, 27 * s, -5 * s);
      ctx.stroke();
    }

    spotsHind(ctx, s) {
      ctx.fillStyle = "rgba(252,244,226,0.72)";
      ctx.beginPath();
      ctx.arc(11 * s, 18 * s, 1.6 * s, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "rgba(255,255,255,0.5)";
      ctx.beginPath();
      ctx.arc(7 * s, 11 * s, 1 * s, 0, Math.PI * 2);
      ctx.fill();
    }

    drawBody(ctx, s, light) {
      // Abdomen con gradiente longitudinal.
      const abdomen = ctx.createLinearGradient(0, 4 * s, 0, 22 * s);
      abdomen.addColorStop(0, rgba(shade([122, 78, 142], light), 1));
      abdomen.addColorStop(0.55, rgba(shade([70, 38, 88], light), 1));
      abdomen.addColorStop(1, rgba(shade([30, 13, 44], light), 1));

      ctx.fillStyle = abdomen;
      ctx.beginPath();
      ctx.ellipse(0, 12.5 * s, 3.4 * s, 8.8 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(18,7,30,0.32)";
      ctx.lineWidth = 0.8 * s;
      for (let i = 0; i < 3; i += 1) {
        const y = (8.5 + i * 4.2) * s;
        const w = 3.1 * s * (1 - i * 0.18);
        ctx.beginPath();
        ctx.moveTo(-w, y);
        ctx.lineTo(w, y);
        ctx.stroke();
      }

      // Tórax con luz superior izquierda.
      const thorax = ctx.createRadialGradient(-1.4 * s, -1.8 * s, 0.4 * s, 0, 1 * s, 7 * s);
      thorax.addColorStop(0, rgba(shade([156, 108, 176], light), 1));
      thorax.addColorStop(0.6, rgba(shade([74, 42, 94], light), 1));
      thorax.addColorStop(1, rgba(shade([38, 18, 54], light), 1));

      ctx.fillStyle = thorax;
      ctx.beginPath();
      ctx.ellipse(0, 1.5 * s, 4.4 * s, 6.2 * s, 0, 0, Math.PI * 2);
      ctx.fill();

      // Cabeza.
      const head = ctx.createRadialGradient(-1.2 * s, -8 * s, 0.2 * s, 0, -6.5 * s, 4.8 * s);
      head.addColorStop(0, rgba(shade([166, 118, 186], light), 1));
      head.addColorStop(1, rgba(shade([50, 25, 66], light), 1));

      ctx.fillStyle = head;
      ctx.beginPath();
      ctx.arc(0, -6.5 * s, 4.1 * s, 0, Math.PI * 2);
      ctx.fill();

      // Ojos grandes y brillantes (estilo animación).
      for (const side of [-1, 1]) {
        const ex = side * 1.9 * s;
        const ey = -7.2 * s;
        const er = 2.35 * s;

        ctx.fillStyle = "rgba(14,6,24,0.96)";
        ctx.beginPath();
        ctx.arc(ex, ey, er, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(126,86,206,0.55)";
        ctx.beginPath();
        ctx.arc(ex, ey + 0.5 * s, er * 0.6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.95)";
        ctx.beginPath();
        ctx.arc(ex - 0.75 * s, ey - 0.95 * s, 0.8 * s, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "rgba(255,255,255,0.55)";
        ctx.beginPath();
        ctx.arc(ex + 0.7 * s, ey + 0.65 * s, 0.36 * s, 0, Math.PI * 2);
        ctx.fill();
      }

      // Antenas con bulbo.
      ctx.lineCap = "round";
      ctx.strokeStyle = rgba(shade([56, 30, 72], light), 0.95);
      ctx.lineWidth = 1.1 * s;

      for (const side of [-1, 1]) {
        ctx.beginPath();
        ctx.moveTo(side * 0.6 * s, -8 * s);
        ctx.quadraticCurveTo(side * 7 * s, -17 * s, side * 11 * s, -25 * s);
        ctx.stroke();

        ctx.fillStyle = rgba(shade([66, 36, 84], light), 0.95);
        ctx.beginPath();
        ctx.arc(side * 11 * s, -25 * s, 1.25 * s, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  window.Butterfly = Butterfly;
})();
