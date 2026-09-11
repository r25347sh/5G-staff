/**
 * manual.js — manuals.json から動的一覧
 * マニュアルが空の場合は「準備中」を表示
 * Markdown: 見出し / リスト / テーブル / HR / 強調 対応
 */
(function () {
  "use strict";
  const BASE = (window.G5 && G5.BASE) || ".";

  function escape(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(str) {
    return escape(str)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  /** テーブル行をセル配列に分解（| 区切り） */
  function splitTableRow(line) {
    var s = line.trim();
    if (s.charAt(0) === "|") s = s.slice(1);
    if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
    return s.split("|").map(function (c) {
      return c.trim();
    });
  }

  /** 区切り行か判定（| --- | :---: | など） */
  function isTableSeparator(line) {
    var cells = splitTableRow(line);
    if (!cells.length) return false;
    return cells.every(function (c) {
      return /^:?-+:?$/.test(c.replace(/\s/g, ""));
    });
  }

  function mdToHtml(md) {
    if (!md) return "";
    const lines = md.replace(/\r\n/g, "\n").split("\n");
    let html = "";
    let inList = false;
    let i = 0;

    while (i < lines.length) {
      const line = lines[i];

      /* 水平線 --- または *** */
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<hr>";
        i++;
        continue;
      }

      /* テーブル検出: 現在行が | を含み、次行が区切り行 */
      if (
        line.indexOf("|") !== -1 &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        var headerCells = splitTableRow(line);
        var alignRow = splitTableRow(lines[i + 1]);
        var aligns = alignRow.map(function (c) {
          var t = c.replace(/\s/g, "");
          if (/^:-+:$/.test(t)) return "center";
          if (/^-+:$/.test(t)) return "right";
          if (/^:-+$/.test(t)) return "left";
          return "";
        });
        html += '<div class="md-table-wrap"><table class="md-table"><thead><tr>';
        headerCells.forEach(function (cell, idx) {
          var al = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "";
          html += "<th" + al + ">" + inline(cell) + "</th>";
        });
        html += "</tr></thead><tbody>";
        i += 2;
        while (i < lines.length && lines[i].indexOf("|") !== -1 && lines[i].trim() !== "") {
          if (isTableSeparator(lines[i])) {
            i++;
            continue;
          }
          var cells = splitTableRow(lines[i]);
          html += "<tr>";
          cells.forEach(function (cell, idx) {
            var al = aligns[idx] ? ' style="text-align:' + aligns[idx] + '"' : "";
            html += "<td" + al + ">" + inline(cell) + "</td>";
          });
          html += "</tr>";
          i++;
        }
        html += "</tbody></table></div>";
        continue;
      }

      /* 見出し */
      if (/^###\s+/.test(line)) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<h3>" + escape(line.replace(/^###\s+/, "")) + "</h3>";
        i++;
        continue;
      }
      if (/^##\s+/.test(line)) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<h2>" + escape(line.replace(/^##\s+/, "")) + "</h2>";
        i++;
        continue;
      }
      if (/^#\s+/.test(line)) {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        html += "<h1>" + escape(line.replace(/^#\s+/, "")) + "</h1>";
        i++;
        continue;
      }

      /* リスト */
      if (/^[-*]\s+/.test(line)) {
        if (!inList) {
          html += "<ul>";
          inList = true;
        }
        html += "<li>" + inline(line.replace(/^[-*]\s+/, "")) + "</li>";
        i++;
        continue;
      }

      /* 空行 */
      if (line.trim() === "") {
        if (inList) {
          html += "</ul>";
          inList = false;
        }
        i++;
        continue;
      }

      /* 通常段落 */
      if (inList) {
        html += "</ul>";
        inList = false;
      }
      html += "<p>" + inline(line) + "</p>";
      i++;
    }
    if (inList) html += "</ul>";
    return html;
  }

  async function show(file) {
    const el = document.getElementById("manual-content");
    if (!el) return;
    el.innerHTML = "<p class='empty-msg'>読み込み中…</p>";
    try {
      const res = await fetch(BASE + "/src/data/manual/" + encodeURIComponent(file) + "?t=" + Date.now());
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
