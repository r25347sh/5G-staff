/**
 * G⁵ Portal - common utilities
 */
(function () {
  "use strict";
  function detectBase() {
    if (window.__G5_BASE__ !== undefined && window.__G5_BASE__ !== null) {
      return window.__G5_BASE__ || ".";
    }
    const path = location.pathname;
    if (path.includes("/5G-staff")) {
      const i = path.indexOf("/5G-staff");
      return path.slice(0, i + "/5G-staff".length).replace(/\/$/, "") || "/5G-staff";
    }
    if (path.endsWith(".html")) {
      return path.replace(/\/[^/]+\.html$/, "") || ".";
    }
    return path.replace(/\/$/, "") || ".";
  }
  const BASE = detectBase();
  window.G5 = window.G5 || {};
  G5.BASE = BASE;
  function initAmbient() {
    const el = document.getElementById("ambient");
    if (!el) return;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("div");
      p.className = "g5-ambient-particle " + ["pink", "cyan", "gold"][i % 3];
      p.style.left = Math.random() * 100 + "%";
      p.style.width = p.style.height = 2 + Math.random() * 4 + "px";
      p.style.animationDuration = 12 + Math.random() * 18 + "s";
      p.style.animationDelay = Math.random() * 10 + "s";
      el.appendChild(p);
    }
  }
  async function loadBanner() {
    const slot = document.getElementById("banner-slot");
    if (!slot) return;
    try {
      const res = await fetch(BASE + "/src/data/banner.json?t=" + Date.now());
      const data = await res.json();
      const b = Array.isArray(data) ? data[0] : data;
      if (!b || !b.enabled) return;
      const page = (location.pathname.split("/").pop() || "index").replace(".html", "") || "index";
      const pages = b.pages || ["all"];
      if (!pages.includes("all") && !pages.includes(page)) return;
      const link = b.link || "";
      const href = !link ? "" : (link.startsWith("http") ? link : (BASE === "." ? link : BASE + "/" + link.replace(/^\//, "")));
      slot.innerHTML = '<div class="site-banner"><span>' + (b.text || "") + "</span>" + (href ? '<a href="' + href + '">詳細</a>' : "") + "</div>";
      slot.hidden = false;
    } catch (e) {}
  }
  G5.getSession = function () {
    try { return JSON.parse(sessionStorage.getItem("g5_session") || "null"); } catch (e) { return null; }
  };
  G5.setSession = function (user) {
    sessionStorage.setItem("g5_session", JSON.stringify({ id: user.id, name: user.name || user.id, role: user.role }));
  };
  G5.clearSession = function () { sessionStorage.removeItem("g5_session"); };
  G5.getToken = function () {
    return "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";
  };
  function boot() { initAmbient(); loadBanner(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
