/**
 * G⁵ Portal - admin shift export
 * デザイン済みシフト表 HTML / PDF 出力（印刷ダイアログに依存しないレイアウト）
 */
(function () {
  "use strict";

  var EVENT_DATE_LABEL = "2026年9月12日";

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function userName(map, id) {
    if (!id || id === "open") return "—";
    return (map[id] && (map[id].name || map[id].id)) || id;
  }

  function statusLabel(s) {
    var isOpen = !s.user_id || s.user_id === "open" || s.open;
    if (s.urgent && isOpen) return "急募中";
    if (isOpen) return "募集中";
    return "確定";
  }

  function sortShifts(list) {
    return (list || []).slice().sort(function (a, b) {
      var ka = (a.time_start || "") + (a.tanto || "") + (a.user_id || "");
      var kb = (b.time_start || "") + (b.tanto || "") + (b.user_id || "");
      return ka < kb ? -1 : ka > kb ? 1 : 0;
    });
  }

  /** 時間帯キー一覧 */
  function collectSlots(shifts) {
    var set = {};
    shifts.forEach(function (s) {
      var k = (s.time_start || "") + "–" + (s.time_end || "");
      if (s.time_start) set[k] = { start: s.time_start, end: s.time_end };
    });
    return Object.keys(set)
      .sort()
      .map(function (k) {
        return set[k];
      });
  }

  function collectTantos(shifts, fallback) {
    var set = {};
    (fallback || []).forEach(function (t) {
      if (t) set[t] = true;
    });
    shifts.forEach(function (s) {
      if (s.tanto) set[s.tanto] = true;
    });
    return Object.keys(set).sort();
  }

  function buildMatrix(shifts, tantos) {
    var slots = collectSlots(shifts);
    var cells = {};
    shifts.forEach(function (s) {
      var sk = (s.time_start || "") + "–" + (s.time_end || "");
      var tk = s.tanto || "（未設定）";
      if (!cells[sk]) cells[sk] = {};
      if (!cells[sk][tk]) cells[sk][tk] = [];
      cells[sk][tk].push(s);
    });
    return { slots: slots, tantos: tantos, cells: cells };
  }

  function buildDocumentHtml(shifts, users, opts) {
    opts = opts || {};
    var map = {};
    (users || []).forEach(function (u) {
      map[u.id] = u;
    });
    var sorted = sortShifts(shifts);
    var tantos = collectTantos(sorted, opts.tantoOptions || []);
    var matrix = buildMatrix(sorted, tantos);

    var confirmed = 0;
    var openN = 0;
    var urgentN = 0;
    sorted.forEach(function (s) {
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      if (isOpen) openN++;
      else confirmed++;
      if (s.urgent && isOpen) urgentN++;
    });

    var matrixRows = matrix.slots
      .map(function (slot) {
        var sk = slot.start + "–" + slot.end;
        var tds = matrix.tantos
          .map(function (t) {
            var list = (matrix.cells[sk] && matrix.cells[sk][t]) || [];
            if (!list.length) {
              return '<td class="empty">—</td>';
            }
            var inner = list
              .map(function (s) {
                var isOpen = !s.user_id || s.user_id === "open" || s.open;
                var name = isOpen
                  ? (s.urgent ? "⚡急募" : "募集") +
                    " " +
                    (s.slots_filled || 0) +
                    "/" +
                    (s.slots_needed || 1)
                  : esc(userName(map, s.user_id));
                var cls = s.urgent && isOpen ? "cell-urgent" : isOpen ? "cell-open" : "cell-ok";
                return '<div class="cell-person ' + cls + '">' + name + "</div>";
              })
              .join("");
            return "<td>" + inner + "</td>";
          })
          .join("");
        return (
          "<tr><th class=\"time-col\">" +
          esc(slot.start) +
          " – " +
          esc(slot.end) +
          "</th>" +
          tds +
          "</tr>"
        );
      })
      .join("");

    var matrixHead =
      "<tr><th class=\"time-col\">時間</th>" +
      matrix.tantos
        .map(function (t) {
          return "<th>" + esc(t) + "</th>";
        })
        .join("") +
      "</tr>";

    var listRows = sorted
      .map(function (s, i) {
        var isOpen = !s.user_id || s.user_id === "open" || s.open;
        var name = isOpen
          ? (s.urgent ? "⚡急募" : "募集中") +
            " " +
            (s.slots_filled || 0) +
            "/" +
            (s.slots_needed || 1)
          : esc(userName(map, s.user_id));
        var st = statusLabel(s);
        var stClass = s.urgent && isOpen ? "st-urgent" : isOpen ? "st-open" : "st-ok";
        return (
          "<tr>" +
          "<td class=\"num\">" +
          (i + 1) +
          "</td>" +
          "<td class=\"time\">" +
          esc(s.time_start) +
          " – " +
          esc(s.time_end) +
          "</td>" +
          "<td>" +
          name +
          "</td>" +
          "<td>" +
          esc(s.tanto || "—") +
          "</td>" +
          '<td class="' +
          stClass +
          '">' +
          esc(st) +
          "</td>" +
          "<td class=\"note\">" +
          esc(s.note || "") +
          "</td>" +
          "</tr>"
        );
      })
      .join("");

    var byPerson = {};
    sorted.forEach(function (s) {
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      if (isOpen) return;
      var id = s.user_id;
      if (!byPerson[id]) byPerson[id] = [];
      byPerson[id].push(s);
    });
    var personBlocks = Object.keys(byPerson)
      .sort(function (a, b) {
        var na = userName(map, a);
        var nb = userName(map, b);
        return na < nb ? -1 : na > nb ? 1 : 0;
      })
      .map(function (id) {
        var items = byPerson[id]
          .map(function (s) {
            return (
              "<li><span class=\"t\">" +
              esc(s.time_start) +
              "–" +
              esc(s.time_end) +
              "</span> " +
              esc(s.tanto || "") +
              (s.note ? " <span class=\"n\">(" + esc(s.note) + ")</span>" : "") +
              "</li>"
            );
          })
          .join("");
        return (
          '<div class="person-card"><h3>' +
          esc(userName(map, id)) +
          '</h3><ul>' +
          items +
          "</ul></div>"
        );
      })
      .join("");

    var generated = new Date().toLocaleString("ja-JP");

    return (
      "<!DOCTYPE html><html lang=\"ja\"><head><meta charset=\"UTF-8\">" +
      "<title>G⁵ シフト表 " +
      esc(EVENT_DATE_LABEL) +
      "</title>" +
      "<style>" +
      "*{box-sizing:border-box;margin:0;padding:0}" +
      "body{font-family:'Hiragino Sans','Noto Sans JP','Yu Gothic',Meiryo,sans-serif;color:#1a1520;background:#fff;padding:24px 28px;font-size:12px;line-height:1.45}" +
      ".sheet-header{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:3px solid #7c3aed;padding-bottom:12px;margin-bottom:18px}" +
      ".sheet-header h1{font-size:22px;font-weight:700;letter-spacing:0.04em;color:#2e1065}" +
      ".sheet-header .meta{text-align:right;color:#64748b;font-size:11px}" +
      ".sheet-header .date{font-size:15px;font-weight:600;color:#5b21b6;margin-bottom:2px}" +
      ".stats{display:flex;gap:10px;flex-wrap:wrap;margin-bottom:18px}" +
      ".stat{background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;padding:8px 14px;min-width:90px}" +
      ".stat .v{font-size:18px;font-weight:700;color:#5b21b6}" +
      ".stat .l{font-size:10px;color:#64748b}" +
      ".stat.warn .v{color:#c2410c}" +
      ".stat.ok .v{color:#047857}" +
      "h2{font-size:14px;color:#4c1d95;margin:20px 0 8px;padding-left:8px;border-left:4px solid #a78bfa}" +
      "table.matrix,table.list{width:100%;border-collapse:collapse;margin-bottom:8px}" +
      "table.matrix th,table.matrix td,table.list th,table.list td{border:1px solid #e2e8f0;padding:6px 8px;vertical-align:top}" +
      "table.matrix th,table.list th{background:#f3e8ff;color:#4c1d95;font-weight:600;font-size:11px}" +
      "table.matrix .time-col,table.list .time{white-space:nowrap;font-weight:600;background:#faf5ff}" +
      ".cell-person{padding:2px 0;font-size:11px}" +
      ".cell-ok{color:#065f46}" +
      ".cell-open{color:#b45309}" +
      ".cell-urgent{color:#b91c1c;font-weight:600}" +
      "td.empty{color:#cbd5e1;text-align:center}" +
      ".st-ok{color:#047857;font-weight:600}" +
      ".st-open{color:#c2410c}" +
      ".st-urgent{color:#b91c1c;font-weight:700}" +
      ".note{color:#64748b;font-size:10px;max-width:160px}" +
      ".num{width:28px;text-align:center;color:#94a3b8}" +
      ".person-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin-top:8px}" +
      ".person-card{border:1px solid #e9d5ff;border-radius:10px;padding:10px 12px;background:#faf5ff}" +
      ".person-card h3{font-size:12px;color:#5b21b6;margin-bottom:6px;border-bottom:1px solid #e9d5ff;padding-bottom:4px}" +
      ".person-card ul{list-style:none}" +
      ".person-card li{font-size:11px;padding:2px 0}" +
      ".person-card .t{font-weight:600;color:#334155}" +
      ".person-card .n{color:#94a3b8}" +
      ".footer{margin-top:24px;padding-top:10px;border-top:1px solid #e2e8f0;font-size:10px;color:#94a3b8;display:flex;justify-content:space-between}" +
      "@media print{body{padding:12mm 10mm} .no-print{display:none!important} @page{size:A4 landscape;margin:10mm}}" +
      ".toolbar{margin-bottom:16px;display:flex;gap:8px;flex-wrap:wrap}" +
      ".toolbar button{padding:8px 16px;border-radius:8px;border:1px solid #7c3aed;background:#7c3aed;color:#fff;font-weight:600;cursor:pointer;font-size:13px}" +
      ".toolbar button.ghost{background:#fff;color:#7c3aed}" +
      "</style></head><body>" +
      '<div class="toolbar no-print">' +
      '<button type="button" onclick="window.print()">印刷 / PDF保存</button>' +
      '<button type="button" class="ghost" onclick="window.close()">閉じる</button>' +
      "<span style=\"align-self:center;color:#64748b;font-size:12px\">※ 印刷ダイアログで「PDFに保存」を選んでください</span>" +
      "</div>" +
      '<header class="sheet-header"><div><h1>G⁵ Portal シフト表</h1><div style="color:#64748b;font-size:11px">5年G組スタッフ</div></div>' +
      '<div class="meta"><div class="date">' +
      esc(EVENT_DATE_LABEL) +
      "</div><div>生成: " +
      esc(generated) +
      "</div></div></header>" +
      '<div class="stats">' +
      '<div class="stat"><div class="v">' +
      sorted.length +
      '</div><div class="l">総枠数</div></div>' +
      '<div class="stat ok"><div class="v">' +
      confirmed +
      '</div><div class="l">確定</div></div>' +
      '<div class="stat warn"><div class="v">' +
      openN +
      '</div><div class="l">未割当・募集</div></div>' +
      '<div class="stat warn"><div class="v">' +
      urgentN +
      '</div><div class="l">急募中</div></div>' +
      "</div>" +
      "<h2>役割 × 時間帯マトリクス</h2>" +
      '<table class="matrix"><thead>' +
      matrixHead +
      "</thead><tbody>" +
      (matrixRows || '<tr><td colspan="99">データなし</td></tr>') +
      "</tbody></table>" +
      "<h2>一覧表</h2>" +
      '<table class="list"><thead><tr><th>#</th><th>時間</th><th>担当</th><th>役割</th><th>状態</th><th>メモ</th></tr></thead><tbody>' +
      (listRows || '<tr><td colspan="6">データなし</td></tr>') +
      "</tbody></table>" +
      "<h2>担当者別</h2>" +
      '<div class="person-grid">' +
      (personBlocks || '<p style="color:#94a3b8">確定シフトがありません</p>') +
      "</div>" +
      '<footer class="footer"><span>G⁵ Portal · 内部資料</span><span>' +
      esc(EVENT_DATE_LABEL) +
      "</span></footer>" +
      "</body></html>"
    );
  }

  function openSheetWindow(html) {
    var w = window.open("", "_blank", "noopener,noreferrer,width=1100,height=800");
    if (!w) {
      alert("ポップアップがブロックされました。許可してから再度実行してください。");
      return null;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    return w;
  }

  function downloadHtml(html, filename) {
    var blob = new Blob([html], { type: "text/html;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = filename || "shift_sheet.html";
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
    }, 2000);
  }

  /**
   * @param {object} opts
   * @param {array} opts.shifts
   * @param {array} opts.users
   * @param {array} [opts.tantoOptions]
   * @param {'preview'|'html'} [opts.mode]
   */
  function exportShiftSheet(opts) {
    opts = opts || {};
    var shifts = opts.shifts || [];
    var users = opts.users || [];
    var html = buildDocumentHtml(shifts, users, {
      tantoOptions: opts.tantoOptions
    });
    if (opts.mode === "html") {
      downloadHtml(html, "G5_shift_" + (opts.date || "2026-09-12") + ".html");
      return;
    }
    var w = openSheetWindow(html);
    if (w) {
      setTimeout(function () {
        try {
          w.focus();
        } catch (e) {}
      }, 200);
    }
  }

  window.G5AdminExport = {
    exportShiftSheet: exportShiftSheet,
    buildDocumentHtml: buildDocumentHtml
  };
})();
