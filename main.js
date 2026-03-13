document.addEventListener("DOMContentLoaded", () => {
  const amplitudeSlider = document.getElementById("amplitude-slider");
  const amplitudeValue = document.querySelector(".control-value");
  const fileInput = document.getElementById("file-input");
  const directionInput = document.getElementById("direction-input");
  const amplitudeInput = document.getElementById("amplitude-input");
  const canvasOriginal = document.getElementById("canvas-original");
  const canvasProcessed = document.getElementById("canvas-processed");
  const canvasDirectional = document.getElementById("canvas-directional");
  const saccadeCanvas = document.getElementById("saccade-control");
  const metricMeanAlignment = document.getElementById("metric-mean-alignment");
  const metricDirEnergy = document.getElementById("metric-dir-energy");
  const metricNetMod = document.getElementById("metric-net-mod");

  if (!canvasOriginal || !canvasProcessed || !canvasDirectional) {
    return;
  }

  const ctxOriginal = canvasOriginal.getContext("2d");
  const ctxProcessed = canvasProcessed.getContext("2d");
  const ctxDirectional = canvasDirectional.getContext("2d");
  const saccadeCtx = saccadeCanvas ? saccadeCanvas.getContext("2d") : null;
  const workingState = {
    image: null,
    naturalWidth: 0,
    naturalHeight: 0,
  };

  const saccadeState = {
    angle: 0,
    dx: 1,
    dy: 0,
    amplitude: 0.5,
    dragging: false,
  };

  const offscreen = (() => {
    const c = document.createElement("canvas");
    let ctx = null;
    try {
      ctx = c.getContext("2d", { willReadFrequently: true });
    } catch {
      ctx = null;
    }
    if (!ctx) {
      ctx = c.getContext("2d");
    }
    return { canvas: c, ctx };
  })();

  const diagDirectional = (() => {
    const c = document.createElement("canvas");
    const ctx = c.getContext("2d");
    return { canvas: c, ctx };
  })();

  const resizeOriginalCanvas = () => {
    const rect = canvasOriginal.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvasOriginal.width !== width || canvasOriginal.height !== height) {
      canvasOriginal.width = width;
      canvasOriginal.height = height;
    }
  };

  const resizeProcessedCanvas = () => {
    const rect = canvasProcessed.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvasProcessed.width !== width || canvasProcessed.height !== height) {
      canvasProcessed.width = width;
      canvasProcessed.height = height;
    }
  };

  const resizeDirectionalCanvas = () => {
    const rect = canvasDirectional.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (canvasDirectional.width !== width || canvasDirectional.height !== height) {
      canvasDirectional.width = width;
      canvasDirectional.height = height;
    }
  };

  const clearCanvas = () => {
    resizeOriginalCanvas();
    ctxOriginal.save();
    ctxOriginal.setTransform(1, 0, 0, 1, 0, 0);
    ctxOriginal.fillStyle = "#05060b";
    ctxOriginal.fillRect(0, 0, canvasOriginal.width, canvasOriginal.height);
    ctxOriginal.restore();
  };

  const clearProcessed = () => {
    resizeProcessedCanvas();
    ctxProcessed.save();
    ctxProcessed.setTransform(1, 0, 0, 1, 0, 0);
    ctxProcessed.fillStyle = "#05060b";
    ctxProcessed.fillRect(0, 0, canvasProcessed.width, canvasProcessed.height);
    ctxProcessed.restore();
  };

  const clearDirectional = () => {
    resizeDirectionalCanvas();
    ctxDirectional.save();
    ctxDirectional.setTransform(1, 0, 0, 1, 0, 0);
    ctxDirectional.fillStyle = "#05060b";
    ctxDirectional.fillRect(0, 0, canvasDirectional.width, canvasDirectional.height);
    ctxDirectional.restore();
  };

  const clearDifferenceMetrics = () => {
    if (metricMeanAlignment && metricDirEnergy && metricNetMod) {
      metricMeanAlignment.textContent = "–";
      metricDirEnergy.textContent = "–";
      metricNetMod.textContent = "–";
    }
  };

  const drawImageLetterboxed = (ctx, canvasEl, imageOrCanvas, iw, ih) => {
    const cw = canvasEl.width;
    const ch = canvasEl.height;
    if (!cw || !ch || !iw || !ih) return;
    const scale = Math.min(cw / iw, ch / ih);
    const drawWidth = iw * scale;
    const drawHeight = ih * scale;
    const offsetX = (cw - drawWidth) / 2;
    const offsetY = (ch - drawHeight) / 2;
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(imageOrCanvas, 0, 0, iw, ih, offsetX, offsetY, drawWidth, drawHeight);
  };

  const ensureOffscreenFromImage = (maxDim = 720) => {
    if (!workingState.image || !offscreen.ctx) return false;
    const iw = workingState.naturalWidth;
    const ih = workingState.naturalHeight;
    if (!iw || !ih) return false;

    const scale = Math.min(1, maxDim / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    if (offscreen.canvas.width !== w || offscreen.canvas.height !== h) {
      offscreen.canvas.width = w;
      offscreen.canvas.height = h;
    }
    offscreen.ctx.clearRect(0, 0, w, h);
    offscreen.ctx.imageSmoothingEnabled = true;
    offscreen.ctx.imageSmoothingQuality = "high";
    offscreen.ctx.drawImage(workingState.image, 0, 0, iw, ih, 0, 0, w, h);
    return true;
  };

  const clampByte = (v) => (v < 0 ? 0 : v > 255 ? 255 : v);

  const processImageV1 = (srcImageData, angle, amplitude) => {
    const { width: w, height: h, data } = srcImageData;
    const len = w * h;
    const gray = new Float32Array(len);

    for (let i = 0, p = 0; i < len; i++, p += 4) {
      const r = data[p];
      const g = data[p + 1];
      const b = data[p + 2];
      gray[i] = 0.2126 * r + 0.7152 * g + 0.0722 * b;
    }

    const dirCos = Math.cos(angle);
    const dirSin = Math.sin(angle);
    const weight = new Float32Array(len);
    const gradMag = new Float32Array(len);
    const high = new Float32Array(len);

    const lap = (x, y) => {
      const i = y * w + x;
      const c = gray[i];
      const l = gray[i - 1];
      const r = gray[i + 1];
      const u = gray[i - w];
      const d = gray[i + w];
      return (l + r + u + d) - 4 * c;
    };

    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;

        const gx =
          -gray[i - w - 1] +
          gray[i - w + 1] +
          -2 * gray[i - 1] +
          2 * gray[i + 1] +
          -gray[i + w - 1] +
          gray[i + w + 1];
        const gy =
          gray[i - w - 1] +
          2 * gray[i - w] +
          gray[i - w + 1] +
          -gray[i + w - 1] +
          -2 * gray[i + w] +
          -gray[i + w + 1];

        const mag = Math.hypot(gx, gy);
        gradMag[i] = mag;
        if (mag > 1e-3) {
          const nx = gx / mag;
          const ny = gy / mag;
          const align = Math.abs(nx * dirCos + ny * dirSin);
          weight[i] = Math.pow(align, 2.2);
        } else {
          weight[i] = 0;
        }

        high[i] = lap(x, y);
      }
    }

    const out = new ImageData(w, h);
    const strength = 0.15 + 1.05 * amplitude;
    const gamma = 0.8;

    let sumAlign = 0;
    let sumDirEnergy = 0;
    let sumSignedMod = 0;

    for (let i = 0, p = 0; i < len; i++, p += 4) {
      const wgt = Math.pow(weight[i], gamma);
      const k = strength * wgt;
      const hp = high[i];

      sumAlign += weight[i];
      sumDirEnergy += gradMag[i] * weight[i];
      sumSignedMod += hp * weight[i];

      out.data[p] = clampByte(data[p] + k * hp);
      out.data[p + 1] = clampByte(data[p + 1] + k * hp);
      out.data[p + 2] = clampByte(data[p + 2] + k * hp);
      out.data[p + 3] = 255;
    }

    const invLen = len > 0 ? 1 / len : 0;
    return {
      out,
      weight,
      gradMag,
      high,
      width: w,
      height: h,
      metrics: {
        meanAlignment: sumAlign * invLen,
        directionalEnergy: sumDirEnergy * invLen,
        netSignedModulation: sumSignedMod * invLen,
      },
    };
  };

  const recomputeProcessed = () => {
    clearProcessed();
    if (!workingState.image || !offscreen.ctx) return;
    if (!ensureOffscreenFromImage(820) || !offscreen.ctx || !diagDirectional.ctx) return;

    const w = offscreen.canvas.width;
    const h = offscreen.canvas.height;
    if (!w || !h) return;

    let src;
    try {
      src = offscreen.ctx.getImageData(0, 0, w, h);
    } catch (err) {
      resizeProcessedCanvas();
      drawImageLetterboxed(ctxProcessed, canvasProcessed, workingState.image, workingState.naturalWidth, workingState.naturalHeight);
      clearDirectional();
      clearDifferenceMetrics();
      return;
    }

    const { out, weight, gradMag, high, metrics } = processImageV1(
      src,
      saccadeState.angle,
      saccadeState.amplitude
    );
    offscreen.ctx.putImageData(out, 0, 0);

    resizeProcessedCanvas();
    ctxProcessed.save();
    ctxProcessed.setTransform(1, 0, 0, 1, 0, 0);
    ctxProcessed.fillStyle = "#05060b";
    ctxProcessed.fillRect(0, 0, canvasProcessed.width, canvasProcessed.height);
    ctxProcessed.restore();
    drawImageLetterboxed(ctxProcessed, canvasProcessed, offscreen.canvas, w, h);

    // Directional edge/detail map
    diagDirectional.canvas.width = w;
    diagDirectional.canvas.height = h;
    const dirImg = diagDirectional.ctx.createImageData(w, h);
    let maxMag = 0;
    for (let i = 0; i < gradMag.length; i++) {
      if (gradMag[i] > maxMag) maxMag = gradMag[i];
    }
    const invMaxMag = maxMag > 0 ? 1 / maxMag : 0;
    for (let i = 0, p = 0; i < w * h; i++, p += 4) {
      const m = gradMag[i] * invMaxMag;
      const wgt = weight[i];
      const v = Math.pow(m * wgt, 0.6);
      const base = clampByte(v * 255);
      dirImg.data[p] = base;
      dirImg.data[p + 1] = base;
      dirImg.data[p + 2] = clampByte(120 + 100 * v);
      dirImg.data[p + 3] = 255;
    }
    diagDirectional.ctx.putImageData(dirImg, 0, 0);

    resizeDirectionalCanvas();
    ctxDirectional.save();
    ctxDirectional.setTransform(1, 0, 0, 1, 0, 0);
    ctxDirectional.fillStyle = "#05060b";
    ctxDirectional.fillRect(0, 0, canvasDirectional.width, canvasDirectional.height);
    ctxDirectional.restore();
    drawImageLetterboxed(ctxDirectional, canvasDirectional, diagDirectional.canvas, w, h);

    if (metricMeanAlignment && metricDirEnergy && metricNetMod) {
      const ma = metrics.meanAlignment;
      const de = metrics.directionalEnergy;
      const nm = metrics.netSignedModulation;
      metricMeanAlignment.textContent = Number.isFinite(ma) ? ma.toFixed(3) : "–";
      metricDirEnergy.textContent = Number.isFinite(de) ? de.toExponential(2) : "–";
      metricNetMod.textContent = Number.isFinite(nm) ? nm.toExponential(2) : "–";
    }
  };

  const resizeSaccadeCanvas = () => {
    if (!saccadeCanvas || !saccadeCtx) return;
    const rect = saccadeCanvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.floor(rect.width * dpr));
    const height = Math.max(1, Math.floor(rect.height * dpr));
    if (saccadeCanvas.width !== width || saccadeCanvas.height !== height) {
      saccadeCanvas.width = width;
      saccadeCanvas.height = height;
    }
  };

  const drawSaccadeControl = () => {
    if (!saccadeCanvas || !saccadeCtx) return;
    resizeSaccadeCanvas();
    const w = saccadeCanvas.width;
    const h = saccadeCanvas.height;
    saccadeCtx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const margin = Math.min(w, h) * 0.12;
    const halfLen = (Math.min(w, h) / 2) - margin;

    saccadeCtx.save();
    saccadeCtx.translate(cx, cy);

    saccadeCtx.strokeStyle = "rgba(120,130,155,0.6)";
    saccadeCtx.lineWidth = 1;
    saccadeCtx.setLineDash([4, 4]);
    saccadeCtx.beginPath();
    saccadeCtx.moveTo(-halfLen, 0);
    saccadeCtx.lineTo(halfLen, 0);
    saccadeCtx.stroke();

    saccadeCtx.setLineDash([]);
    saccadeCtx.strokeStyle = "rgba(80,90,115,0.9)";
    saccadeCtx.lineWidth = 1;
    saccadeCtx.beginPath();
    saccadeCtx.arc(0, 0, halfLen, 0, Math.PI * 2);
    saccadeCtx.stroke();

    const scaledLen = halfLen * (0.3 + 0.7 * saccadeState.amplitude);
    const tipX = scaledLen * Math.cos(saccadeState.angle);
    const tipY = scaledLen * Math.sin(saccadeState.angle);

    saccadeCtx.strokeStyle = "#8fd6ff";
    saccadeCtx.lineWidth = 2;
    saccadeCtx.beginPath();
    saccadeCtx.moveTo(0, 0);
    saccadeCtx.lineTo(tipX, tipY);
    saccadeCtx.stroke();

    const headLen = 8;
    const headAngle = Math.PI / 7;
    saccadeCtx.beginPath();
    saccadeCtx.moveTo(tipX, tipY);
    saccadeCtx.lineTo(
      tipX - headLen * Math.cos(saccadeState.angle - headAngle),
      tipY - headLen * Math.sin(saccadeState.angle - headAngle)
    );
    saccadeCtx.lineTo(
      tipX - headLen * Math.cos(saccadeState.angle + headAngle),
      tipY - headLen * Math.sin(saccadeState.angle + headAngle)
    );
    saccadeCtx.closePath();
    saccadeCtx.fillStyle = "#8fd6ff";
    saccadeCtx.fill();

    saccadeCtx.restore();
  };

  const updateSaccadeFromPoint = (clientX, clientY) => {
    if (!saccadeCanvas) return;
    const rect = saccadeCanvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    const cx = rect.width / 2;
    const cy = rect.height / 2;
    const dx = x - cx;
    const dy = y - cy;
    if (dx === 0 && dy === 0) return;
    const angle = Math.atan2(dy, dx);
    saccadeState.angle = angle;
    saccadeState.dx = Math.cos(angle);
    saccadeState.dy = Math.sin(angle);
    if (directionInput) {
      const deg = ((angle * 180 / Math.PI) + 360) % 360;
      directionInput.value = String(Math.round(deg * 10) / 10);
    }
    drawSaccadeControl();
    recomputeProcessed();
  };

  const drawCurrentImage = () => {
    clearCanvas();
    if (!workingState.image) return;

    resizeOriginalCanvas();
    const iw = workingState.naturalWidth;
    const ih = workingState.naturalHeight;

    if (!iw || !ih) return;
    drawImageLetterboxed(ctxOriginal, canvasOriginal, workingState.image, iw, ih);
  };

  const loadImageFromSource = (src) => {
    if (!src) return;
    const img = new Image();
    if (src.startsWith("data:") === false) {
      img.crossOrigin = "anonymous";
    }
    img.onload = () => {
      workingState.image = img;
      workingState.naturalWidth = img.naturalWidth || img.width;
      workingState.naturalHeight = img.naturalHeight || img.height;
      drawCurrentImage();
      recomputeProcessed();
    };
    img.onerror = () => {
      workingState.image = null;
      workingState.naturalWidth = 0;
      workingState.naturalHeight = 0;
      clearCanvas();
      clearProcessed();
      clearDirectional();
      clearDifferenceMetrics();
    };
    img.src = src;
  };

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target && e.target.result;
      if (typeof result === "string") {
        loadImageFromSource(result);
      }
    };
    reader.readAsDataURL(file);
  };

  if (saccadeCanvas && saccadeCtx) {
    const pointerDown = (event) => {
      saccadeState.dragging = true;
      const e = event.touches ? event.touches[0] : event;
      updateSaccadeFromPoint(e.clientX, e.clientY);
      event.preventDefault();
    };

    const pointerMove = (event) => {
      if (!saccadeState.dragging) return;
      const e = event.touches ? event.touches[0] : event;
      updateSaccadeFromPoint(e.clientX, e.clientY);
      event.preventDefault();
    };

    const pointerUp = () => {
      saccadeState.dragging = false;
    };

    saccadeCanvas.addEventListener("mousedown", pointerDown);
    window.addEventListener("mousemove", pointerMove);
    window.addEventListener("mouseup", pointerUp);

    saccadeCanvas.addEventListener("touchstart", pointerDown, { passive: false });
    window.addEventListener("touchmove", pointerMove, { passive: false });
    window.addEventListener("touchend", pointerUp);
    window.addEventListener("touchcancel", pointerUp);
  }

  if (fileInput) {
    fileInput.addEventListener("change", () => {
      const [file] = fileInput.files || [];
      if (file) {
        handleFile(file);
      }
    });
  }

  if (amplitudeSlider && amplitudeValue) {
    amplitudeSlider.disabled = false;
    const updateFromSlider = () => {
      const raw = Number.parseFloat(amplitudeSlider.value || "0");
      const clamped = Number.isFinite(raw) ? Math.max(0, Math.min(1, raw)) : 0;
      saccadeState.amplitude = clamped;
      amplitudeValue.textContent = clamped.toFixed(2);
      if (amplitudeInput) amplitudeInput.value = String(clamped);
      drawSaccadeControl();
      recomputeProcessed();
    };

    amplitudeSlider.addEventListener("input", updateFromSlider);
    updateFromSlider();
  }

  if (directionInput) {
    directionInput.addEventListener("change", () => {
      const raw = Number.parseFloat(directionInput.value);
      if (!Number.isFinite(raw)) return;
      const deg = ((raw % 360) + 360) % 360;
      const angle = (deg * Math.PI) / 180;
      saccadeState.angle = angle;
      saccadeState.dx = Math.cos(angle);
      saccadeState.dy = Math.sin(angle);
      directionInput.value = String(Math.round(deg * 10) / 10);
      drawSaccadeControl();
      recomputeProcessed();
    });
  }

  if (amplitudeInput) {
    amplitudeInput.addEventListener("change", () => {
      const raw = Number.parseFloat(amplitudeInput.value);
      if (!Number.isFinite(raw)) return;
      const clamped = Math.max(0, Math.min(1, raw));
      saccadeState.amplitude = clamped;
      amplitudeSlider.value = String(clamped);
      amplitudeValue.textContent = clamped.toFixed(2);
      amplitudeInput.value = String(clamped);
      drawSaccadeControl();
      recomputeProcessed();
    });
  }

  clearCanvas();
  clearProcessed();
  clearDirectional();
  clearDifferenceMetrics();
  drawSaccadeControl();
  window.addEventListener("resize", () => {
    if (!workingState.image) {
      clearCanvas();
      clearProcessed();
      clearDirectional();
      clearDifferenceMetrics();
    } else {
      drawCurrentImage();
      recomputeProcessed();
    }
    drawSaccadeControl();
  });
});

