/**
 * G⁵ Portal - site-wide adaptive realtime
 * GitHub Pages 静的配信向け: 可視時は短周期、非表示は長周期
 */
(function () {
  "use strict";
  var DEFAULT_ACTIVE = 4000;
  var DEFAULT_HIDDEN = 20000;
  var listeners = [];
  var timer = null;
  var running = false;
  var activeMs = DEFAULT_ACTIVE;
  var hiddenMs = DEFAULT_HIDDEN;

  function pageKind() {
    var p = (location.pathname || "").toLowerCase();
    if (p.indexOf("chat") !== -1) return "chat";
    if (p.indexOf("thread") !== -1) return "thread";
    if (p.indexOf("shift") !== -1) return "shift";
    if (p.indexOf("admin") !== -1) return "admin";
    return "other";
  }

  function computeIntervals() {
    var kind = pageKind();
    /* チャットは最優先で短く */
    if (kind === "chat") {
      activeMs = 2500;
      hiddenMs = 12000;
    } else if (kind === "shift" || kind === "thread") {
      activeMs = 4000;
      hiddenMs = 15000;
    } else if (kind === "admin") {
      activeMs = 5000;
      hiddenMs = 18000;
    } else {
      activeMs = 6000;
      hiddenMs = 20000;
    }
    /* サーバ meta があれば上書きヒント */
    try {
      if (window.__G5_RT_HINT__ && window.__G5_RT_HINT__ > 1500) {
        activeMs = Math.min(activeMs, window.__G5_RT_HINT__);
      }
    } catch (e) {}
  }

  function currentInterval() {
    return document.visibilityState === "hidden" ? hiddenMs : activeMs;
  }

  function tick() {
    listeners.slice().forEach(function (fn) {
      try {
        fn();
      } catch (e) {
        console.warn("realtime listener", e);
      }
    });
  }

  function schedule() {
    if (timer) clearInterval(timer);
    if (!running || !listeners.length) return;
    timer = setInterval(tick, currentInterval());
  }

  function on() {
    running = true;
    computeIntervals();
    schedule();
    tick();
  }

  function off() {
    running = false;
    if (timer) clearInterval(timer);
    timer = null;
  }

  function subscribe(fn) {
    if (typeof fn !== "function") return function () {};
    listeners.push(fn);
    if (!running) on();
    else schedule();
    return function unsubscribe() {
      listeners = listeners.filter(function (f) {
        return f !== fn;
      });
      if (!listeners.length) off();
    };
  }

  function force() {
    tick();
  }

  document.addEventListener("visibilitychange", function () {
    if (!running) return;
    schedule();
    if (document.visibilityState === "visible") tick();
  });
  window.addEventListener("online", function () {
    if (running) tick();
  });
  window.addEventListener("focus", function () {
    if (running) tick();
  });

  /* meta.json からヒント取得（任意） */
  async function loadMetaHint() {
    try {
      var base = (window.G5 && G5.BASE) || ".";
      var res = await fetch(base + "/src/data/meta.json?t=" + Date.now(), { cache: "no-store" });
      if (!res.ok) return;
      var meta = await res.json();
      if (meta && meta.realtime_hint_ms) {
        window.__G5_RT_HINT__ = meta.realtime_hint_ms;
        computeIntervals();
        schedule();
      }
      if (meta && meta.notif_epoch != null) {
        window.__G5_NOTIF_EPOCH__ = meta.notif_epoch;
        try {
          var prev = parseInt(localStorage.getItem("g5_notif_epoch") || "0", 10);
          if (meta.notif_epoch > prev) {
            localStorage.setItem("g5_notif_epoch", String(meta.notif_epoch));
            /* 旧通知トレイを破棄 */
            localStorage.removeItem("g5_notif_inbox");
            localStorage.removeItem("g5_notif_read");
            localStorage.removeItem("g5_notif_pushed");
            localStorage.removeItem("g5_notified_near");
            localStorage.removeItem("g5_notified_urgent_filled");
            localStorage.removeItem("g5_notified_urgent_open");
            localStorage.removeItem("g5_urgent_notified_ids");
            window.__G5_NOTIF_WIPED__ = true;
          }
        } catch (e) {}
      }
    } catch (e) {}
  }

  window.G5Realtime = {
    subscribe: subscribe,
    force: force,
    on: on,
    off: off,
    loadMetaHint: loadMetaHint,
    pageKind: pageKind
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", loadMetaHint);
  } else {
    loadMetaHint();
  }
})();
