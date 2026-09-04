/**
 * js/load.js — 高速共通ローダー
 * - cache buster は固定版（毎回 Date.now しない）
 * - CSS は並列注入 + preload
 * - フォントは link で非ブロッキング
 */
(function () {
  "use strict";
  var CACHE_VER = "20260904c";

  function detectBase() {
    var path = location.pathname;
    if (path.indexOf("/5G-staff") !== -1) {
      var i = path.indexOf("/5G-staff");
      return path.slice(0, i + "/5G-staff".length).replace(/\/$/, "") || "/5G-staff";
    }
    if (path.endsWith(".html")) {
      var dir = path.replace(/\/[^/]+\.html$/, "");
      return dir || "";
    }
    return path.replace(/\/$/, "") || "";
  }

  var base = detectBase();
  window.__G5_BASE__ = base || ".";

  function p(path) {
    if (!base || base === ".") return path.replace(/^\//, "");
    return base + "/" + path.replace(/^\//, "");
  }

  function alreadyHas(sel) {
    return !!document.querySelector(sel);
  }

  function injectCss(href, media) {
    var bare = href.split("?")[0];
    var name = bare.split("/").pop();
    if (alreadyHas('link[href*="' + name + '"]')) return;
    /* preload してから stylesheet に切替（描画ブロック軽減） */
    var pre = document.createElement("link");
    pre.rel = "preload";
    pre.as = "style";
    pre.href = href;
    pre.onload = function () {
      pre.onload = null;
      pre.rel = "stylesheet";
      if (media) pre.media = media;
    };
    document.head.appendChild(pre);
    /* フォールバック */
    setTimeout(function () {
      if (pre.rel !== "stylesheet") {
        pre.rel = "stylesheet";
        if (media) pre.media = media;
      }
    }, 2000);
  }

  function injectScript(src, onload) {
    var bare = src.split("?")[0];
    var name = bare.split("/").pop();
    if (alreadyHas('script[src*="' + name + '"]')) {
      if (onload) onload();
      return;
    }
    var script = document.createElement("script");
    script.src = src;
    script.async = false;
    script.onload = onload || null;
    script.onerror = function () {
      console.error("load failed:", src);
      if (onload) onload();
    };
    document.head.appendChild(script);
  }

  /* フォント: @import 禁止 → 非ブロッキング link */
  if (!alreadyHas('link[href*="fonts.googleapis.com"]')) {
    var preconn1 = document.createElement("link");
    preconn1.rel = "preconnect";
    preconn1.href = "https://fonts.googleapis.com";
    document.head.appendChild(preconn1);
    var preconn2 = document.createElement("link");
    preconn2.rel = "preconnect";
    preconn2.href = "https://fonts.gstatic.com";
    preconn2.crossOrigin = "anonymous";
    document.head.appendChild(preconn2);
    var fontLink = document.createElement("link");
    fontLink.rel = "stylesheet";
    fontLink.href =
      "https://fonts.googleapis.com/css2?family=Cinzel:wght@400;600;700&family=Noto+Sans+JP:wght@400;500;700&display=swap";
    fontLink.media = "print";
    fontLink.onload = function () {
      fontLink.media = "all";
    };
    document.head.appendChild(fontLink);
  }

  var q = "?v=" + CACHE_VER;
  injectCss(p("css/style.css") + q);
  injectCss(p("css/portal.css") + q);
  injectCss(p("menu/menu.css") + q);

  var path = window.location.pathname;
  var pageCss = "css/index.css";
  if (path.indexOf("shift") !== -1) pageCss = "css/shift.css";
  else if (path.indexOf("manual") !== -1) pageCss = "css/manual.css";
  else if (path.indexOf("admin") !== -1) pageCss = "css/admin.css";
  injectCss(p(pageCss) + q);

  /* JS は依存順だが並列プリロード風に直列完了 */
  var jsQueue = [p("js/common.js") + q, p("js/notif.js") + q, p("menu/menu.js") + q];
  function loadNext(i) {
    if (i >= jsQueue.length) {
      if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register(p("sw.js")).catch(function () {});
      }
      return;
    }
    injectScript(jsQueue[i], function () {
      loadNext(i + 1);
    });
  }
  loadNext(0);
})();
