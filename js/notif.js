/**
 * G⁵ Portal - notifications（確実性強化版）
 * - サイト内ベル + Browser/SW プッシュ
 * - notifications.json ポーリング（短間隔・可視時即時・オンライン復帰）
 * - 受信トレイ localStorage 永続化（再読込でも残る）
 * - 急募は admin/teacher 含む全員へ
 * - 送信リトライ
 */
(function () {
  "use strict";
  var NEAR_KEY = "g5_notified_near";
  var URGENT_KEY = "g5_notified_urgent_filled";
  var URGENT_OPEN_KEY = "g5_notified_urgent_open";
  var READ_KEY = "g5_notif_read";
  var PUSHED_KEY = "g5_notif_pushed";
  var INBOX_KEY = "g5_notif_inbox";
  var POLL_MS = 5000;
  var POLL_FAIL_MS = 15000;
  var pollTimer = null;
  var polling = false;
  var failStreak = 0;
  var bc = null;

  try {
    if (typeof BroadcastChannel !== "undefined") {
      bc = new BroadcastChannel("g5_notif");
      bc.onmessage = function (ev) {
        if (ev.data && ev.data.type === "inbox") {
          renderInboxFromStore();
          updateBadge(countUnread() + countLocalNear());
        }
      };
    }
  } catch (e) {}

  function getList(key) {
    try {
      return JSON.parse(localStorage.getItem(key) || "[]");
    } catch (e) {
      return [];
    }
  }
  function setList(key, arr) {
    try {
      localStorage.setItem(key, JSON.stringify(arr.slice(-150)));
    } catch (e) {}
  }
  function getReadSet() {
    var o = {};
    getList(READ_KEY).forEach(function (id) {
      o[id] = true;
    });
    return o;
  }
  function getPushedSet() {
    var o = {};
    getList(PUSHED_KEY).forEach(function (id) {
      o[id] = true;
    });
    return o;
  }
  function markRead(id) {
    if (!id) return;
    var arr = getList(READ_KEY);
    if (arr.indexOf(id) === -1) {
      arr.push(id);
      setList(READ_KEY, arr);
    }
    broadcastInbox();
  }
  function markPushed(id) {
    if (!id) return;
    var arr = getList(PUSHED_KEY);
    if (arr.indexOf(id) === -1) {
      arr.push(id);
      setList(PUSHED_KEY, arr);
    }
  }

  /** 永続受信トレイ */
  function loadInbox() {
    try {
      var raw = JSON.parse(localStorage.getItem(INBOX_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch (e) {
      return [];
    }
  }
  function saveInbox(items) {
    try {
      localStorage.setItem(INBOX_KEY, JSON.stringify(items.slice(0, 40)));
    } catch (e) {}
  }
  function mergeInbox(item) {
    if (!item || !item.id) return;
    var inbox = loadInbox();
    var idx = -1;
    for (var i = 0; i < inbox.length; i++) {
      if (inbox[i].id === item.id) {
        idx = i;
        break;
      }
    }
    if (idx >= 0) inbox[idx] = item;
    else inbox.unshift(item);
    saveInbox(inbox);
    broadcastInbox();
  }
  function broadcastInbox() {
    try {
      if (bc) bc.postMessage({ type: "inbox" });
    } catch (e) {}
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

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function levelLabel(level) {
    if (level === "urgent" || level === "high") return level === "urgent" ? "緊急" : "重要";
    if (level === "low") return "低";
    return "通常";
  }

  function addToPanel(msg, id, meta) {
    var list = document.getElementById("notif-list");
    if (!list) return;
    if (id) {
      var exists = list.querySelector('[data-id="' + String(id).replace(/"/g, "") + '"]');
      if (exists) return;
    }
    var li = document.createElement("li");
    li.dataset.id = id || "";
    if (meta && meta.type) li.dataset.type = meta.type;
    var level = (meta && meta.level) || (meta && meta.type === "urgent" ? "urgent" : meta && meta.type === "urgent_filled" ? "high" : "normal");
    li.dataset.level = level;
    li.classList.add("notif-level-" + level);
    var time = meta && meta.created_at ? new Date(meta.created_at) : new Date();
    var badge = '<span class="notif-level-badge lv-' + level + '">' + levelLabel(level) + "</span> ";
    var title = meta && meta.title ? "<strong>" + escapeHtml(meta.title) + "</strong><br>" : "";
    li.innerHTML =
      badge +
      title +
      "<span>" +
      escapeHtml(msg) +
      "</span><time>" +
      time.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      }) +
      "</time>";
    if (meta && meta.link) {
      li.style.cursor = "pointer";
      li.addEventListener("click", function () {
        markRead(id);
        location.href = meta.link;
      });
    }
    list.prepend(li);
    while (list.children.length > 35) list.lastChild.remove();
  }

  function renderInboxFromStore() {
    var list = document.getElementById("notif-list");
    if (!list) return;
    var inbox = loadInbox();
    var session = window.G5 && G5.getSession && G5.getSession();
    inbox
      .slice()
      .reverse()
      .forEach(function (n) {
        if (!n || !n.id) return;
        if (session && !isTargetedToMe(n, session)) return;
        addToPanel(n.body || n.title || "", n.id, {
          title: n.title,
          type: n.type,
          created_at: n.created_at,
          link: n.link
        });
      });
  }

  async function requestPermission() {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission !== "denied") {
      try {
        var p = await Notification.requestPermission();
        return p === "granted";
      } catch (e) {
        return false;
      }
    }
    return false;
  }

  function showPush(title, body, opts) {
    opts = opts || {};
    var iconBase = (window.G5 && G5.BASE ? G5.BASE + "/" : "") + "icons/icon-192.png";
    var shown = false;
    if ("Notification" in window && Notification.permission === "granted") {
      try {
        var n = new Notification(title || "G⁵ Portal", {
          body: body || "",
          icon: iconBase,
          badge: iconBase,
          tag: opts.tag || "g5-" + Date.now(),
          renotify: !!opts.renotify,
          data: opts.data || { link: opts.link || "" }
        });
        n.onclick = function () {
          try {
            window.focus();
          } catch (e) {}
          if (opts.link) location.href = opts.link;
          n.close();
        };
        shown = true;
      } catch (e) {}
    }
    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
      navigator.serviceWorker.ready
        .then(function (reg) {
          if (reg.showNotification) {
            return reg.showNotification(title || "G⁵ Portal", {
              body: body || "",
              icon: "icons/icon-192.png",
              badge: "icons/icon-192.png",
              tag: opts.tag || "g5-sw-" + Date.now(),
              renotify: !!opts.renotify,
              data: opts.data || { link: opts.link || "" }
            });
          }
        })
        .catch(function () {});
      shown = true;
    }
    return shown;
  }

  function isTargetedToMe(n, session) {
    if (!session) return false;
    var to = n.to;
    if (to === "all" || to == null) return true;
    if (to === "students") {
      return session.role === "student" || session.role === "temporary";
    }
    if (to === "staff") {
      return ["admin", "teacher", "temporary"].indexOf(session.role) !== -1;
    }
    /* 複合: ["all"] や ロール混在は配列で user id またはロールキーワード */
    if (Array.isArray(to)) {
      if (to.indexOf("all") !== -1) return true;
      if (to.indexOf(session.id) !== -1) return true;
      if (to.indexOf("staff") !== -1 && ["admin", "teacher", "temporary"].indexOf(session.role) !== -1)
        return true;
      if (
        to.indexOf("students") !== -1 &&
        (session.role === "student" || session.role === "temporary")
      )
        return true;
      return false;
    }
    return to === session.id;
  }

  function countUnread() {
    var read = getReadSet();
    var session = window.G5 && G5.getSession && G5.getSession();
    var c = 0;
    loadInbox().forEach(function (n) {
      if (!n || !n.id) return;
      if (session && !isTargetedToMe(n, session)) return;
      if (!read[n.id]) c++;
    });
    return c;
  }

  var localNearCount = 0;
  function countLocalNear() {
    return localNearCount;
  }

  /** サーバ通知を取得してパネル＆プッシュ（失敗時も次回再試行） */
  async function pollServerNotifications() {
    if (polling) return;
    polling = true;
    var session = window.G5 && G5.getSession && G5.getSession();
    if (!session) {
      updateBadge(0);
      polling = false;
      return;
    }
    var list;
    try {
      if (window.G5Supabase && G5Supabase.fetchNotifications) {
        var rows = await G5Supabase.fetchNotifications(session.id);
        list = (rows || []).map(function (n) {
          return {
            id: n.id,
            from_id: n.author_id,
            from_name: n.author_name,
            to: n.target === "all" || n.target == null ? "all" : n.target,
            title: n.title,
            body: n.body,
            type: n.type || "broadcast",
            level: n.level || "normal",
            link: n.link || "",
            created_at: n.created_at
          };
        });
      } else if (window.G5Api) {
        list = await G5Api.fetchJson("src/data/notifications.json");
      } else {
        var base = (window.G5 && G5.BASE) || ".";
        var res = await fetch(base + "/src/data/notifications.json?t=" + Date.now(), {
          cache: "no-store"
        });
        if (!res.ok) throw new Error(String(res.status));
        list = await res.json();
      }
      failStreak = 0;
    } catch (e) {
      failStreak++;
      polling = false;
      schedulePoll(true);
      return;
    }
    if (!Array.isArray(list)) list = [];

    var read = getReadSet();
    var pushed = getPushedSet();
    var sorted = list.slice().sort(function (a, b) {
      return (b.created_at || "").localeCompare(a.created_at || "");
    });

    sorted.forEach(function (n) {
      if (!n || !n.id) return;
      if (!isTargetedToMe(n, session)) return;

      mergeInbox({
        id: n.id,
        to: n.to,
        title: n.title,
        body: n.body,
        type: n.type,
        link: n.link,
        created_at: n.created_at,
        from_name: n.from_name
      });

      addToPanel(n.body || n.title || "", n.id, {
        title: n.title,
        type: n.type,
        level: n.level,
        created_at: n.created_at,
        link: n.link
      });

      /* 未プッシュかつ未読のみプッシュ（再読込での連打を抑制しつつ取りこぼし防止） */
      if (!pushed[n.id] && !read[n.id]) {
        var lv = n.level || (n.type === "urgent" ? "urgent" : n.type === "urgent_filled" ? "high" : n.type === "direct" ? "high" : "normal");
        /* 低レベルはベルのみ。通常以上はプッシュ */
        if (lv !== "low") {
          showPush(n.title || "G⁵ Portal", n.body || "", {
            tag: "g5-n-" + n.id,
            link: n.link || "shift.html",
            data: { id: n.id, link: n.link || "shift.html" },
            renotify: lv === "urgent" || lv === "high"
          });
          markPushed(n.id);
        } else {
          markPushed(n.id);
        }
      }
    });

    updateBadge(countUnread() + countLocalNear());
    polling = false;
  }

  function checkNearShifts(shifts, session) {
    if (!shifts || !session) {
      localNearCount = 0;
      updateBadge(countUnread());
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
        var msg =
          "まもなくシフト開始（10分前）: " +
          s.time_start +
          "–" +
          s.time_end +
          "（" +
          (s.tanto || "") +
          "）";
        var id = "near_" + key;
        addToPanel(msg, id, { title: "シフト間近", type: "near" });
        mergeInbox({
          id: id,
          to: session.id,
          title: "シフト間近",
          body: msg,
          type: "near",
          link: "shift.html",
          created_at: new Date().toISOString()
        });
        showPush("G⁵ Portal シフト間近", msg, { tag: "near-" + key, link: "shift.html" });
        requestPermission();
      }
    });
    setList(NEAR_KEY, notified);
    localNearCount = nearCount;
    updateBadge(nearCount + countUnread());
  }

  /** 急募終了（ローカル＋サーバへ staff/all 通知） */
  async function notifyUrgentFilled(shift) {
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
    addToPanel(msg, key, { title: "急募終了", type: "urgent_filled", link: "shift.html" });
    mergeInbox({
      id: key,
      to: "all",
      title: "急募終了",
      body: msg,
      type: "urgent_filled",
      link: "shift.html",
      created_at: new Date().toISOString()
    });
    showPush("G⁵ Portal 急募終了", msg, { tag: key, link: "shift.html", renotify: true });
    requestPermission();

    /* 管理者含む全員にサーバ通知（他端末でも届く） */
    try {
      if (window.G5Api && G5.getSession()) {
        await sendNotification({
          to: "all",
          title: "急募終了",
          body: msg,
          type: "urgent_filled",
          level: "high",
          link: "shift.html"
        });
      }
    } catch (e) {
      console.warn("urgent_filled server notif", e);
    }
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

      /* admin/teacher は常に受信。それ以外は対象者のみ */
      if (session) {
        var isStaff = ["admin", "teacher"].indexOf(session.role) !== -1;
        if (!isStaff) {
          var target = s.target;
          if (target && target !== "all") {
            var arr = Array.isArray(target) ? target : [target];
            if (arr.indexOf(session.id) === -1) return;
          }
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
      addToPanel(msg, key, { title: "急募終了", type: "urgent_filled", link: "shift.html" });
      mergeInbox({
        id: key,
        to: "all",
        title: "急募終了",
        body: msg,
        type: "urgent_filled",
        link: "shift.html",
        created_at: new Date().toISOString()
      });
      showPush("G⁵ Portal 急募終了", msg, { tag: key, link: "shift.html" });
    });
    setList(URGENT_KEY, notified);
  }

  /** 急募開始のローカル検知（admin は常に通知） */
  function checkUrgentOpened(shifts, session) {
    if (!shifts || !session) return;
    var notified = getList(URGENT_OPEN_KEY);
    var isStaff = ["admin", "teacher"].indexOf(session.role) !== -1;
    shifts.forEach(function (s) {
      if (!s.urgent || !s.open) return;
      var key = "open_" + s.shift_id;
      if (notified.indexOf(key) !== -1) return;

      var target = s.target;
      var allowed = isStaff;
      if (!allowed) {
        if (!target || target === "all") allowed = true;
        else {
          var arr = Array.isArray(target) ? target : [target];
          allowed = arr.indexOf(session.id) !== -1;
        }
      }
      if (!allowed) return;

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
      mergeInbox({
        id: key,
        to: isStaff ? "staff" : session.id,
        title: "急募のお知らせ",
        body: msg,
        type: "urgent",
        link: "shift.html",
        created_at: new Date().toISOString()
      });
      showPush("G⁵ Portal 急募", msg, {
        tag: key,
        link: "shift.html",
        renotify: true
      });
      requestPermission();
    });
    setList(URGENT_OPEN_KEY, notified);
  }

  async function dispatchEmail(item) {
    try {
      if (window.G5Email && G5Email.sendNotificationEmail) {
        var r = await G5Email.sendNotificationEmail(item);
        console.info("[G5Notif] email", r);
        return r;
      }
      if (window.G5Supabase && G5Supabase.notifyEmail) {
        await G5Supabase.notifyEmail(item);
        return { ok: true, via: "edge" };
      }
      return { ok: false, reason: "no email module" };
    } catch (e) {
      console.warn("[G5Notif] email failed", e);
      return { ok: false, error: String(e) };
    }
  }

  /**
   * 通知をサーバに追加（リトライ付き）
   * to: "all" | "students" | "staff" | string | string[]
   */
  async function sendNotification(payload) {
    var session = G5.getSession();
    if (!session) throw new Error("ログインが必要です");
    var to = payload.to == null ? "all" : payload.to;
    var item = {
      id: null,
      from_id: session.id,
      from_name: session.name || session.id,
      to: to,
      title: payload.title || "お知らせ",
      body: payload.body || "",
      type: payload.type || "broadcast",
      level: payload.level || "normal",
      link: payload.link || "",
      created_at: new Date().toISOString()
    };

    /* 1) Supabase 優先 */
    if (window.G5Supabase && G5Supabase.createNotification) {
      try {
        var row = await G5Supabase.createNotification({
          title: item.title,
          body: item.body,
          author_id: item.from_id,
          author_name: item.from_name,
          author_role: session.role || null,
          target: to,
          type: item.type,
          level: item.level,
          link: item.link || null,
          created_at: item.created_at
        });
        item.id = row.id;
        if (isTargetedToMe(item, session)) {
          mergeInbox(item);
          addToPanel(item.body || item.title, item.id, {
            title: item.title,
            type: item.type,
            created_at: item.created_at,
            link: item.link
          });
          updateBadge(countUnread() + countLocalNear());
        }
        setTimeout(pollServerNotifications, 500);
        item._email = await dispatchEmail(item);
        return item;
      } catch (e) {
        console.warn("Supabase notif failed, fallback JSON", e);
      }
    }

    /* 2) フォールバック: notifications.json */
    if (!window.G5Api) throw new Error("通知送信先がありません（Supabase / G5Api）");
    item.id = G5Api.uid("n");
    var lastErr;
    for (var attempt = 0; attempt < 3; attempt++) {
      try {
        await G5Api.updateJson(
          "src/data/notifications.json",
          function (list) {
            if (!Array.isArray(list)) list = [];
            list.push(item);
            if (list.length > 200) list = list.slice(-200);
            return list;
          },
          "notif: " + item.title
        );
        if (isTargetedToMe(item, session)) {
          mergeInbox(item);
          addToPanel(item.body || item.title, item.id, {
            title: item.title,
            type: item.type,
            created_at: item.created_at,
            link: item.link
          });
          updateBadge(countUnread() + countLocalNear());
        }
        setTimeout(pollServerNotifications, 800);
        item._email = await dispatchEmail(item);
        return item;
      } catch (e) {
        lastErr = e;
        await new Promise(function (r) {
          setTimeout(r, 500 * (attempt + 1));
        });
      }
    }
    throw lastErr || new Error("通知送信に失敗しました");
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

  function schedulePoll(fromFail) {
    if (pollTimer) clearInterval(pollTimer);
    var ms = fromFail && failStreak > 0 ? POLL_FAIL_MS : POLL_MS;
    pollTimer = setInterval(function () {
      pollServerNotifications();
    }, ms);
  }

  function startPolling() {
    renderInboxFromStore();
    if (window.__G5_NOTIF_WIPED__) {
      var list = document.getElementById("notif-list");
      if (list) list.innerHTML = "";
      updateBadge(0);
    }
    pollServerNotifications();
    /* サイト共通リアルタイムハブがあればそれに乗せる */
    if (window.G5Realtime && G5Realtime.subscribe) {
      G5Realtime.subscribe(function () {
        pollServerNotifications();
      });
    } else {
      schedulePoll(false);
      document.addEventListener("visibilitychange", function () {
        if (document.visibilityState === "visible") {
          pollServerNotifications();
          schedulePoll(false);
        }
      });
      window.addEventListener("focus", function () {
        pollServerNotifications();
      });
      window.addEventListener("online", function () {
        failStreak = 0;
        pollServerNotifications();
        schedulePoll(false);
      });
    }
    if (window.G5 && G5.getSession && G5.getSession()) {
      setTimeout(function () {
        requestPermission();
      }, 1200);
    }
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
