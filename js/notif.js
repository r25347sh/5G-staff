/**
 * G⁵ Portal - notification
 * シフト間近（開始10分前）サイト内 + プッシュ
 * 急募終了通知
 */
(function () {
  "use strict";
  var NEAR_KEY = "g5_notified_near";
  var URGENT_KEY = "g5_notified_urgent_filled";

  function getList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  }
  function setList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr.slice(-80)));
  }

  function updateBadge(count) {
    var badge = document.getElementById("notif-badge");
    if (!badge) return;
    if (count > 0) {
      badge.textContent = count > 9 ? "9+" : String(count);
      badge.hidden = false;
    } else {
      badge.hidden = true;
    }
  }

  function addToPanel(msg, id) {
    var list = document.getElementById("notif-list");
    if (!list) return;
    var li = document.createElement("li");
    li.dataset.id = id || "";
    li.innerHTML =
      "<span>" +
      msg +
      "</span><time>" +
      new Date().toLocaleTimeString("ja-JP") +
      "</time>";
    list.prepend(li);
    while (list.children.length > 20) list.lastChild.remove();
  }

  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      var p = await Notification.requestPermission();
      return p === "granted";
    }
    return false;
  }

  function showPush(title, body) {
    if (!("Notification" in window)) return;
    if (Notification.permission === "granted") {
      try {
        new Notification(title, {
          body: body,
          icon: "icons/icon-192.png",
          tag: "g5-" + Date.now()
        });
      } catch (e) {}
    }
  }

  /** シフト間近（10分前） */
  function checkNearShifts(shifts, session) {
    if (!shifts) {
      updateBadge(0);
      return;
    }
    var notified = getList(NEAR_KEY);
    var nearCount = 0;

    shifts.forEach(function (s) {
      if (s.status !== "シフト間近") return;
      if (session && s.user_id !== session.id) {
        /* 担当者以外はスキップ（assignees も見る） */
        var assignees = s.assignees || [];
        if (assignees.indexOf(session.id) === -1 && s.user_id !== session.id) return;
      }
      if (!session) return;

      nearCount++;
      var key = s.shift_id + "_" + (s.date || "") + "_" + s.time_start;
      if (notified.indexOf(key) === -1) {
        notified.push(key);
        var msg =
          "まもなくシフト開始（10分前）: " +
          s.time_start +
          "（" +
          (s.tanto || "") +
          "）";
        addToPanel(msg, key);
        showPush("G⁵ Portal シフト間近", "開始10分前: " + s.time_start + " " + (s.tanto || ""));
      }
    });

    setList(NEAR_KEY, notified);
    updateBadge(nearCount);
  }

  /** 急募が定員に達したときの通知 */
  function notifyUrgentFilled(shift) {
    var key = "filled_" + (shift.shift_id || "");
    var notified = getList(URGENT_KEY);
    if (notified.indexOf(key) !== -1) return;
    notified.push(key);
    setList(URGENT_KEY, notified);

    var msg =
      "急募終了: " +
      (shift.time_start || "") +
      "–" +
      (shift.time_end || "") +
      "（" +
      (shift.tanto || "") +
      "）定員に達しました";
    addToPanel(msg, key);
    showPush("G⁵ Portal 急募終了", msg);
    requestPermission();
  }

  function checkUrgentFilled(shifts, session) {
    if (!shifts) return;
    var notified = getList(URGENT_KEY);
    shifts.forEach(function (s) {
      var filled = s.slots_filled || (s.assignees && s.assignees.length) || 0;
      var needed = s.slots_needed || 1;
      if (!s.filled_at && filled < needed) return;
      if (filled < needed) return;
      var key = "filled_" + s.shift_id;
      if (notified.indexOf(key) !== -1) return;
      /* 対象者 or 全員に通知 */
      if (session) {
        var target = s.target;
        if (target && target !== "all") {
          var arr = Array.isArray(target) ? target : [target];
          if (arr.indexOf(session.id) === -1) return;
        }
      }
      notified.push(key);
      var msg =
        "急募終了: " +
        (s.time_start || "") +
        "–" +
        (s.time_end || "") +
        "（" +
        (s.tanto || "") +
        "）";
      addToPanel(msg, key);
      showPush("G⁵ Portal 急募終了", msg);
    });
    setList(URGENT_KEY, notified);
  }

  function initBell() {
    var bell = document.getElementById("notif-bell");
    var panel = document.getElementById("notif-panel");
    if (!bell || !panel) return;
    bell.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) requestPermission();
    });
    document.addEventListener("click", function () {
      panel.hidden = true;
    });
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  window.G5Notif = {
    checkNearShifts: checkNearShifts,
    checkUrgentFilled: checkUrgentFilled,
    notifyUrgentFilled: notifyUrgentFilled,
    requestPermission: requestPermission,
    updateBadge: updateBadge,
    addToPanel: addToPanel,
    showPush: showPush
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initBell);
  } else {
    initBell();
  }
})();
