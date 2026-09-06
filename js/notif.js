/**
 * G⁵ Portal - notifications
 * - サイト内ベルパネル
 * - Browser Push (Notification API / SW)
 * - サーバ通知 (notifications.json) のポーリング
 * - シフト間近・急募開始/終了
 * - LIFF 環境なら liff 経由の表示も試行
 */
(function () {
  "use strict";
  var NEAR_KEY = "g5_notified_near";
  var URGENT_KEY = "g5_notified_urgent_filled";
  var URGENT_OPEN_KEY = "g5_notified_urgent_open";
  var READ_KEY = "g5_notif_read";
  var POLL_MS = 25000;
  var pollTimer = null;
  var lastServerIds = {};

  function getList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  }
  function setList(key, arr) {
    localStorage.setItem(key, JSON.stringify(arr.slice(-120)));
  }
  function getReadSet() {
    var arr = getList(READ_KEY);
    var o = {};
    arr.forEach(function (id) {
      o[id] = true;
    });
    return o;
  }
  function markRead(id) {
    var arr = getList(READ_KEY);
    if (arr.indexOf(id) === -1) {
      arr.push(id);
      setList(READ_KEY, arr);
    }
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

  function addToPanel(msg, id, meta) {
    var list = document.getElementById("notif-list");
    if (!list) return;
    if (id) {
      var exists = list.querySelector('[data-id="' + id.replace(/"/g, "") + '"]');
      if (exists) return;
    }
    var li = document.createElement("li");
    li.dataset.id = id || "";
    if (meta && meta.type) li.dataset.type = meta.type;
    var time = meta && meta.created_at ? new Date(meta.created_at) : new Date();
    var title = meta && meta.title ? "<strong>" + escapeHtml(meta.title) + "</strong><br>" : "";
    li.innerHTML =
      title +
      "<span>" +
      escapeHtml(msg) +
      "</span><time>" +
      time.toLocaleString("ja-JP", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" }) +
      "</time>";
    if (meta && meta.link) {
      li.style.cursor = "pointer";
      li.addEventListener("click", function () {
        markRead(id);
        location.href = meta.link;
      });
    }
    list.prepend(li);
    while (list.children.length > 30) list.lastChild.remove();
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
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

  function showPush(title, body, opts) {
    opts = opts || {};
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;
    try {
      var n = new Notification(title || "G⁵ Portal", {
        body: body || "",
        icon: (window.G5 && G5.BASE ? G5.BASE + "/" : "") + "icons/icon-192.png",
        badge: (window.G5 && G5.BASE ? G5.BASE + "/" : "") + "icons/icon-192.png",
        tag: opts.tag || "g5-" + Date.now(),
        data: opts.data || {}
      });
      n.onclick = function () {
        window.focus();
        if (opts.link) location.href = opts.link;
        n.close();
      };
    } catch (e) {}
    /* Service Worker 経由（PWA） */
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(function (reg) {
          if (reg.showNotification) {
            return reg.showNotification(title || "G⁵ Portal", {
              body: body || "",
              icon: "icons/icon-192.png",
              tag: opts.tag || "g5-sw-" + Date.now(),
              data: opts.data || {}
            });
          }
        })
        .catch(function () {});
    }
    /* LIFF 内ならコンソールのみ（チャネル未設定時は noop） */
    try {
      if (window.liff && typeof window.liff.isInClient === "function" && window.liff.isInClient()) {
        /* LINE 内ブラウザ: Notification が制限される場合があるためパネル優先 */
      }
    } catch (e) {}
  }

  function isTargetedToMe(n, session) {
    if (!session) return false;
    var to = n.to;
    if (to === "all" || to == null) return true;
    if (to === "students") return session.role === "student" || session.role === "temporary";
    if (to === "staff") return ["admin", "teacher", "temporary"].indexOf(session.role) !== -1;
    if (Array.isArray(to)) return to.indexOf(session.id) !== -1;
    return to === session.id;
  }

  /** サーバ通知を取得してパネル＆プッシュ */
  async function pollServerNotifications() {
    var session = window.G5 && G5.getSession && G5.getSession();
    if (!session) {
      updateBadge(countUnreadInPanel());
      return;
    }
    var list;
    try {
      if (window.G5Api) list = await G5Api.fetchJson("src/data/notifications.json");
      else {
        var base = (window.G5 && G5.BASE) || ".";
        var res = await fetch(base + "/src/data/notifications.json?t=" + Date.now());
        list = await res.json();
      }
    } catch (e) {
      return;
    }
    if (!Array.isArray(list)) list = [];
    var read = getReadSet();
    var unread = 0;
    /* 新しい順 */
    list
      .slice()
      .sort(function (a, b) {
        return (b.created_at || "").localeCompare(a.created_at || "");
      })
      .forEach(function (n) {
        if (!n || !n.id) return;
        if (!isTargetedToMe(n, session)) return;
        if (!read[n.id]) unread++;
        addToPanel(n.body || n.title || "", n.id, {
          title: n.title,
          type: n.type,
          created_at: n.created_at,
          link: n.link
        });
        if (!lastServerIds[n.id] && !read[n.id]) {
          /* 初回検知のみプッシュ */
          if (n.type === "urgent" || n.type === "direct" || n.type === "broadcast") {
            showPush(n.title || "G⁵ Portal", n.body || "", {
              tag: "g5-n-" + n.id,
              link: n.link,
              data: { id: n.id }
            });
          }
        }
        lastServerIds[n.id] = true;
      });
    updateBadge(unread + countLocalNear());
  }

  function countUnreadInPanel() {
    var read = getReadSet();
    var list = document.getElementById("notif-list");
    if (!list) return 0;
    var c = 0;
    list.querySelectorAll("li[data-id]").forEach(function (li) {
      var id = li.dataset.id;
      if (id && !read[id]) c++;
    });
    return c;
  }

  var localNearCount = 0;
  function countLocalNear() {
    return localNearCount;
  }

  function checkNearShifts(shifts, session) {
    if (!shifts || !session) {
      localNearCount = 0;
      updateBadge(countUnreadInPanel());
      return;
    }
    var notified = getList(NEAR_KEY);
    var nearCount = 0;
    shifts.forEach(function (s) {
      if (s.status !== "シフト間近") return;
      var assignees = s.assignees || [];
      if (s.user_id !== session.id && assignees.indexOf(session.id) === -1) return;
      nearCount++;
      var key = s.shift_id + "_" + (s.date || "") + "_" + s.time_start;
      if (notified.indexOf(key) === -1) {
        notified.push(key);
        var msg = "まもなくシフト開始（10分前）: " + s.time_start + "–" + s.time_end + "（" + (s.tanto || "") + "）";
        addToPanel(msg, "near_" + key, { title: "シフト間近", type: "near" });
        showPush("G⁵ Portal シフト間近", msg, { tag: "near-" + key });
        requestPermission();
      }
    });
    setList(NEAR_KEY, notified);
    localNearCount = nearCount;
    updateBadge(nearCount + countUnreadInPanel());
  }

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
    addToPanel(msg, key, { title: "急募終了", type: "urgent" });
    showPush("G⁵ Portal 急募終了", msg, { tag: key });
    requestPermission();
  }

  function checkUrgentFilled(shifts, session) {
    if (!shifts) return;
    var notified = getList(URGENT_KEY);
    shifts.forEach(function (s) {
      var filled = s.slots_filled || (s.assignees && s.assignees.length) || 0;
      var needed = s.slots_needed || 1;
      if (filled < needed) return;
      var key = "filled_" + s.shift_id;
      if (notified.indexOf(key) !== -1) return;
      if (session) {
        var target = s.target;
        if (target && target !== "all") {
          var arr = Array.isArray(target) ? target : [target];
          if (arr.indexOf(session.id) === -1) return;
        }
      }
      notified.push(key);
      var msg = "急募終了: " + (s.time_start || "") + "–" + (s.time_end || "") + "（" + (s.tanto || "") + "）";
      addToPanel(msg, key, { title: "急募終了", type: "urgent" });
      showPush("G⁵ Portal 急募終了", msg, { tag: key });
    });
    setList(URGENT_KEY, notified);
  }

  /** 急募「開始」をローカルでも検知（サーバ通知と併用） */
  function checkUrgentOpened(shifts, session) {
    if (!shifts || !session) return;
    var notified = getList(URGENT_OPEN_KEY);
    shifts.forEach(function (s) {
      if (!s.urgent || !s.open) return;
      var key = "open_" + s.shift_id;
      if (notified.indexOf(key) !== -1) return;
      var target = s.target;
      if (target && target !== "all") {
        var arr = Array.isArray(target) ? target : [target];
        if (arr.indexOf(session.id) === -1) return;
      }
      notified.push(key);
      var msg =
        "急募: " +
        (s.time_start || "") +
        "–" +
        (s.time_end || "") +
        "（" +
        (s.tanto || "") +
        "）募集中";
      addToPanel(msg, key, { title: "急募のお知らせ", type: "urgent", link: "shift.html" });
      showPush("G⁵ Portal 急募", msg, { tag: key, link: "shift.html" });
      requestPermission();
    });
    setList(URGENT_OPEN_KEY, notified);
  }

  /**
   * 通知をサーバに追加（admin/teacher 用）
   * to: "all" | "students" | string[] | string
   */
  async function sendNotification(payload) {
    if (!window.G5Api) throw new Error("G5Api required");
    var session = G5.getSession();
    if (!session) throw new Error("ログインが必要です");
    var item = {
      id: G5Api.uid("n"),
      from_id: session.id,
      from_name: session.name || session.id,
      to: payload.to == null ? "all" : payload.to,
      title: payload.title || "お知らせ",
      body: payload.body || "",
      type: payload.type || "broadcast",
      link: payload.link || "",
      created_at: new Date().toISOString()
    };
    await G5Api.updateJson(
      "src/data/notifications.json",
      function (list) {
        if (!Array.isArray(list)) list = [];
        list.push(item);
        /* 直近 200 件保持 */
        if (list.length > 200) list = list.slice(-200);
        return list;
      },
      "notif: " + item.title
    );
    return item;
  }

  function initBell() {
    var bell = document.getElementById("notif-bell");
    var panel = document.getElementById("notif-panel");
    if (!bell || !panel) return;
    bell.addEventListener("click", function (e) {
      e.stopPropagation();
      panel.hidden = !panel.hidden;
      if (!panel.hidden) {
        requestPermission();
        pollServerNotifications();
        /* 開いたら表示中を既読に */
        var list = document.getElementById("notif-list");
        if (list) {
          list.querySelectorAll("li[data-id]").forEach(function (li) {
            if (li.dataset.id) markRead(li.dataset.id);
          });
          updateBadge(countLocalNear());
        }
      }
    });
    document.addEventListener("click", function () {
      panel.hidden = true;
    });
    panel.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  function startPolling() {
    if (pollTimer) return;
    pollServerNotifications();
    pollTimer = setInterval(pollServerNotifications, POLL_MS);
  }

  window.G5Notif = {
    checkNearShifts: checkNearShifts,
    checkUrgentFilled: checkUrgentFilled,
    checkUrgentOpened: checkUrgentOpened,
    notifyUrgentFilled: notifyUrgentFilled,
    requestPermission: requestPermission,
    updateBadge: updateBadge,
    addToPanel: addToPanel,
    showPush: showPush,
    sendNotification: sendNotification,
    pollServerNotifications: pollServerNotifications,
    startPolling: startPolling,
    markRead: markRead
  };

  function boot() {
    initBell();
    startPolling();
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
