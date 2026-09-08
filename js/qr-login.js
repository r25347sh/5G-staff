/**
 * G⁵ Portal - QR ログイン（高精度版）
 * 優先: BarcodeDetector（Chrome/Android ネイティブ）
 * フォールバック: jsQR（inversionAttempts: attemptBoth + 中央クロップ）
 * QR形式: {id,pass}
 */
(function () {
  "use strict";

  var stream = null;
  var rafId = null;
  var active = false;
  var jsQRReady = null;
  var facingMode = "environment";
  var videoDevices = [];
  var currentDeviceId = null;
  var lastDetectTs = 0;
  var frameSkip = 0;
  var detector = null;
  var useNative = false;
  var detectBusy = false;
  var lastRaw = "";

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (jsQRReady) return jsQRReady;
    jsQRReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      s.async = true;
      s.onload = function () {
        resolve();
      };
      s.onerror = function () {
        reject(new Error("jsQR load failed"));
      };
      document.head.appendChild(s);
    });
    return jsQRReady;
  }

  function initNativeDetector() {
    try {
      if (typeof window.BarcodeDetector === "undefined") return false;
      detector = new window.BarcodeDetector({ formats: ["qr_code"] });
      useNative = true;
      return true;
    } catch (e) {
      useNative = false;
      detector = null;
      return false;
    }
  }

  async function listVideoDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) return [];
      var devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(function (d) {
        return d.kind === "videoinput";
      });
      return videoDevices;
    } catch (e) {
      return [];
    }
  }

  function stopTracksOnly() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) {
        try {
          t.stop();
        } catch (e) {}
      });
      stream = null;
    }
    var video = document.getElementById("qr-video");
    if (video) video.srcObject = null;
  }

  function stopScan() {
    stopTracksOnly();
  }

  function hideScanBox() {
    stopScan();
    var box = document.getElementById("qr-scan-box");
    if (box) box.hidden = true;
  }

  function setMsg(text, isErr) {
    var el = document.getElementById("qr-scan-msg");
    if (!el) return;
    el.textContent = text || "";
    el.classList.toggle("error", !!isErr);
  }

  async function onDetected(text) {
    text = String(text || "").trim();
    if (!text) return;
    /* 同一内容の連打防止 */
    if (text === lastRaw && Date.now() - lastDetectTs < 2500) return;
    lastRaw = text;
    lastDetectTs = Date.now();

    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    setMsg("読み取りました。ログイン中…");
    try {
      var u = await G5.loginWithQrText(text);
      stopTracksOnly();
      setMsg("ログイン成功: " + (u.name || u.id));
      if (typeof window.__g5_onLoginSuccess === "function") {
        window.__g5_onLoginSuccess(u);
      } else {
        location.href = "index.html";
      }
    } catch (e) {
      setMsg(e.message || String(e), true);
      /* 失敗時はカメラ維持のまま再スキャン */
      active = true;
      lastRaw = "";
      rafId = requestAnimationFrame(tick);
    }
  }

  /**
   * 中央を優先しつつ全体も見るために、複数スケールで jsQR
   */
  function decodeWithJsQR(ctx, w, h) {
    if (!window.jsQR) return null;
    var imageData = ctx.getImageData(0, 0, w, h);
    var code = window.jsQR(imageData.data, w, h, {
      inversionAttempts: "attemptBoth"
    });
    if (code && code.data) return code.data;

    /* 中央 70% クロップでもう一度（遠い・端のノイズ対策） */
    if (w > 120 && h > 120) {
      var cw = Math.floor(w * 0.7);
      var ch = Math.floor(h * 0.7);
      var sx = Math.floor((w - cw) / 2);
      var sy = Math.floor((h - ch) / 2);
      var crop = ctx.getImageData(sx, sy, cw, ch);
      code = window.jsQR(crop.data, cw, ch, {
        inversionAttempts: "attemptBoth"
      });
      if (code && code.data) return code.data;
    }
    return null;
  }

  async function decodeNative(video) {
    if (!detector) return null;
    try {
      var codes = await detector.detect(video);
      if (codes && codes.length && codes[0].rawValue) {
        return codes[0].rawValue;
      }
    } catch (e) {
      /* 一部端末で detect が失敗 → jsQR へ */
    }
    return null;
  }

  function drawVideoToCanvas(video, canvas) {
    var vw = video.videoWidth;
    var vh = video.videoHeight;
    if (!vw || !vh) return null;

    /* jsQR は大きすぎると重い。長辺 720 程度に縮小して精度と速度のバランス */
    var maxSide = useNative ? 1280 : 720;
    var scale = 1;
    if (Math.max(vw, vh) > maxSide) {
      scale = maxSide / Math.max(vw, vh);
    }
    var w = Math.max(1, Math.round(vw * scale));
    var h = Math.max(1, Math.round(vh * scale));
    if (canvas.width !== w) canvas.width = w;
    if (canvas.height !== h) canvas.height = h;
    var ctx = canvas.getContext("2d", {
      willReadFrequently: true,
      alpha: false
    });
    /* 前面カメラでもデコード用はミラーしない（反転すると読めない） */
    ctx.drawImage(video, 0, 0, w, h);
    return { ctx: ctx, w: w, h: h };
  }

  function tick() {
    if (!active) return;
    var video = document.getElementById("qr-video");
    var canvas = document.getElementById("qr-canvas");
    if (!video || !canvas || video.readyState < 2) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    frameSkip++;
    /* ネイティブは毎フレーム、jsQR は 2 フレームに 1 回 */
    var shouldScan = useNative ? true : frameSkip % 2 === 0;
    if (!shouldScan || detectBusy) {
      rafId = requestAnimationFrame(tick);
      return;
    }

    detectBusy = true;
    (async function () {
      try {
        if (useNative && detector) {
          var nativeText = await decodeNative(video);
          if (nativeText) {
            await onDetected(nativeText);
            detectBusy = false;
            return;
          }
        }

        var drawn = drawVideoToCanvas(video, canvas);
        if (drawn) {
          var text = decodeWithJsQR(drawn.ctx, drawn.w, drawn.h);
          if (text) {
            await onDetected(text);
            detectBusy = false;
            return;
          }
        }
      } catch (e) {
        /* continue */
      }
      detectBusy = false;
      if (active) rafId = requestAnimationFrame(tick);
    })();
  }

  async function applyTrackConstraints(track) {
    if (!track || !track.applyConstraints) return;
    try {
      await track.applyConstraints({
        advanced: [{ focusMode: "continuous" }]
      });
    } catch (e1) {
      try {
        await track.applyConstraints({ focusMode: "continuous" });
      } catch (e2) {}
    }
    try {
      await track.applyConstraints({
        advanced: [{ torch: false }]
      });
    } catch (e3) {}
  }

  async function openCamera() {
    var videoConstraints = {
      facingMode: currentDeviceId ? undefined : { ideal: facingMode },
      width: { ideal: 1920, min: 640 },
      height: { ideal: 1080, min: 480 },
      frameRate: { ideal: 30, min: 15 }
    };
    if (currentDeviceId) {
      videoConstraints.deviceId = { exact: currentDeviceId };
      delete videoConstraints.facingMode;
    }

    var constraints = { audio: false, video: videoConstraints };

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e1) {
      /* 低解像度フォールバック */
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: currentDeviceId
            ? { deviceId: { exact: currentDeviceId } }
            : { facingMode: { ideal: facingMode } }
        });
      } catch (e2) {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      }
    }

    var video = document.getElementById("qr-video");
    if (!video) return;
    video.setAttribute("playsinline", "true");
    video.setAttribute("webkit-playsinline", "true");
    video.muted = true;
    video.autoplay = true;
    video.srcObject = stream;

    var track = stream.getVideoTracks()[0];
    if (track) await applyTrackConstraints(track);

    try {
      await video.play();
    } catch (e) {}

    /* メタデータ待ち */
    if (video.readyState < 2) {
      await new Promise(function (resolve) {
        var done = function () {
          video.removeEventListener("loadeddata", done);
          resolve();
        };
        video.addEventListener("loadeddata", done);
        setTimeout(resolve, 1500);
      });
    }

    await listVideoDevices();
    updateSwitchButton();
  }

  function updateSwitchButton() {
    var btn = document.getElementById("btn-qr-switch");
    if (!btn) return;
    btn.textContent =
      facingMode === "environment" ? "🔄 前面カメラへ" : "🔄 背面カメラへ";
    btn.hidden = false;
  }

  async function startScan() {
    setMsg("準備中…");
    var box = document.getElementById("qr-scan-box");
    if (box) box.hidden = false;

    initNativeDetector();
    if (!useNative) {
      try {
        await loadJsQR();
      } catch (e) {
        setMsg("QRライブラリの読込に失敗しました", true);
        return;
      }
    }

    stopTracksOnly();
    lastRaw = "";
    frameSkip = 0;
    detectBusy = false;

    try {
      await openCamera();
    } catch (e) {
      setMsg("カメラを起動できません（ブラウザの権限を許可してください）", true);
      return;
    }

    var engine = useNative ? "高精度モード" : "互換モード";
    setMsg("QRを枠内に合わせてください（" + engine + "）");
    active = true;
    rafId = requestAnimationFrame(tick);
  }

  async function switchCamera() {
    if (videoDevices.length < 2 && !stream) {
      facingMode = facingMode === "environment" ? "user" : "environment";
      currentDeviceId = null;
      await startScan();
      return;
    }

    await listVideoDevices();
    if (videoDevices.length >= 2 && stream) {
      var track = stream.getVideoTracks()[0];
      var curId = track && track.getSettings ? track.getSettings().deviceId : null;
      var idx = 0;
      for (var i = 0; i < videoDevices.length; i++) {
        if (videoDevices[i].deviceId === curId) {
          idx = (i + 1) % videoDevices.length;
          break;
        }
      }
      currentDeviceId = videoDevices[idx].deviceId;
      var label = (videoDevices[idx].label || "").toLowerCase();
      if (
        label.indexOf("front") !== -1 ||
        label.indexOf("user") !== -1 ||
        label.indexOf("前面") !== -1
      ) {
        facingMode = "user";
      } else {
        facingMode = "environment";
      }
    } else {
      facingMode = facingMode === "environment" ? "user" : "environment";
      currentDeviceId = null;
    }

    await startScan();
  }

  function bindUI() {
    var startBtn = document.getElementById("btn-qr-start");
    var stopBtn = document.getElementById("btn-qr-stop");
    var switchBtn = document.getElementById("btn-qr-switch");
    if (startBtn) startBtn.addEventListener("click", startScan);
    if (stopBtn) stopBtn.addEventListener("click", hideScanBox);
    if (switchBtn) switchBtn.addEventListener("click", switchCamera);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }

  window.G5QrLogin = {
    start: startScan,
    stop: hideScanBox,
    switchCamera: switchCamera
  };
})();
