/**
 * G⁵ Portal - shift.js
 */
(function () {
  "use strict";
  const BASE = (window.G5 && G5.BASE) || ".";
  const NEAR_MINUTES = 45;
  function parseTime(dateStr, timeStr) {
    const parts = timeStr.split(":").map(Number);
    const d = new Date(dateStr + "T00:00:00+09:00");
    d.setHours(parts[0], parts[1] || 0, 0, 0);
    return d;
  }
  function getStatus(shift, now) {
    const start = parseTime(shift.date, shift.time_start);
    const end = parseTime(shift.date, shift.time_end);
    const near = new Date(start.getTime() - NEAR_MINUTES * 60 * 1000);
    if (now < near) return "シフト外";
    if (now < start) return "シフト間近";
    if (now < end) return "シフト中";
    return "シフト終了";
  }
  function statusClass(s) {
    if (s === "シフト中") return "st-active";
    if (s === "シフト間近") return "st-near";
    if (s === "シフト終了") return "st-done";
    return "st-out";
  }
  async function loadUsers() {
    const res = await fetch(BASE + "/src/data/users.json?t=" + Date.now());
    return await res.json();
  }
  async function loadShifts() {
    const res = await fetch(BASE + "/src/data/shift.json?t=" + Date.now());
    return await res.json();
  }
  function escapeHtml(str) {
    if (str == null) return "";
    return String(str).replace(/&/g,"&").replace(/</g,"<").replace(/>/g,">").replace(/"/g,""");
  }
  function render(shifts, users, filterUserId) {
    const map = Object.fromEntries(users.map(function (u) { return [u.id, u]; }));
    const now = new Date();
    let list = shifts.map(function (s) {
      const u = map[s.user_id] || {};
      const status = getStatus(s, now);
      return Object.assign({}, s, { displayName: u.name || u.id || s.user_id, status: status, statusClass: statusClass(status) });
    });
    if (filterUserId) list = list.filter(function (s) { return s.user_id === filterUserId; });
    list.sort(function (a, b) {
      const da = a.date + a.time_start, db = b.date + b.time_start;
      return da < db ? -1 : da > db ? 1 : 0;
    });
    const container = document.getElementById("shift-list");
    if (!container) return list;
    if (!list.length) { container.innerHTML = '<p class="empty-msg">シフトがありません</p>'; return list; }
    container.innerHTML = list.map(function (s) {
      return '<article class="shift-card ' + s.statusClass + '" data-shift-id="' + s.shift_id + '">' +
        '<div class="shift-status">' + s.status + '</div><h3>' + escapeHtml(s.displayName) + '</h3>' +
        '<p class="shift-meta"><span>' + s.date + '</span><span>' + s.time_start + ' – ' + s.time_end + '</span></p>' +
        '<p class="shift-tanto">担当: ' + escapeHtml(s.tanto || '—') + '</p></article>';
    }).join("");
    return list;
  }
  async function refresh() {
    try {
      const pair = await Promise.all([loadShifts(), loadUsers()]);
      const session = (window.G5 && G5.getSession()) || null;
      const chk = document.getElementById("filter-mine");
      const filter = chk && chk.checked && session ? session.id : null;
      const list = render(pair[0], pair[1], filter);
      window.__g5_shifts = list;
      if (window.G5Notif) G5Notif.checkNearShifts(list, session);
    } catch (e) {
      console.error(e);
      const c = document.getElementById("shift-list");
      if (c) c.innerHTML = '<p class="empty-msg">読み込みに失敗しました</p>';
    }
  }
  window.G5Shift = { refresh: refresh, getStatus: getStatus, loadShifts: loadShifts, loadUsers: loadUsers };
  if (document.getElementById("shift-list")) {
    document.addEventListener("DOMContentLoaded", function () {
      refresh();
      setInterval(refresh, 60000);
      const chk = document.getElementById("filter-mine");
      if (chk) chk.addEventListener("change", refresh);
    });
  }
})();
