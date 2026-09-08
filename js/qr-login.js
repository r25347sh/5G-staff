/**
 * G⁵ Portal - QR ログイン
 * カメラ切替対応 / QR形式: {"id":"...","pass":"..."} または {id,pass} / id:pass
 */
(function () {
  "use strict";

  var stream = null;
  var rafId = null;
  var active = false;
  var jsQRReady = null;
  var facingMode = "environment"; // environment = 背面, user = 前面
  var videoDevices = [];
  var currentDeviceId = null;

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

  async function listVideoDevices() {
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.enumerateDevices) {
        return [];
      }
      var devices = await navigator.mediaDevices.enumerateDevices();
      videoDevices = devices.filter(function (d) {
        return d.kind === "videoinput";
      });
      return videoDevices;
    } catch (e) {
      return [];
    }
  }

  function stopScan() {
    active = false;
    if (rafId) {
      cancelAnimationFrame(rafId);
      rafId = null;
    }
    if (stream) {
      stream.getTracks().forEach(function (t) {
        t.stop();
      });
      stream = null;
    }
    var video = document.getElementById("qr-video");
    if (video) {
      video.srcObject = null;
    }
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
    stopScan();
    setMsg("読み取りました。ログイン中…");
    try {
      var u = await G5.loginWithQrText(text);
      setMsg("ログイン成功: " + (u.name || u.id));
      if (typeof window.__g5_onLoginSuccess === "function") {
        window.__g5_onLoginSuccess(u);
      } else {
        location.href = "index.html";
      }
    } catch (e) {
      setMsg(e.message || String(e), true);
      setTimeout(function () {
        if (document.getElementById("qr-scan-box") && !document.getElementById("qr-scan-box").hidden) {
          startScan();
        }
      }, 1800);
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
    var ctx = canvas.getContext("2d", { willReadFrequently: true });
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

  async function openCamera() {
    var constraints = {
      audio: false,
      video: {}
    };
    if (currentDeviceId) {
      constraints.video.deviceId = { exact: currentDeviceId };
    } else {
      constraints.video.facingMode = { ideal: facingMode };
    }

    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e1) {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: true
        });
      } catch (e2) {
        throw e2;
      }
    }

    var video = document.getElementById("qr-video");
    if (!video) return;
    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    video.muted = true;
    await video.play();

    await listVideoDevices();
    updateSwitchButton();
  }

  function updateSwitchButton() {
    var btn = document.getElementById("btn-qr-switch");
    if (!btn) return;
    var label =
      facingMode === "environment" ? "前面カメラへ切替" : "背面カメラへ切替";
    btn.textContent = "🔄 " + label;
    btn.hidden = false;
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
      await openCamera();
    } catch (e) {
      setMsg("カメラを起動できません（権限を許可してください）", true);
      return;
    }
    active = true;
    rafId = requestAnimationFrame(tick);
  }

  async function switchCamera() {
    if (!stream) {
      facingMode = facingMode === "environment" ? "user" : "environment";
      currentDeviceId = null;
      await startScan();
      return;
    }

    await listVideoDevices();
    if (videoDevices.length >= 2) {
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
      if (label.indexOf("front") !== -1 || label.indexOf("user") !== -1 || label.indexOf("前面") !== -1) {
        facingMode = "user";
      } else {
        facingMode = "environment";
      }
    } else {
      facingMode = facingMode === "environment" ? "user" : "environment";
      currentDeviceId = null;
    }

    stopScan();
    setMsg("カメラ切替中…");
    try {
      await openCamera();
      active = true;
      rafId = requestAnimationFrame(tick);
      setMsg(
        facingMode === "environment"
          ? "背面カメラ — QRに向けてください"
          : "前面カメラ — QRに向けてください"
      );
    } catch (e) {
      setMsg("カメラ切替に失敗しました", true);
    }
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
