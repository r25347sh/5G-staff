/**
 * G⁵ Portal - QR ログイン
 * カメラで {"id":"...","pass":"..."} を読み取りログイン
 */
(function () {
  "use strict";

  var stream = null;
  var rafId = null;
  var active = false;
  var jsQRReady = null;

  function loadJsQR() {
    if (window.jsQR) return Promise.resolve();
    if (jsQRReady) return jsQRReady;
    jsQRReady = new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("jsQR load failed")); };
      document.head.appendChild(s);
    });
    return jsQRReady;
  }

  function stopScan() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) { t.stop(); });
      stream = null;
    }
    var video = document.getElementById("qr-video");
    if (video) {
      video.srcObject = null;
    }
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
    stopScan();
    setMsg("読み取りました。ログイン中…");
    try {
      var u = await G5.loginWithQrText(text);
      setMsg("ログイン成功: " + (u.name || u.id));
      if (typeof window.__g5_onLoginSuccess === "function") {
        window.__g5_onLoginSuccess(u);
      } else {
        location.reload();
      }
    } catch (e) {
      setMsg(e.message || String(e), true);
    }
  }

  function tick() {
    if (!active) return;
    var video = document.getElementById("qr-video");
    var canvas = document.getElementById("qr-canvas");
    if (!video || !canvas || video.readyState < 2) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    var w = video.videoWidth;
    var h = video.videoHeight;
    if (!w || !h) {
      rafId = requestAnimationFrame(tick);
      return;
    }
    canvas.width = w;
    canvas.height = h;
    var ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, w, h);
    var imageData = ctx.getImageData(0, 0, w, h);
    if (window.jsQR) {
      var code = window.jsQR(imageData.data, w, h, { inversionAttempts: "dontInvert" });
      if (code && code.data) {
        onDetected(code.data);
        return;
      }
    }
    rafId = requestAnimationFrame(tick);
  }

  async function startScan() {
    try {
      await loadJsQR();
    } catch (e) {
      setMsg("QRライブラリの読込に失敗しました", true);
      return;
    }
    stopScan();
    var box = document.getElementById("qr-scan-box");
    if (box) box.hidden = false;
    setMsg("カメラをQRに向けてください");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" } },
        audio: false
      });
    } catch (e) {
      setMsg("カメラを起動できません（権限を許可してください）", true);
      return;
    }
    var video = document.getElementById("qr-video");
    if (!video) return;
    video.srcObject = stream;
    await video.play();
    active = true;
    rafId = requestAnimationFrame(tick);
  }

  function bindUI() {
    var startBtn = document.getElementById("btn-qr-start");
    var stopBtn = document.getElementById("btn-qr-stop");
    if (startBtn) startBtn.addEventListener("click", startScan);
    if (stopBtn) stopBtn.addEventListener("click", stopScan);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bindUI);
  } else {
    bindUI();
  }

  window.G5QrLogin = { start: startScan, stop: stopScan };
})();
