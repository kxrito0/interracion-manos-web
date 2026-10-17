(function () {
  "use strict";

  const VISION_VERSION = "0.10.14";
  const VISION_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@" + VISION_VERSION;
  const WASM_URL = VISION_URL + "/wasm";
  const MODEL_URL =
    "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

  class HandTracker {
    constructor() {
      this.landmarker = null;
      this.lastVideoTime = -1;
      this.lastResult = null;
      this.lastDetectMs = 0;
      this.minIntervalMs = 0;
    }

    async init() {
      const vision = await import(VISION_URL);
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_URL);

      const options = {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        runningMode: "VIDEO",
        numHands: 2,
        minHandDetectionConfidence: 0.5,
        minHandPresenceConfidence: 0.5,
        minTrackingConfidence: 0.5
      };

      try {
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, options);
      } catch (gpuError) {
        options.baseOptions.delegate = "CPU";
        this.landmarker = await vision.HandLandmarker.createFromOptions(fileset, options);
      }

      return this.landmarker;
    }

    detect(video, now) {
      if (!this.landmarker || !video || video.readyState < 2) return null;

      // Nunca re-detectar el mismo frame de video.
      if (video.currentTime === this.lastVideoTime) return this.lastResult;
      if (now - this.lastDetectMs < this.minIntervalMs) return this.lastResult;

      this.lastDetectMs = now;
      this.lastVideoTime = video.currentTime;

      try {
        this.lastResult = this.landmarker.detectForVideo(video, now);
      } catch (error) {
        this.lastResult = null;
      }

      return this.lastResult;
    }
  }

  // Mapeo tipo object-fit: cover + espejo horizontal.
  function coverMapping(canvasW, canvasH, videoW, videoH) {
    const scale = Math.max(canvasW / videoW, canvasH / videoH);
    const dw = videoW * scale;
    const dh = videoH * scale;
    return {
      dw: dw,
      dh: dh,
      ox: (canvasW - dw) / 2,
      oy: (canvasH - dh) / 2
    };
  }

  window.HandTracker = HandTracker;
  window.coverMapping = coverMapping;
})();
