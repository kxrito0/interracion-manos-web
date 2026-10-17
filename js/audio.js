(function () {
  "use strict";

  // Sintetizador sin archivos: ambiente, nacimiento, disolución, remolino y posado.
  class AudioEngine {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.ambient = null;
      this.noise = null;
      this.muted = false;
      this.started = false;
    }

    ready() {
      return !!this.ctx && this.ctx.state === "running";
    }

    unlock() {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;

      if (!this.ctx) {
        this.ctx = new Ctx();
        this.master = this.ctx.createGain();
        this.master.gain.value = this.muted ? 0 : 0.24;
        this.master.connect(this.ctx.destination);
        this.startAmbient();
        this.started = true;
      }

      if (this.ctx.state === "suspended") {
        this.ctx.resume();
      }

      return true;
    }

    setMuted(muted) {
      this.muted = muted;
      if (this.master) {
        this.master.gain.setTargetAtTime(muted ? 0 : 0.24, this.ctx.currentTime, 0.05);
      }
      return this.muted;
    }

    toggleMute() {
      return this.setMuted(!this.muted);
    }

    startAmbient() {
      const ctx = this.ctx;
      const now = ctx.currentTime;

      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 680;
      filter.Q.value = 0.8;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(0.09, now + 6);

      const freqs = [110, 164.81, 220, 329.63];

      for (let i = 0; i < freqs.length; i += 1) {
        const osc = ctx.createOscillator();
        osc.type = i % 2 === 0 ? "sine" : "triangle";
        osc.frequency.value = freqs[i];
        osc.detune.value = (i - 1.5) * 7;

        const partial = ctx.createGain();
        partial.gain.value = 0.3 / (i + 1);

        const lfo = ctx.createOscillator();
        lfo.frequency.value = 0.04 + i * 0.016;
        const lfoDepth = ctx.createGain();
        lfoDepth.gain.value = 0.09 / (i + 1);
        lfo.connect(lfoDepth);
        lfoDepth.connect(partial.gain);
        lfo.start(now);

        osc.connect(partial);
        partial.connect(filter);
        osc.start(now);
      }

      filter.connect(gain);
      gain.connect(this.master);
      this.ambient = { gain: gain, filter: filter };
    }

    noiseBuffer() {
      if (this.noise) return this.noise;

      const ctx = this.ctx;
      const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < data.length; i += 1) {
        data[i] = Math.random() * 2 - 1;
      }
      this.noise = buffer;
      return buffer;
    }

    pluck(freq, peak, delay, duration, type) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime + delay;

      const osc = ctx.createOscillator();
      osc.type = type || "sine";
      osc.frequency.setValueAtTime(freq, t0);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      osc.connect(gain);
      gain.connect(this.master);
      osc.start(t0);
      osc.stop(t0 + duration + 0.05);
    }

    sweep(from, to, duration, peak) {
      if (!this.ctx || this.muted) return;
      const ctx = this.ctx;
      const t0 = ctx.currentTime;

      const src = ctx.createBufferSource();
      src.buffer = this.noiseBuffer();
      src.loop = true;

      const filter = ctx.createBiquadFilter();
      filter.type = "bandpass";
      filter.Q.value = 1.4;
      filter.frequency.setValueAtTime(from, t0);
      filter.frequency.exponentialRampToValueAtTime(Math.max(40, to), t0 + duration);

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, t0);
      gain.gain.linearRampToValueAtTime(peak, t0 + 0.06);
      gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);

      src.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      src.start(t0);
      src.stop(t0 + duration + 0.1);
    }

    birth() {
      if (!this.ctx || this.muted) return;
      const notes = [523.25, 659.25, 783.99, 1046.5];
      for (let i = 0; i < notes.length; i += 1) {
        this.pluck(notes[i] * (0.99 + Math.random() * 0.02), 0.075, i * 0.055, 1.1);
      }
      this.sweep(1200, 3200, 0.5, 0.03);
    }

    dissolve() {
      if (!this.ctx || this.muted) return;
      this.sweep(2400, 220, 1.1, 0.09);
      this.pluck(196, 0.05, 0.05, 1.3);
      this.pluck(146.83, 0.04, 0.22, 1.6);
    }

    whirl() {
      if (!this.ctx || this.muted) return;
      this.sweep(200, 1600, 1.4, 0.07);
      this.pluck(392, 0.05, 0.05, 1.6, "triangle");
      this.pluck(587.33, 0.04, 0.18, 1.4, "triangle");
    }

    land() {
      if (!this.ctx || this.muted) return;
      this.pluck(1318.51, 0.045, 0, 0.5);
      this.pluck(1760, 0.025, 0.06, 0.4);
    }
  }

  window.AudioEngine = AudioEngine;
})();
