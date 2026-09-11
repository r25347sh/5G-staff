/**
 * manual.js — manuals.json から一覧、Markdown を HTML に変換
 * 対応: 見出し / 箇条書き / 番号付き / 表 / HR / 引用 / コード / 強調
 */
(function () {
  "use strict";
  var BASE = (window.G5 && G5.BASE) || ".";

  function escape(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function inline(str) {
    var s = escape(str);
    /* インラインコードを先に保護 */
    var codes = [];
    s = s.replace(/`([^`]+)`/g, function (_, c) {
      codes.push(c);
      return "\u0000C" + (codes.length - 1) + "\u0000";
    });
    s = s.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
    s = s.replace(/\*(.+?)\*/g, "<em>$1</em>");
    s = s.replace(/\u0000C(\d+)\u0000/g, function (_, i) {
      return "<code>" + codes[+i] + "</code>";
    });
    return s;
  }

  function splitTableRow(line) {
    var s = line.trim();
    if (s.charAt(0) === "|") s = s.slice(1);
    if (s.charAt(s.length - 1) === "|") s = s.slice(0, -1);
    return s.split("|").map(function (c) {
      return c.trim();
    });
  }

  function isTableSeparator(line) {
    if (line.indexOf("|") === -1 && !/^\s*:?-+:?\s*$/.test(line)) {
      /* | なしの ---|--- は稀 */
    }
    var cells = splitTableRow(line);
    if (!cells.length) return false;
    return cells.every(function (c) {
      var t = c.replace(/\s/g, "");
      return t === "" || /^:?-+:?$/.test(t);
    });
  }

  function closeLists(state) {
    var out = "";
    if (state.ul) {
      out += "</ul>";
      state.ul = false;
    }
    if (state.ol) {
      out += "</ol>";
      state.ol = false;
    }
    return out;
  }

  function mdToHtml(md) {
    if (!md) return "";
    var lines = String(md).replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
    var html = "";
    var state = { ul: false, ol: false };
    var i = 0;

    while (i < lines.length) {
      var line = lines[i];

      /* フェンスコード ``` */
      if (/^\s*```/.test(line)) {
        html += closeLists(state);
        i++;
        var buf = [];
        while (i < lines.length && !/^\s*```/.test(lines[i])) {
          buf.push(lines[i]);
          i++;
        }
        if (i < lines.length) i++;
        html += "<pre class=\"md-pre\"><code>" + escape(buf.join("\n")) + "</code></pre>";
        continue;
      }

      /* 水平線 */
      if (/^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
        html += closeLists(state);
        html += "<hr>";
        i++;
        continue;
      }

      /* テーブル */
      if (
        line.indexOf("|") !== -1 &&
        i + 1 < lines.length &&
        isTableSeparator(lines[i + 1])
      ) {
        html += closeLists(state);
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
          var colCount = Math.max(headerCells.length, cells.length);
          for (var ci = 0; ci < colCount; ci++) {
            var al2 = aligns[ci] ? ' style="text-align:' + aligns[ci] + '"' : "";
            html += "<td" + al2 + ">" + inline(cells[ci] != null ? cells[ci] : "") + "</td>";
          }
          html += "</tr>";
          i++;
        }
        html += "</tbody></table></div>";
        continue;
      }

      /* 見出し（インライン装飾あり） */
      var hm = line.match(/^(#{1,3})\s+(.*)$/);
      if (hm) {
        html += closeLists(state);
        var level = hm[1].length;
        html += "<h" + level + ">" + inline(hm[2]) + "</h" + level + ">";
        i++;
        continue;
      }

      /* 引用 */
      if (/^\s*>\s?/.test(line)) {
        html += closeLists(state);
        var q = [];
        while (i < lines.length && /^\s*>\s?/.test(lines[i])) {
          q.push(lines[i].replace(/^\s*>\s?/, ""));
          i++;
        }
        html +=
          "<blockquote class=\"md-quote\">" +
          q
            .map(function (row) {
              return "<p>" + inline(row) + "</p>";
            })
            .join("") +
          "</blockquote>";
        continue;
      }

      /* 番号付きリスト */
      if (/^\s*\d+\.\s+/.test(line)) {
        if (state.ul) {
          html += "</ul>";
          state.ul = false;
        }
        if (!state.ol) {
          html += "<ol>";
          state.ol = true;
        }
        html += "<li>" + inline(line.replace(/^\s*\d+\.\s+/, "")) + "</li>";
        i++;
        continue;
      }

      /* 箇条書き */
      if (/^\s*[-*+]\s+/.test(line)) {
        if (state.ol) {
          html += "</ol>";
          state.ol = false;
        }
        if (!state.ul) {
          html += "<ul>";
          state.ul = true;
        }
        html += "<li>" + inline(line.replace(/^\s*[-*+]\s+/, "")) + "</li>";
        i++;
        continue;
      }

      /* 空行 */
      if (line.trim() === "") {
        html += closeLists(state);
        i++;
        continue;
      }

      /* 段落 */
      html += closeLists(state);
      html += "<p>" + inline(line) + "</p>";
      i++;
    }
    html += closeLists(state);
    return html;
  }

  async function show(file) {
    var el = document.getElementById("manual-content");
    if (!el) return;
    el.innerHTML = "<p class='empty-msg'>読み込み中…</p>";
    try {
      var res = await fetch(
        BASE + "/src/data/manual/" + encodeURIComponent(file) + "?t=" + Date.now()
      );
      if (!res.ok) throw new Error(String(res.status));
      var text = await res.text();
      el.innerHTML = '<div class="md-body">' + mdToHtml(text) + "</div>";
      el.scrollTop = 0;
    } catch (e) {
      el.innerHTML = '<p class="empty-msg">読み込みに失敗しました</p>';
      console.warn("[manual]", e);
    }
  }

  async function init() {
    var ul = document.getElementById("manual-list");
    var content = document.getElementById("manual-content");
    if (!ul) return;
    var manuals = [];
    try {
      var res = await fetch(BASE + "/src/data/manuals.json?t=" + Date.now());
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
          escape(m.file || "") +
          '">' +
          escape(m.title || m.file || "無題") +
          "</button></li>"
        );
      })
      .join("");

    ul.addEventListener("click", function (e) {
      var btn = e.target.closest("button[data-file]");
      if (!btn) return;
      ul.querySelectorAll("button").forEach(function (b) {
        b.classList.remove("active");
      });
      btn.classList.add("active");
      show(btn.getAttribute("data-file"));
    });

    /* 先頭を自動表示 */
    var first = ul.querySelector("button[data-file]");
    if (first) {
      first.classList.add("active");
      show(first.getAttribute("data-file"));
    }
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
