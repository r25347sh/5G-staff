/**
 * G⁵ Portal - notification
 */
(function () {
  "use strict";
  const NEAR_KEY = "g5_notified_near";
  function getNotified() {
    try { return JSON.parse(localStorage.getItem(NEAR_KEY) || "[]"); } catch { return []; }
  }
  function setNotified(arr) {
    localStorage.setItem(NEAR_KEY, JSON.stringify(arr.slice(-50)));
  }
  function updateBadge(count) {
    const badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.hidden = false;
    } else badge.hidden = true;
  }
  function addToPanel(msg, id) {
    const list = document.getElementById("notif-list");
    if (!list) return;
    const li = document.createElement("li");
    li.dataset.id = id || "";
    li.innerHTML = "<span>" + msg + "</span><time>" + new Date().toLocaleTimeString("ja-JP") + "</time>";
    list.prepend(li);
    while (list.children.length > 20) list.lastChild.remove();
  }
  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      const p = await Notification.requestPermission();
      return p === "granted";
    }
    return false;
  }
  function showPush(title, body) {
    if (Notification.permission === "granted") {
      try { new Notification(title, { body: body, icon: "icons/icon-192.png" }); } catch (e) {}
    }
  }
  function checkNearShifts(shifts, session) {
    if (!session || !shifts) { updateBadge(0); return; }
    const mine = shifts.filter(function (s) {
      return s.user_id === session.id && s.status === "シフト間近";
    });
    const notified = getNotified();
    mine.forEach(function (s) {
      const key = s.shift_id + "_" + s.date;
      if (notified.indexOf(key) === -1) {
        notified.push(key);
        addToPanel("まもなくシフト開始: " + s.date + " " + s.time_start + "（" + (s.tanto || "") + "）", key);
        showPush("G⁵ Portal シフト間近", "まもなくシフト開始: " + s.time_start);
      }
    });
    setNotified(notified);
    updateBadge(mine.length);
  }
  function initBell() {
    const bell = document.getElementById("notif-bell");
    const panel = document.getElementById("notif-panel");
    if (!bell || !panel) return;
    bell.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) requestPermission();
    });
    document.addEventListener("click", function () { panel.hidden = true; });
    panel.addEventListener("click", function (e) { e.stopPropagation(); });
  }
  window.G5Notif = { checkNearShifts: checkNearShifts, requestPermission: requestPermission, updateBadge: updateBadge };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", initBell);
  else initBell();
})();
