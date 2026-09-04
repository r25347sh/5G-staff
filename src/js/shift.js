/**
 * G⁵ Portal - shift.js
 * 日付は 2026-09-12 固定（時間のみ）
 * 間近 = 開始10分前 / 急募（対象・人数・満了通知）
 */
(function () {
  "use strict";
  var BASE = (window.G5 && G5.BASE) || ".";
  var NEAR_MINUTES = 10;
  var EVENT_DATE = "2026-09-12";
  var EVENT_LABEL = "9/12";

  function parseTime(dateStr, timeStr) {
    var parts = (timeStr || "00:00").split(":").map(Number);
    var d = new Date((dateStr || EVENT_DATE) + "T00:00:00+09:00");
    d.setHours(parts[0] || 0, parts[1] || 0, 0, 0);
    return d;
  }

  function getStatus(shift, now) {
    var isOpen = !shift.user_id || shift.user_id === "open" || shift.open;
    if (isOpen) {
      if (shift.slots_filled >= (shift.slots_needed || 1)) return "急募終了";
      return shift.urgent ? "急募中" : "募集中";
    }
    var start = parseTime(shift.date || EVENT_DATE, shift.time_start);
    var end = parseTime(shift.date || EVENT_DATE, shift.time_end);
    var near = new Date(start.getTime() - NEAR_MINUTES * 60 * 1000);
    if (now < near) return "シフト外";
    if (now < start) return "シフト間近";
    if (now < end) return "シフト中";
    return "シフト終了";
  }

  function statusClass(s) {
    if (s === "シフト中") return "st-active";
    if (s === "シフト間近") return "st-near";
    if (s === "シフト終了") return "st-done";
    if (s === "急募中") return "st-urgent";
    if (s === "募集中") return "st-open";
    if (s === "急募終了") return "st-done";
    return "st-out";
  }

  async function loadUsers() {
    var res = await fetch(BASE + "/src/data/users.json?t=" + Date.now());
    return await res.json();
  }

  async function loadShifts() {
    var res = await fetch(BASE + "/src/data/shift.json?t=" + Date.now());
    return await res.json();
  }

  function escapeHtml(str) {
    if (str == null) return "";
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function isTargetedTo(shift, userId) {
    if (!shift.target || shift.target === "all" || !shift.target.length) return true;
    if (Array.isArray(shift.target)) return shift.target.indexOf(userId) !== -1;
    return shift.target === userId;
  }

  function render(shifts, users, filterUserId) {
    var map = Object.fromEntries(users.map(function (u) { return [u.id, u]; }));
    var now = new Date();
    var list = shifts.map(function (s) {
      var u = map[s.user_id] || {};
      var status = getStatus(s, now);
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      var filled = s.slots_filled || (s.assignees ? s.assignees.length : 0) || 0;
      var needed = s.slots_needed || 1;
      var displayName;
      if (isOpen) {
        displayName = (s.urgent ? "急募" : "募集") + "（" + filled + "/" + needed + "）";
      } else {
        displayName = u.name || u.id || s.user_id;
      }
      return Object.assign({}, s, {
        displayName: displayName,
        status: status,
        statusClass: statusClass(status),
        isOpen: isOpen,
        slots_filled: filled,
        slots_needed: needed
      });
    });

    if (filterUserId) {
      list = list.filter(function (s) {
        if (s.user_id === filterUserId) return true;
        if (s.isOpen && isTargetedTo(s, filterUserId) && s.status !== "急募終了") return true;
        if (s.assignees && s.assignees.indexOf(filterUserId) !== -1) return true;
        return false;
      });
    }

    list.sort(function (a, b) {
      var da = (a.date || EVENT_DATE) + a.time_start;
      var db = (b.date || EVENT_DATE) + b.time_start;
      if (da < db) return -1;
      if (da > db) return 1;
      if (a.isOpen !== b.isOpen) return a.isOpen ? -1 : 1;
      return 0;
    });

    var container = document.getElementById("shift-list");
    if (!container) return list;

    if (!list.length) {
      container.innerHTML = '<p class="empty-msg">シフトがありません</p>';
      return list;
    }

    var session = (window.G5 && G5.getSession()) || null;
    var html = '<div class="shift-table-wrap"><table class="shift-table">';
    html += '<thead><tr>';
    html += '<th class="col-time">時間</th>';
    html += '<th class="col-name">担当</th>';
    html += '<th class="col-tanto">役割</th>';
    html += '<th class="col-status">状態</th>';
    html += '<th class="col-note">メモ / 対象</th>';
    html += '<th class="col-act"></th>';
    html += '</tr></thead><tbody>';

    list.forEach(function (s) {
      var claimBtn = "";
      if (s.isOpen && s.status !== "急募終了") {
        var canClaim = true;
        if (session && !isTargetedTo(s, session.id)) canClaim = false;
        if (!session) canClaim = false;
        if (canClaim) {
          claimBtn =
            '<button type="button" class="btn btn-claim btn-claim-sm" data-shift-id="' +
            escapeHtml(s.shift_id) +
            '">応募</button>';
        } else if (!session && s.isOpen) {
          claimBtn = '<span class="hint-login">ログインで応募</span>';
        }
      }

      var noteParts = [];
      if (s.note) noteParts.push(escapeHtml(s.note));
      if (s.isOpen) {
        if (s.target && s.target !== "all") {
          var names = (Array.isArray(s.target) ? s.target : [s.target])
            .map(function (id) {
              return (map[id] && map[id].name) || id;
            })
            .join(", ");
          noteParts.push("対象: " + escapeHtml(names));
        } else {
          noteParts.push("対象: 全員");
        }
        noteParts.push(s.slots_filled + "/" + s.slots_needed + "人");
      }
      if (s.assignees && s.assignees.length) {
        var an = s.assignees
          .map(function (id) {
            return (map[id] && map[id].name) || id;
          })
          .join(", ");
        noteParts.push("応募: " + escapeHtml(an));
      }

      html +=
        '<tr class="shift-row ' +
        s.statusClass +
        (s.urgent ? " is-urgent" : "") +
        '" data-shift-id="' +
        escapeHtml(s.shift_id) +
        '">' +
        '<td class="col-time"><span class="time">' +
        escapeHtml(s.time_start) +
        " – " +
        escapeHtml(s.time_end) +
        "</span></td>" +
        '<td class="col-name">' +
        escapeHtml(s.displayName) +
        "</td>" +
        '<td class="col-tanto"><span class="badge-tanto">' +
        escapeHtml(s.tanto || "—") +
        "</span></td>" +
        '<td class="col-status"><span class="status-pill">' +
        escapeHtml(s.status) +
        "</span></td>" +
        '<td class="col-note">' +
        (noteParts.length ? noteParts.join(" · ") : "—") +
        "</td>" +
        '<td class="col-act">' +
        claimBtn +
        "</td>" +
        "</tr>";
    });

    html += "</tbody></table></div>";
    container.innerHTML = html;
    return list;
  }

  async function refresh() {
    try {
      var pair = await Promise.all([loadShifts(), loadUsers()]);
      var session = (window.G5 && G5.getSession()) || null;
      var chk = document.getElementById("filter-mine");
      var filter = chk && chk.checked && session ? session.id : null;
      var list = render(pair[0], pair[1], filter);
      window.__g5_shifts = list;
      window.__g5_users = pair[1];
      window.__g5_raw_shifts = pair[0];
      if (window.G5Notif) {
        G5Notif.checkNearShifts(list, session);
        G5Notif.checkUrgentFilled && G5Notif.checkUrgentFilled(pair[0], session);
      }
      bindClaimButtons();
    } catch (e) {
      console.error(e);
      var c = document.getElementById("shift-list");
      if (c) c.innerHTML = '<p class="empty-msg">読み込みに失敗しました</p>';
    }
  }

  function bindClaimButtons() {
    var container = document.getElementById("shift-list");
    if (!container) return;
    container.querySelectorAll(".btn-claim").forEach(function (btn) {
      btn.onclick = function () {
        claimShift(btn.getAttribute("data-shift-id"));
      };
    });
  }

  async function apiPutShifts(shifts, message) {
    var token = G5.loadTokenAsync ? await G5.loadTokenAsync() : (G5.getToken && G5.getToken());
    if (!token) throw new Error("token unavailable");
    var REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };
    var path = "src/data/shift.json";
    var url =
      "https://api.github.com/repos/" +
      REPO.owner +
      "/" +
      REPO.repo +
      "/contents/" +
      path;
    var sha = null;
    var getRes = await fetch(url + "?ref=" + REPO.branch, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json"
      }
    });
    if (getRes.ok) sha = (await getRes.json()).sha;
    var body = {
      message: message || "update shifts",
      content: btoa(unescape(encodeURIComponent(JSON.stringify(shifts, null, 2)))),
      branch: REPO.branch
    };
    if (sha) body.sha = sha;
    var res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 150));
    return await res.json();
  }

  async function claimShift(shiftId) {
    var session = (window.G5 && G5.getSession()) || null;
    if (!session) {
      alert("応募にはログインが必要です");
      var box = document.getElementById("shift-login-box");
      if (box) box.hidden = false;
      return;
    }
    if (!confirm("この枠に応募しますか？")) return;

    try {
      var shifts = await loadShifts();
      var idx = shifts.findIndex(function (s) {
        return s.shift_id === shiftId;
      });
      if (idx < 0) {
        alert("対象シフトが見つかりません");
        return;
      }
      var s = shifts[idx];
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      if (!isOpen) {
        alert("既に担当が決まっています");
        return;
      }
      if (!isTargetedTo(s, session.id)) {
        alert("この急募の対象外です");
        return;
      }

      s.assignees = s.assignees || [];
      if (s.assignees.indexOf(session.id) !== -1) {
        alert("既に応募済みです");
        return;
      }

      var needed = s.slots_needed || 1;
      var filled = s.assignees.length;
      if (filled >= needed) {
        alert("定員に達しています（急募終了）");
        return;
      }

      s.assignees.push(session.id);
      s.slots_filled = s.assignees.length;
      s.slots_needed = needed;

      var justFilled = s.slots_filled >= needed;
      if (justFilled) {
        s.open = false;
        s.urgent = false;
        s.filled_at = new Date().toISOString();
        /* 単一枠なら user_id も埋める */
        if (needed === 1) {
          s.user_id = session.id;
        }
      }

      await apiPutShifts(
        shifts,
        "claim: " + shiftId + " by " + session.id + (justFilled ? " (filled)" : "")
      );

      if (justFilled && window.G5Notif) {
        G5Notif.notifyUrgentFilled(s);
      }

      alert(
        justFilled
          ? "応募完了。定員に達したため急募は終了しました。"
          : "応募完了（" + s.slots_filled + "/" + needed + "）"
      );
      refresh();
    } catch (e) {
      console.error(e);
      alert("応募に失敗しました: " + e.message);
    }
  }

  window.G5Shift = {
    refresh: refresh,
    getStatus: getStatus,
    loadShifts: loadShifts,
    loadUsers: loadUsers,
    EVENT_DATE: EVENT_DATE,
    EVENT_LABEL: EVENT_LABEL,
    NEAR_MINUTES: NEAR_MINUTES,
    claimShift: claimShift
  };

  if (document.getElementById("shift-list")) {
    document.addEventListener("DOMContentLoaded", function () {
      refresh();
      setInterval(refresh, 30000);
      var chk = document.getElementById("filter-mine");
      if (chk) chk.addEventListener("change", refresh);
    });
  }
})();
