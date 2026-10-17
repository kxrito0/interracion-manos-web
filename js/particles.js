(function () {
  "use strict";

  const MAX_PARTICLES = 600;

  class Particle {
    constructor() {
      this.alive = false;
    }

    spawn(x, y, opts) {
      const o = opts || {};
      const angle = o.angle !== undefined ? o.angle : Math.random() * Math.PI * 2;
      const speed = o.speed !== undefined ? o.speed : 20 + Math.random() * 120;
      const color = o.color || [255, 246, 229];

      this.alive = true;
      this.x = x;
      this.y = y;
      this.vx = Math.cos(angle) * speed;
      this.vy = Math.sin(angle) * speed;
      this.maxLife = (o.life || 900) * (0.6 + Math.random() * 0.8);
      this.life = this.maxLife;
      this.size = (o.size || 3) * (0.5 + Math.random());
      this.r = color[0];
      this.g = color[1];
      this.b = color[2];
      this.drag = o.drag !== undefined ? o.drag : 2.2;
      this.gravity = o.gravity !== undefined ? o.gravity : -6;
    }

    update(dt) {
      if (!this.alive) return;

      this.life -= dt * 1000;
      if (this.life <= 0) {
        this.alive = false;
        return;
      }

      const damping = Math.max(0, 1 - this.drag * dt);
      this.vx *= damping;
      this.vy *= damping;
      this.vy += this.gravity * dt;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
    }

    draw() {
      const t = this.life / this.maxLife;
      noStroke();
      fill(this.r, this.g, this.b, 255 * Math.pow(t, 0.8));
      circle(this.x, this.y, this.size * (0.4 + t));
    }
  }

  class ParticleSystem {
    constructor() {
      this.pool = [];
      for (let i = 0; i < MAX_PARTICLES; i += 1) {
        this.pool.push(new Particle());
      }
    }

    burst(x, y, count, opts) {
      let spawned = 0;
      for (let i = 0; i < this.pool.length && spawned < count; i += 1) {
        const p = this.pool[i];
        if (!p.alive) {
          p.spawn(x, y, opts);
          spawned += 1;
        }
      }
      return spawned;
    }

    update(dt) {
      for (let i = 0; i < this.pool.length; i += 1) {
        this.pool[i].update(dt);
      }
    }

    draw() {
      push();
      blendMode(ADD);
      for (let i = 0; i < this.pool.length; i += 1) {
        if (this.pool[i].alive) this.pool[i].draw();
      }
      pop();
    }
  }

  window.ParticleSystem = ParticleSystem;
})();
