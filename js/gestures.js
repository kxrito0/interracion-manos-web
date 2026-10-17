(function () {
  "use strict";

  const CONFIRM_MS = 120;
  const RELEASE_MS = 150;
  const FORGET_HAND_MS = 1500;

  const TIPS = { index: 8, middle: 12, ring: 16, pinky: 20 };
  const PIPS = { index: 6, middle: 10, ring: 14, pinky: 18 };

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  // Un dedo está extendido cuando su punta se aleja más de la muñeca que su
  // articulación PIP. Funciona con la mano rotada, a diferencia de comparar Y.
  function isExtended(landmarks, tip, pip) {
    const wrist = landmarks[0];
    return distance(landmarks[tip], wrist) > distance(landmarks[pip], wrist) * 1.02;
  }

  function fingerFlags(landmarks) {
    const index = isExtended(landmarks, TIPS.index, PIPS.index);
    const middle = isExtended(landmarks, TIPS.middle, PIPS.middle);
    const ring = isExtended(landmarks, TIPS.ring, PIPS.ring);
    const pinky = isExtended(landmarks, TIPS.pinky, PIPS.pinky);

    return {
      index: index,
      middle: middle,
      ring: ring,
      pinky: pinky,
      count: [index, middle, ring, pinky].filter(Boolean).length
    };
  }

  function classify(landmarks) {
    const flags = fingerFlags(landmarks);

    // Tolerancia de un dedo para gestos naturales: el meñique suele quedar
    // semi-flexionado cuando la mano está abierta.
    if (flags.count >= 3 && flags.middle) return "open";
    if (flags.count === 0) return "fist";

    // El índice alcanza para reclamar el gesto aunque otro dedo acompañe:
    // así la mariposa sigue el dedo de forma confiable.
    if (flags.index) return "index";

    return "none";
  }

  function palmCenter(landmarks) {
    const ids = [0, 5, 9, 13, 17];
    let x = 0;
    let y = 0;
    for (let i = 0; i < ids.length; i += 1) {
      x += landmarks[ids[i]].x;
      y += landmarks[ids[i]].y;
    }
    return { x: x / ids.length, y: y / ids.length };
  }

  class HandState {
    constructor() {
      this.gesture = "none";
      this.pending = "none";
      this.pendingSince = 0;
      this.lastSeen = 0;
    }

    update(rawGesture, now) {
      this.lastSeen = now;

      if (rawGesture === this.gesture) {
        this.pending = rawGesture;
        this.pendingSince = now;
        return false;
      }

      if (rawGesture !== this.pending) {
        this.pending = rawGesture;
        this.pendingSince = now;
      }

      // Entrar a un gesto cuesta 120 ms; abandonarlo, 150 ms.
      const threshold = this.gesture === "none" ? CONFIRM_MS : RELEASE_MS;
      if (now - this.pendingSince >= threshold) {
        this.gesture = rawGesture;
        return true;
      }

      return false;
    }
  }

  class GestureTracker {
    constructor() {
      this.states = new Map();
    }

    update(result, mapping, now) {
      const hands = [];
      if (!result || !result.landmarks || result.landmarks.length === 0) {
        this.prune(now);
        return hands;
      }

      const seen = new Set();

      for (let i = 0; i < result.landmarks.length; i += 1) {
        const raw = result.landmarks[i];
        if (!raw || raw.length < 21) continue;

        let key = "hand-" + i;
        const handedness = result.handedness && result.handedness[i];
        if (handedness && handedness[0] && handedness[0].categoryName) {
          key = handedness[0].categoryName;
          if (seen.has(key)) key = key + "-" + i;
        }
        seen.add(key);

        const mapped = raw.map(function (p) {
          return {
            x: mapping.ox + (1 - p.x) * mapping.dw,
            y: mapping.oy + p.y * mapping.dh
          };
        });

        let state = this.states.get(key);
        if (!state) {
          state = new HandState();
          this.states.set(key, state);
        }

        const justEntered = state.update(classify(mapped), now);
        const flags = fingerFlags(mapped);

        hands.push({
          key: key,
          gesture: state.gesture,
          justEntered: justEntered,
          indexUp: flags.index,
          landmarks: mapped,
          palm: palmCenter(mapped),
          wrist: mapped[0],
          indexTip: mapped[8]
        });
      }

      this.prune(now);
      return hands;
    }

    prune(now) {
      for (const entry of this.states.entries()) {
        if (now - entry[1].lastSeen > FORGET_HAND_MS) {
          this.states.delete(entry[0]);
        }
      }
    }
  }

  window.GestureTracker = GestureTracker;
  window.classifyGesture = classify;
})();
