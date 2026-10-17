(function () {
  "use strict";

  const MAX_BUTTERFLIES = 40;
  const HAND_LOST_MS = 2000;
  const WHIRLPOOL_WIDTH_RATIO = 0.18;

  class Scene {
    constructor() {
      this.butterflies = [];
      for (let i = 0; i < MAX_BUTTERFLIES; i += 1) {
        this.butterflies.push(new Butterfly(i));
      }

      this.particles = new ParticleSystem();
      this.state = "IDLE";
      this.spawnCount = 0;
      this.lastHandTime = 0;
      this.followers = new Map();
      this.time = 0;
      this.sparkleBudget = 0;
      this.audio = null;
    }

    aliveCount() {
      let count = 0;
      for (let i = 0; i < this.butterflies.length; i += 1) {
        if (this.butterflies[i].alive) count += 1;
      }
      return count;
    }

    nearestAlive(point, ownerKey) {
      let best = null;
      let bestScore = Infinity;

      for (let i = 0; i < this.butterflies.length; i += 1) {
        const b = this.butterflies[i];
        if (!b.alive) continue;

        let score = Math.hypot(b.x - point.x, b.y - point.y);
        if (ownerKey && b.ownerKey !== ownerKey) score += 500;

        if (score < bestScore) {
          bestScore = score;
          best = b;
        }
      }

      return best;
    }

    spawnBurst(palm, ownerKey) {
      const room = MAX_BUTTERFLIES - this.aliveCount();
      const count = Math.min(5, room);
      let created = 0;

      for (let i = 0; i < this.butterflies.length && created < count; i += 1) {
        const b = this.butterflies[i];
        if (!b.alive) {
          b.spawn(palm.x, palm.y, this.spawnCount + created, ownerKey);
          created += 1;
        }
      }

      this.spawnCount += created;

      this.particles.burst(palm.x, palm.y, 26, {
        speed: 70,
        life: 780,
        size: 2.8,
        color: [255, 246, 229]
      });

      if (created > 0 && this.audio) this.audio.birth();

      return created;
    }

    dissolveAll() {
      let dissolved = 0;

      for (let i = 0; i < this.butterflies.length; i += 1) {
        const b = this.butterflies[i];
        if (!b.alive) continue;

        this.particles.burst(b.x, b.y, 8, {
          speed: 40,
          life: 1150,
          size: 2.6,
          color: b.palette.wing,
          drag: 1.4,
          gravity: -4
        });

        b.alive = false;
        b.ownerKey = null;
        dissolved += 1;
      }

      if (dissolved > 0 && this.audio) this.audio.dissolve();
    }

    isWhirlpool(hands, canvasWidth) {
      if (hands.length < 2) return false;

      for (let i = 0; i < hands.length; i += 1) {
        for (let j = i + 1; j < hands.length; j += 1) {
          const dx = hands[i].wrist.x - hands[j].wrist.x;
          const dy = hands[i].wrist.y - hands[j].wrist.y;
          if (Math.hypot(dx, dy) < canvasWidth * WHIRLPOOL_WIDTH_RATIO) return true;
        }
      }

      return false;
    }

    update(dt, hands, env) {
      this.time += dt;
      this.particles.update(dt);

      const now = env.now;

      if (hands.length === 0) {
        if (!this.lastHandTime) this.lastHandTime = now;
      } else {
        this.lastHandTime = 0;
      }

      // Cada mano abierta genera su propio grupo, con dueño propio.
      for (let i = 0; i < hands.length; i += 1) {
        const hand = hands[i];
        if (hand.justEntered && hand.gesture === "open") {
          this.spawnBurst(hand.palm, hand.key);
        }
      }

      const whirlpool = this.isWhirlpool(hands, env.width);
      const openHand = hands.find(function (h) { return h.gesture === "open"; });
      const indexHands = hands.filter(function (h) { return h.gesture === "index"; });
      const fistHand = hands.find(function (h) { return h.gesture === "fist"; });

      this.updateFollowers(indexHands);

      if (whirlpool) {
        if (this.state !== "WHIRLPOOL" && this.audio) this.audio.whirl();
        this.state = "WHIRLPOOL";
      } else if (indexHands.length > 0) {
        this.state = "LANDING";
      } else if (fistHand) {
        this.state = "DISSOLVING";
      } else if (openHand) {
        this.state = "FLYING";
      } else if (this.lastHandTime && now - this.lastHandTime > HAND_LOST_MS) {
        this.state = "IDLE";
      }

      if (this.state === "DISSOLVING") {
        this.dissolveAll();
        return;
      }

      this.move(dt, {
        whirlpool: whirlpool,
        hands: hands,
        env: env
      });
    }

    updateFollowers(indexHands) {
      const active = new Set();

      for (let i = 0; i < indexHands.length; i += 1) {
        const hand = indexHands[i];
        active.add(hand.key);

        const current = this.followers.get(hand.key);
        if (current && current.alive) continue;

        const chosen = this.nearestAlive(hand.indexTip, hand.key);
        if (chosen) {
          this.followers.set(hand.key, chosen);
          if (this.audio) this.audio.land();
        }
      }

      for (const key of this.followers.keys()) {
        if (!active.has(key)) this.followers.delete(key);
      }
    }

    move(dt, ctx) {
      const env = ctx.env || { width: 1200, height: 800 };
      const byKey = new Map();

      for (let i = 0; i < ctx.hands.length; i += 1) {
        byKey.set(ctx.hands[i].key, ctx.hands[i]);
      }

      let center = null;
      if (ctx.whirlpool && ctx.hands.length >= 2) {
        center = {
          x: (ctx.hands[0].wrist.x + ctx.hands[1].wrist.x) / 2,
          y: (ctx.hands[0].wrist.y + ctx.hands[1].wrist.y) / 2
        };
      }

      const t = this.time;

      for (let i = 0; i < this.butterflies.length; i += 1) {
        const b = this.butterflies[i];
        if (!b.alive) continue;

        const owner = b.ownerKey ? byKey.get(b.ownerKey) : null;
        let target;
        let landed = false;

        if (center) {
          b.orbitAngle += dt * b.orbitSpeed * 2.6;
          const radius = 155 + Math.sin(t * 1.6 + b.index) * 45;
          target = {
            x: center.x + Math.cos(b.orbitAngle) * radius,
            y: center.y + Math.sin(b.orbitAngle) * radius * 0.8
          };
        } else if (owner && owner.gesture === "index" && this.followers.get(owner.key) === b) {
          target = {
            x: owner.indexTip.x,
            y: owner.indexTip.y - b.size * 0.35
          };
          landed = true;
        } else if (owner && owner.gesture === "open") {
          b.orbitAngle += dt * b.orbitSpeed * b.orbitDir;
          const radius = b.orbitRadius * (0.85 + 0.15 * Math.sin(t * 0.9 + b.index));
          target = {
            x: owner.palm.x + Math.cos(b.orbitAngle) * radius,
            y: owner.palm.y + Math.sin(b.orbitAngle) * radius * 0.68
          };
        } else {
          // Sin mano activa: deriva amplia y acotada alrededor del centro.
          b.orbitAngle += dt * 0.35;
          const spreadX = env.width * 0.16;
          const spreadY = env.height * 0.16;
          target = {
            x: env.width * 0.5 + Math.cos(b.orbitAngle + b.index) * spreadX,
            y: env.height * 0.5 + Math.sin(b.orbitAngle + b.index) * spreadY
          };
        }

        b.update(dt, target, { landed: landed });
        if (landed) this.emitSparkles(dt, b);
      }
    }

    emitSparkles(dt, butterfly) {
      const speed = butterfly.speed();
      if (speed < 55) return;

      this.sparkleBudget += dt * Math.min(28, speed * 0.07);

      while (this.sparkleBudget >= 1) {
        this.sparkleBudget -= 1;

        const color = Math.random() < 0.55 ? butterfly.palette.wing : butterfly.palette.accent;

        this.particles.burst(
          butterfly.x + (Math.random() - 0.5) * butterfly.size * 0.7,
          butterfly.y + (Math.random() - 0.5) * butterfly.size * 0.5,
          1,
          {
            speed: 10 + Math.random() * 34,
            life: 640,
            size: 1.7,
            color: color,
            drag: 2.8,
            gravity: -12
          }
        );
      }
    }

    draw() {
      push();
      blendMode(ADD);
      for (let i = 0; i < this.butterflies.length; i += 1) {
        if (this.butterflies[i].alive) this.butterflies[i].drawHalo();
      }
      pop();

      for (let i = 0; i < this.butterflies.length; i += 1) {
        if (this.butterflies[i].alive) this.butterflies[i].draw();
      }

      this.particles.draw();
    }
  }

  window.Scene = Scene;
})();
