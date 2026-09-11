/**
 * G⁵ Portal - admin tools（検索・分析・ユーティリティ）
 * admin / teacher 専用。shiftsCache / usersCache を参照
 */
(function () {
  "use strict";

  function esc(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function toMin(t) {
    if (!t) return 0;
    var p = String(t).split(":");
    return (parseInt(p[0], 10) || 0) * 60 + (parseInt(p[1], 10) || 0);
  }

  function overlaps(a, b) {
    return toMin(a.time_start) < toMin(b.time_end) && toMin(b.time_start) < toMin(a.time_end);
  }

  function isOpen(s) {
    return !s.user_id || s.user_id === "open" || s.open;
  }

  function userMap(users) {
    var m = {};
    (users || []).forEach(function (u) {
      m[u.id] = u;
    });
    return m;
  }

  function nameOf(map, id) {
    if (!id || id === "open") return "—";
    return (map[id] && (map[id].name || map[id].id)) || id;
  }

  /** シフト検索 */
  function searchShifts(shifts, users, query) {
    query = query || {};
    var q = (query.q || "").trim().toLowerCase();
    var tanto = (query.tanto || "").trim();
    var status = query.status || "all";
    var tFrom = query.timeFrom || "";
    var tTo = query.timeTo || "";
    var map = userMap(users);

    return (shifts || []).filter(function (s) {
      if (tanto && (s.tanto || "") !== tanto) return false;
      var open = isOpen(s);
      if (status === "confirmed" && open) return false;
      if (status === "open" && !open) return false;
      if (status === "urgent" && !(s.urgent && open)) return false;
      if (tFrom && (s.time_end || "") <= tFrom) return false;
      if (tTo && (s.time_start || "") >= tTo) return false;
      if (!q) return true;
      var hay = [
        s.shift_id,
        s.user_id,
        nameOf(map, s.user_id),
        s.tanto,
        s.note,
        s.time_start,
        s.time_end
      ]
        .join(" ")
        .toLowerCase();
      return hay.indexOf(q) !== -1;
    });
  }

  /** ユーザー検索 */
  function searchUsers(users, shifts, query) {
    query = query || {};
    var q = (query.q || "").trim().toLowerCase();
    var role = (query.role || "").trim();
    var freeOnly = !!query.freeOnly;
    var tFrom = query.timeFrom || "";
    var tTo = query.timeTo || "";

    return (users || []).filter(function (u) {
      if (role && u.role !== role) return false;
      if (u.role === "BAN") return false;
      if (q) {
        var hay = (u.id + " " + (u.name || "") + " " + (u.role || "")).toLowerCase();
        if (hay.indexOf(q) === -1) return false;
      }
      if (freeOnly && tFrom && tTo) {
        var busy = (shifts || []).some(function (s) {
          if (isOpen(s)) return false;
          if (s.user_id !== u.id) return false;
          return toMin(s.time_start) < toMin(tTo) && toMin(tFrom) < toMin(s.time_end);
        });
        if (busy) return false;
      }
      return true;
    });
  }

  /** 役割別集計 */
  function statsByTanto(shifts) {
    var o = {};
    (shifts || []).forEach(function (s) {
      var t = s.tanto || "（未設定）";
      if (!o[t]) o[t] = { total: 0, confirmed: 0, open: 0, urgent: 0 };
      o[t].total++;
      if (isOpen(s)) {
        o[t].open++;
        if (s.urgent) o[t].urgent++;
      } else o[t].confirmed++;
    });
    return o;
  }

  /** 時間帯ギャップ（募集枠） */
  function openSlots(shifts) {
    return (shifts || [])
      .filter(function (s) {
        return isOpen(s);
      })
      .slice()
      .sort(function (a, b) {
        return (a.time_start || "").localeCompare(b.time_start || "");
      });
  }

  /** 同一ユーザーの時間重複 */
  function findOverlaps(shifts) {
    var byUser = {};
    (shifts || []).forEach(function (s) {
      if (isOpen(s) || !s.user_id) return;
      if (!byUser[s.user_id]) byUser[s.user_id] = [];
      byUser[s.user_id].push(s);
    });
    var pairs = [];
    Object.keys(byUser).forEach(function (uid) {
      var arr = byUser[uid];
      for (var i = 0; i < arr.length; i++) {
        for (var j = i + 1; j < arr.length; j++) {
          if (overlaps(arr[i], arr[j])) {
            pairs.push({ user_id: uid, a: arr[i], b: arr[j] });
          }
        }
      }
    });
    return pairs;
  }

  /** ユーザーあたりのシフト本数 */
  function loadByUser(shifts, users) {
    var map = userMap(users);
    var counts = {};
    (shifts || []).forEach(function (s) {
      if (isOpen(s) || !s.user_id) return;
      counts[s.user_id] = (counts[s.user_id] || 0) + 1;
    });
    return Object.keys(counts)
      .map(function (id) {
        return {
          id: id,
          name: nameOf(map, id),
          count: counts[id],
          role: (map[id] && map[id].role) || ""
        };
      })
      .sort(function (a, b) {
        return b.count - a.count;
      });
  }

  function renderToolsUI(root, ctx) {
    if (!root) return;
    var shifts = ctx.shifts || [];
    var users = ctx.users || [];
    var tantoOptions = ctx.tantoOptions || [];
    var map = userMap(users);

    var tantoOpts =
      '<option value="">（すべて）</option>' +
      tantoOptions
        .map(function (t) {
          return '<option value="' + esc(t) + '">' + esc(t) + "</option>";
        })
        .join("");

    root.innerHTML =
      '<div class="tools-grid">' +
      /* 検索 */
      '<section class="tools-card">' +
      "<h3>🔍 シフト検索</h3>" +
      '<div class="tools-form">' +
      '<input type="search" id="tool-shift-q" placeholder="名前・役割・メモ・ID…">' +
      '<select id="tool-shift-tanto">' +
      tantoOpts +
      "</select>" +
      '<select id="tool-shift-status">' +
      '<option value="all">状態: すべて</option>' +
      '<option value="confirmed">確定のみ</option>' +
      '<option value="open">募集中</option>' +
      '<option value="urgent">急募中</option>' +
      "</select>" +
      '<label class="tools-time">開始以降 <input type="time" id="tool-shift-from"></label>' +
      '<label class="tools-time">終了以前 <input type="time" id="tool-shift-to"></label>' +
      '<button type="button" class="btn btn-primary btn-sm" id="tool-shift-run">検索</button>' +
      "</div>" +
      '<div id="tool-shift-result" class="tools-result"></div>' +
      "</section>" +
      /* ユーザー */
      '<section class="tools-card">' +
      "<h3>👤 ユーザー検索 / 空き確認</h3>" +
      '<div class="tools-form">' +
      '<input type="search" id="tool-user-q" placeholder="名前・ID…">' +
      '<select id="tool-user-role">' +
      '<option value="">役割: すべて</option>' +
      '<option value="student">student</option>' +
      '<option value="temporary">temporary</option>' +
      '<option value="teacher">teacher</option>' +
      '<option value="admin">admin</option>' +
      "</select>" +
      '<label class="chk-label"><input type="checkbox" id="tool-user-free"> 指定時間帯が空いている人のみ</label>' +
      '<label class="tools-time">空き From <input type="time" id="tool-user-from" value="09:00"></label>' +
      '<label class="tools-time">空き To <input type="time" id="tool-user-to" value="12:00"></label>' +
      '<button type="button" class="btn btn-primary btn-sm" id="tool-user-run">検索</button>' +
      "</div>" +
      '<div id="tool-user-result" class="tools-result"></div>' +
      "</section>" +
      /* 集計 */
      '<section class="tools-card">' +
      "<h3>📊 役割別集計</h3>" +
      '<div id="tool-stats" class="tools-result"></div>' +
      '<button type="button" class="btn btn-ghost btn-sm" id="tool-stats-refresh">再集計</button>' +
      "</section>" +
      /* 未割当 */
      '<section class="tools-card">' +
      "<h3>📭 未割当・急募枠</h3>" +
      '<div id="tool-open" class="tools-result"></div>' +
      "</section>" +
      /* 重複 */
      '<section class="tools-card">' +
      "<h3>⚠️ 時間重複チェック</h3>" +
      '<p class="hint-text" style="margin-bottom:0.5rem">同一ユーザーが時間の重なるシフトに入っていないか検査します。</p>' +
      '<button type="button" class="btn btn-primary btn-sm" id="tool-overlap-run">検査する</button>' +
      '<div id="tool-overlap" class="tools-result"></div>' +
      "</section>" +
      /* 負荷 */
      '<section class="tools-card">' +
      "<h3>📈 担当本数ランキング</h3>" +
      '<div id="tool-load" class="tools-result"></div>' +
      "</section>" +
      "</div>";

    function paintShiftResult(list) {
      var el = document.getElementById("tool-shift-result");
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p class="empty-msg">該当なし</p>';
        return;
      }
      el.innerHTML =
        '<p class="tools-count">' +
        list.length +
        " 件</p><ul class=\"tools-list\">" +
        list
          .slice(0, 80)
          .map(function (s) {
            var open = isOpen(s);
            var label = open
              ? s.urgent
                ? "急募"
                : "募集"
              : esc(nameOf(map, s.user_id));
            return (
              "<li><strong>" +
              esc(s.time_start) +
              "–" +
              esc(s.time_end) +
              "</strong> " +
              label +
              " / " +
              esc(s.tanto || "—") +
              (s.note ? ' <span class="muted">(' + esc(s.note) + ")</span>" : "") +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }

    function paintUserResult(list) {
      var el = document.getElementById("tool-user-result");
      if (!el) return;
      if (!list.length) {
        el.innerHTML = '<p class="empty-msg">該当なし</p>';
        return;
      }
      el.innerHTML =
        '<p class="tools-count">' +
        list.length +
        " 人</p><ul class=\"tools-list\">" +
        list
          .slice(0, 80)
          .map(function (u) {
            return (
              "<li><strong>" +
              esc(u.name || u.id) +
              "</strong> <span class=\"muted\">" +
              esc(u.id) +
              " · " +
              esc(u.role) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>";
    }

    function paintStats() {
      var el = document.getElementById("tool-stats");
      if (!el) return;
      var st = statsByTanto(shifts);
      var keys = Object.keys(st).sort();
      if (!keys.length) {
        el.innerHTML = '<p class="empty-msg">データなし</p>';
        return;
      }
      el.innerHTML =
        '<table class="tools-table"><thead><tr><th>役割</th><th>計</th><th>確定</th><th>募集</th><th>急募</th></tr></thead><tbody>' +
        keys
          .map(function (k) {
            var r = st[k];
            return (
              "<tr><td>" +
              esc(k) +
              "</td><td>" +
              r.total +
              "</td><td>" +
              r.confirmed +
              "</td><td>" +
              r.open +
              "</td><td>" +
              r.urgent +
              "</td></tr>"
            );
          })
          .join("") +
        "</tbody></table>";
    }

    function paintOpen() {
      var el = document.getElementById("tool-open");
      if (!el) return;
      var list = openSlots(shifts);
      if (!list.length) {
        el.innerHTML = '<p class="empty-msg">未割当枠はありません</p>';
        return;
      }
      el.innerHTML =
        '<ul class="tools-list">' +
        list
          .map(function (s) {
            return (
              "<li>" +
              (s.urgent ? "⚡ " : "") +
              "<strong>" +
              esc(s.time_start) +
              "–" +
              esc(s.time_end) +
              "</strong> " +
              esc(s.tanto || "") +
              " " +
              (s.slots_filled || 0) +
              "/" +
              (s.slots_needed || 1) +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }

    function paintLoad() {
      var el = document.getElementById("tool-load");
      if (!el) return;
      var list = loadByUser(shifts, users);
      if (!list.length) {
        el.innerHTML = '<p class="empty-msg">確定シフトなし</p>';
        return;
      }
      el.innerHTML =
        '<ul class="tools-list">' +
        list
          .slice(0, 40)
          .map(function (r) {
            return (
              "<li><strong>" +
              esc(r.name) +
              "</strong> <span class=\"muted\">" +
              r.count +
              " 本 · " +
              esc(r.role) +
              "</span></li>"
            );
          })
          .join("") +
        "</ul>";
    }

    function runShiftSearch() {
      paintShiftResult(
        searchShifts(shifts, users, {
          q: (document.getElementById("tool-shift-q") || {}).value,
          tanto: (document.getElementById("tool-shift-tanto") || {}).value,
          status: (document.getElementById("tool-shift-status") || {}).value,
          timeFrom: (document.getElementById("tool-shift-from") || {}).value,
          timeTo: (document.getElementById("tool-shift-to") || {}).value
        })
      );
    }

    function runUserSearch() {
      paintUserResult(
        searchUsers(users, shifts, {
          q: (document.getElementById("tool-user-q") || {}).value,
          role: (document.getElementById("tool-user-role") || {}).value,
          freeOnly: !!(document.getElementById("tool-user-free") || {}).checked,
          timeFrom: (document.getElementById("tool-user-from") || {}).value,
          timeTo: (document.getElementById("tool-user-to") || {}).value
        })
      );
    }

    function runOverlap() {
      var el = document.getElementById("tool-overlap");
      if (!el) return;
      var pairs = findOverlaps(shifts);
      if (!pairs.length) {
        el.innerHTML = '<p class="empty-msg" style="color:var(--cyan,#67e8f9)">重複なし ✓</p>';
        return;
      }
      el.innerHTML =
        '<p class="tools-count" style="color:#f87171">' +
        pairs.length +
        " 件の重複</p><ul class=\"tools-list\">" +
        pairs
          .map(function (p) {
            return (
              "<li><strong>" +
              esc(nameOf(map, p.user_id)) +
              "</strong>: " +
              esc(p.a.time_start) +
              "–" +
              esc(p.a.time_end) +
              " と " +
              esc(p.b.time_start) +
              "–" +
              esc(p.b.time_end) +
              "</li>"
            );
          })
          .join("") +
        "</ul>";
    }

    var btnS = document.getElementById("tool-shift-run");
    if (btnS) btnS.addEventListener("click", runShiftSearch);
    var btnU = document.getElementById("tool-user-run");
    if (btnU) btnU.addEventListener("click", runUserSearch);
    var btnO = document.getElementById("tool-overlap-run");
    if (btnO) btnO.addEventListener("click", runOverlap);
    var btnSt = document.getElementById("tool-stats-refresh");
    if (btnSt)
      btnSt.addEventListener("click", function () {
        paintStats();
        paintOpen();
        paintLoad();
      });

    var qEl = document.getElementById("tool-shift-q");
    if (qEl)
      qEl.addEventListener("keydown", function (e) {
        if (e.key === "Enter") runShiftSearch();
      });

    paintStats();
    paintOpen();
    paintLoad();
  }

  /**
   * データ更新時に再描画
   */
  function refresh(ctx) {
    var root = document.getElementById("admin-tools-root");
    if (!root) return;
    renderToolsUI(root, ctx);
  }

  window.G5AdminTools = {
    searchShifts: searchShifts,
    searchUsers: searchUsers,
    statsByTanto: statsByTanto,
    openSlots: openSlots,
    findOverlaps: findOverlaps,
    loadByUser: loadByUser,
    render: refresh,
    refresh: refresh
  };
})();
