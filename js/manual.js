/**
 * manual.js — manuals.json から動的一覧
 * マニュアルが空の場合は「準備中」を表示
 */
(function () {
  "use strict";
  const BASE = (window.G5 && G5.BASE) || ".";

  function mdToHtml(md) {
    if (!md) return "";
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let html = "", inList = false;
    function escape(str) {
      return String(str).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
    }
    function inline(str) {
      return escape(str)
        .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
        .replace(/\*(.+?)\*/g, "<em>$1</em>")
        .replace(/`(.+?)`/g, "<code>$1</code>");
    }
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (/^###\s+/.test(line)) {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<h3>" + escape(line.replace(/^###\s+/, "")) + "</h3>";
        continue;
      }
      if (/^##\s+/.test(line)) {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<h2>" + escape(line.replace(/^##\s+/, "")) + "</h2>";
        continue;
      }
      if (/^#\s+/.test(line)) {
        if (inList) { html += "</ul>"; inList = false; }
        html += "<h1>" + escape(line.replace(/^#\s+/, "")) + "</h1>";
        continue;
      }
      if (/^[-*]\s+/.test(line)) {
        if (!inList) { html += "<ul>"; inList = true; }
        html += "<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>";
        continue;
      }
      if (line.trim() === "") {
        if (inList) { html += "</ul>"; inList = false; }
        continue;
      }
      if (inList) { html += "</ul>"; inList = false; }
      html += "<p>" + inline(line) + "</p>";
    }
    if (inList) html += "</ul>";
    return html;
  }

  async function show(file) {
    const el = document.getElementById("manual-content");
    if (!el) return;
    el.innerHTML = "<p class='empty-msg'>読み込み中…</p>";
    try {
      const res = await fetch(BASE + "/src/data/manual/" + file + "?t=" + Date.now());
      if (!res.ok) throw new Error(String(res.status));
      el.innerHTML = '<div class="md-body">' + mdToHtml(await res.text()) + "</div>";
    } catch (e) {
      el.innerHTML = '<p class="empty-msg">読み込みに失敗しました</p>';
    }
  }

  async function init() {
    const ul = document.getElementById("manual-list");
    const content = document.getElementById("manual-content");
    if (!ul) return;
    let manuals = [];
    try {
      const res = await fetch(BASE + "/src/data/manuals.json?t=" + Date.now());
      if (res.ok) manuals = await res.json();
      if (!Array.isArray(manuals)) manuals = [];
    } catch (e) {
      manuals = [];
    }

    if (manuals.length === 0) {
      ul.innerHTML = "";
      if (content) {
        content.innerHTML =
          '<div class="empty-state">' +
          '<p class="empty-msg" style="font-size:1.1rem;margin-bottom:0.5rem;">マニュアルは現在準備中です</p>' +
          '<p class="hint-text" style="color:var(--text-muted);">運営から追加され次第、ここに表示されます。</p>' +
          "</div>";
      }
      return;
    }

    ul.innerHTML = manuals
      .map(function (m) {
        return (
          '<li><button type="button" data-file="' +
          (m.file || "") +
          '">' +
          (m.title || m.file || "無題") +
          "</button></li>"
        );
      })
      .join("");

    ul.addEventListener("click", function (e) {
      const btn = e.target.closest("button[data-file]");
      if (!btn) return;
      ul.querySelectorAll("button").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      show(btn.dataset.file);
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
