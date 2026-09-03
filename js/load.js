/**
 * js/load.js — 共通ローダー（CSS/JS 順序保証・重複防止・BASE検出）
 */
(function () {
  "use strict";
  function detectBase() {
    const path = location.pathname;
    if (path.includes("/5G-staff")) {
      const i = path.indexOf("/5G-staff");
      return path.slice(0, i + "/5G-staff".length).replace(/\/$/, "") || "/5G-staff";
    }
    if (path.endsWith(".html")) {
      const dir = path.replace(/\/[^/]+\.html$/, "");
      return dir || "";
    }
    return path.replace(/\/$/, "") || "";
  }
  const base = detectBase();
  const cacheBuster = "v=" + Date.now();
  window.__G5_BASE__ = base || ".";
  function alreadyHas(selector) { return !!document.querySelector(selector); }
  function injectCss(href) {
    const bare = href.split("?")[0];
    if (alreadyHas('link[href*="' + bare.split("/").pop() + '"]')) return;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = href;
    document.head.appendChild(link);
  }
  function injectScript(src, onload) {
    const bare = src.split("?")[0];
    if (alreadyHas('script[src*="' + bare.split("/").pop() + '"]')) { if (onload) onload(); return; }
    const script = document.createElement("script");
    script.src = src;
    script.onload = onload || null;
    script.onerror = function () { console.error("load failed:", src); if (onload) onload(); };
    document.head.appendChild(script);
  }
  function p(path) {
    if (!base || base === ".") return path.replace(/^\//, "");
    return base + "/" + path.replace(/^\//, "");
  }
  injectCss(p("css/style.css") + "?" + cacheBuster);
  injectCss(p("menu/menu.css") + "?" + cacheBuster);
  const path = window.location.pathname;
  let pageCss = "";
  if (path.includes("shift")) pageCss = "css/shift.css";
  else if (path.includes("manual")) pageCss = "css/manual.css";
  else if (path.includes("admin")) pageCss = "css/admin.css";
  else pageCss = "css/index.css";
  if (pageCss) injectCss(p(pageCss) + "?" + cacheBuster);
  const jsQueue = [p("js/common.js"), p("js/notif.js"), p("menu/menu.js")];
  function loadNext(i) {
    if (i >= jsQueue.length) {
      console.log("%c✨ G⁵ Portal ロード完了", "color:#ff2d95;font-weight:bold;");
      if ("serviceWorker" in navigator) navigator.serviceWorker.register(p("sw.js")).catch(function () {});
      return;
    }
    injectScript(jsQueue[i] + "?" + cacheBuster, function () { loadNext(i + 1); });
  }
  loadNext(0);
})();
