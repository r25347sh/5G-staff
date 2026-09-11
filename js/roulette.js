/**
 * G⁵ European Roulette — display only（物理チップ運用）
 * ホイール回転 + 結果表示。ベットUIなし。
 */
(function () {
  "use strict";

  /* ヨーロピアン標準の並び（時計回り配置用） */
  var ORDER = [
    0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24,
    16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26
  ];
  var RED = {
    1: 1, 3: 1, 5: 1, 7: 1, 9: 1, 12: 1, 14: 1, 16: 1, 18: 1, 19: 1, 21: 1, 23: 1,
    25: 1, 27: 1, 30: 1, 32: 1, 34: 1, 36: 1
  };
  var POCKET = 360 / 37;

  var canvas = document.getElementById("wheel-canvas");
  if (!canvas) return;
  var ctx = canvas.getContext("2d");
  var spinning = false;
  var rotation = 0;
  var history = [];

  function colorOf(n) {
    if (n === 0) return "green";
    return RED[n] ? "red" : "black";
  }

  function colorLabel(c) {
    return c === "red" ? "赤" : c === "black" ? "黒" : "緑（0）";
  }

  function drawWheel(rotDeg) {
    var w = canvas.width;
    var cx = w / 2;
    var cy = w / 2;
    var r = w / 2 - 4;
    ctx.clearRect(0, 0, w, w);
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = "#0d0a14";
    ctx.fill();

    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate((rotDeg * Math.PI) / 180);

    for (var i = 0; i < 37; i++) {
      var start = ((i * POCKET) - POCKET / 2 - 90) * Math.PI / 180;
      var end = (((i + 1) * POCKET) - POCKET / 2 - 90) * Math.PI / 180;
      var n = ORDER[i];
      var col = colorOf(n);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.arc(0, 0, r - 2, start, end);
      ctx.closePath();
      if (col === "red") ctx.fillStyle = "#c41e3a";
      else if (col === "black") ctx.fillStyle = "#121018";
      else ctx.fillStyle = "#0a6b3c";
      ctx.fill();
      ctx.strokeStyle = "rgba(255,215,0,0.35)";
      ctx.lineWidth = 1;
      ctx.stroke();

      var mid = (start + end) / 2;
      var tx = Math.cos(mid) * (r * 0.72);
      var ty = Math.sin(mid) * (r * 0.72);
      ctx.save();
      ctx.translate(tx, ty);
      ctx.rotate(mid + Math.PI / 2);
      ctx.fillStyle = "#fff";
      ctx.font = "bold 16px 'Noto Sans JP', sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(String(n), 0, 0);
      ctx.restore();
    }

    ctx.beginPath();
    ctx.arc(0, 0, r * 0.42, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,215,0,0.5)";
    ctx.lineWidth = 3;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.38, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(10,7,18,0.85)";
    ctx.fill();
    ctx.restore();
  }

  function indexAtRotation(R) {
    var norm = ((R % 360) + 360) % 360;
    var idx = Math.round(norm / POCKET) % 37;
    return (37 - idx) % 37;
  }

  function numberAtRotation(R) {
    return ORDER[indexAtRotation(R)];
  }

  function setResultUI(n) {
    var c = colorOf(n);
    var val = document.getElementById("result-value");
    var meta = document.getElementById("result-meta");
    if (!val) return;
    val.textContent = String(n);
    val.className = "result-value is-" + c;
    if (meta) {
      var parity = n === 0 ? "—" : n % 2 === 0 ? "偶数" : "奇数";
      var range = n === 0 ? "—" : n <= 18 ? "1–18（ロー）" : "19–36（ハイ）";
      meta.textContent = colorLabel(c) + " · " + parity + " · " + range;
    }
  }

  function showResultModal(n) {
    var backdrop = document.getElementById("result-modal");
    var num = document.getElementById("modal-num");
    var meta = document.getElementById("modal-meta");
    if (!backdrop || !num) return;
    var c = colorOf(n);
    num.textContent = String(n);
    num.className = "result-modal-num is-" + c;
    if (meta) {
      var parity = n === 0 ? "—" : n % 2 === 0 ? "偶数" : "奇数";
      meta.textContent = colorLabel(c) + " · " + parity;
    }
    backdrop.hidden = false;
    requestAnimationFrame(function () {
      backdrop.classList.add("show");
    });
  }

  function hideResultModal() {
    var backdrop = document.getElementById("result-modal");
    if (!backdrop) return;
    backdrop.classList.remove("show");
    setTimeout(function () {
      backdrop.hidden = true;
    }, 250);
  }

  function pushHistory(n) {
    history.unshift(n);
    if (history.length > 16) history.pop();
    var strip = document.getElementById("history");
    if (!strip) return;
    strip.innerHTML = history
      .map(function (x) {
        return '<span class="hist-ball h-' + colorOf(x) + '">' + x + "</span>";
      })
      .join("");
  }

  function spin() {
    if (spinning) return;
    spinning = true;
    var btn = document.getElementById("btn-spin");
    if (btn) btn.disabled = true;

    var winNumber = ORDER[(Math.random() * 37) | 0];
    var winIndex = ORDER.indexOf(winNumber);
    /* ポインタは上（-90°相当の基準）。目標角度を合わせる */
    var targetPocketAngle = winIndex * POCKET;
    var extraTurns = 4 + ((Math.random() * 3) | 0);
    var startRot = rotation;
    var delta = extraTurns * 360 + (360 - targetPocketAngle) - (startRot % 360);
    if (delta < 360 * 3) delta += 360;
    var duration = 4200 + Math.random() * 800;
    var t0 = null;

    function easeOutCubic(t) {
      return 1 - Math.pow(1 - t, 3);
    }

    function frame(now) {
      if (!t0) t0 = now;
      var t = Math.min(1, (now - t0) / duration);
      var e = easeOutCubic(t);
      rotation = startRot + delta * e;
      drawWheel(rotation);
      if (t < 1) {
        requestAnimationFrame(frame);
      } else {
        var landed = numberAtRotation(rotation);
        if (landed !== winNumber) {
          /* 誤差補正：表示は狙った数字に合わせる */
          landed = winNumber;
        }
        setResultUI(landed);
        pushHistory(landed);
        showResultModal(landed);
        spinning = false;
        if (btn) btn.disabled = false;
      }
    }
    requestAnimationFrame(frame);
  }

  document.getElementById("btn-spin").addEventListener("click", spin);
  document.getElementById("modal-close").addEventListener("click", hideResultModal);
  document.getElementById("result-modal").addEventListener("click", function (e) {
    if (e.target.id === "result-modal") hideResultModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.code === "Space" || e.key === " ") {
      var tag = (e.target && e.target.tagName) || "";
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.target.isContentEditable)
        return;
      e.preventDefault();
      var modal = document.getElementById("result-modal");
      if (modal && !modal.hidden && modal.classList.contains("show")) {
        hideResultModal();
        return;
      }
      spin();
    }
    if (e.key === "Escape") hideResultModal();
  });

  drawWheel(0);
})();
