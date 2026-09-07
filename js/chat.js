/**
 * G⁵ Portal - class chat
 * 全体チャット + 生徒同士の1対1（DM）
 * 全ロール送信可（student / temporary / teacher / admin）
 */
(function () {
  "use strict";
  var lastCount = 0;
  var lastFingerprint = "";
  var mode = "global"; /* global | dm */
  var dmPeer = "";
  var usersCache = [];
  var unsub = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return "";
    }
  }

  function dmRoom(a, b) {
    var ids = [String(a), String(b)].sort();
    return "dm:" + ids[0] + ":" + ids[1];
  }

  function roleBadge(role) {
    if (role === "admin") return "管理者";
    if (role === "teacher") return "先生";
    if (role === "temporary") return "臨時";
    return "生徒";
  }

  function updateSessionUI() {
    var s = G5.getSession();
    var el = document.getElementById("chat-session");
    var form = document.getElementById("chat-form");
    var need = document.getElementById("chat-need-login");
    var modeBar = document.getElementById("chat-mode-bar");
    if (el) {
      el.textContent = s
        ? (s.name || s.id) + "（" + roleBadge(s.role) + "）として参加中 — 生徒同士の会話OK"
        : "閲覧のみ（送信にはログイン）";
    }
    if (form) form.hidden = !s;
    if (need) need.hidden = !!s;
    if (modeBar) modeBar.hidden = !s;
  }

  async function loadUsers() {
    try {
      usersCache = await G5Api.fetchJson("src/data/users.json");
      if (!Array.isArray(usersCache)) usersCache = [];
    } catch (e) {
      usersCache = [];
    }
    var sel = document.getElementById("chat-dm-peer");
    if (!sel) return;
    var me = G5.getSession();
    var myId = me && me.id;
    sel.innerHTML =
      '<option value="">— 相手を選択 —</option>' +
      usersCache
        .filter(function (u) {
          return u.id !== myId;
        })
        .map(function (u) {
          return (
            '<option value="' +
            escapeHtml(u.id) +
            '">' +
            escapeHtml(u.name || u.id) +
            "（" +
            roleBadge(u.role) +
            "）</option>"
          );
        })
        .join("");
  }

  function filterMessages(messages, sess) {
    if (mode === "global") {
      return messages.filter(function (m) {
        return !m.room || m.room === "global";
      });
    }
    if (!sess || !dmPeer) return [];
    var room = dmRoom(sess.id, dmPeer);
    return messages.filter(function (m) {
      return m.room === room;
    });
  }

  async function loadMessages(silent) {
    var box = document.getElementById("chat-messages");
    if (!box) return;
    if (!silent) box.innerHTML = "<p class='empty-msg'>読み込み中…</p>";
    var data;
    try {
      data = await G5Api.fetchJson("src/data/chat.json");
    } catch (e) {
      data = { messages: [] };
    }
    var messages = (data && data.messages) || [];
    var sess = G5.getSession();
    var visible = filterMessages(messages, sess);
    var fp = visible
      .map(function (m) {
        return m.id;
      })
      .join(",");
    if (silent && fp === lastFingerprint) return;
    lastFingerprint = fp;

    if (!visible.length) {
      var empty =
        mode === "dm"
          ? dmPeer
            ? "この相手とのメッセージはまだありません"
            : "DM の相手を選んでください"
          : "まだメッセージはありません。生徒同士でも自由にどうぞ。";
      box.innerHTML = "<p class='empty-msg'>" + empty + "</p>";
      lastCount = 0;
      return;
    }

    var myId = sess && sess.id;
    var html = visible
      .map(function (m) {
        var mine = myId && m.user_id === myId;
        var role = m.user_role ? " · " + roleBadge(m.user_role) : "";
        return (
          '<div class="chat-bubble ' +
          (mine ? "mine" : "") +
          '">' +
          '<div class="chat-meta">' +
          escapeHtml(m.user_name || m.user_id) +
          role +
          " · " +
          formatTime(m.created_at) +
          "</div>" +
          '<div class="chat-text">' +
          escapeHtml(m.text) +
          "</div></div>"
        );
      })
      .join("");
    var atBottom =
      box.scrollHeight - box.scrollTop - box.clientHeight < 100 || lastCount === 0;
    box.innerHTML = html;
    if (atBottom || visible.length > lastCount) {
      box.scrollTop = box.scrollHeight;
    }
    lastCount = visible.length;
  }

  async function sendMessage(e) {
    e.preventDefault();
    var s = G5.getSession();
    if (!s) {
      location.href = "login.html?next=chat.html";
      return;
    }
    if (mode === "dm" && !dmPeer) {
      document.getElementById("chat-msg").textContent = "DM の相手を選んでください";
      document.getElementById("chat-msg").classList.add("error");
      return;
    }
    var input = document.getElementById("chat-input");
    var msg = document.getElementById("chat-msg");
    var text = (input.value || "").trim();
    if (!text) return;

    /* 楽観的表示 */
    var box = document.getElementById("chat-messages");
    var optimistic =
      '<div class="chat-bubble mine pending">' +
      '<div class="chat-meta">送信中…</div>' +
      '<div class="chat-text">' +
      escapeHtml(text) +
      "</div></div>";
    if (box && !box.querySelector(".empty-msg")) box.insertAdjacentHTML("beforeend", optimistic);
    else if (box) box.innerHTML = optimistic;
    box.scrollTop = box.scrollHeight;

    input.disabled = true;
    msg.textContent = "";
    msg.classList.remove("error");
    var room = mode === "dm" ? dmRoom(s.id, dmPeer) : "global";
    try {
      await G5Api.updateJson(
        "src/data/chat.json",
        function (data) {
          if (!data || typeof data !== "object") data = { messages: [] };
          if (!Array.isArray(data.messages)) data.messages = [];
          data.messages.push({
            id: G5Api.uid("cm"),
            user_id: s.id,
            user_name: s.name || s.id,
            user_role: s.role || "student",
            text: text,
            room: room,
            created_at: new Date().toISOString()
          });
          if (data.messages.length > 400) data.messages = data.messages.slice(-400);
          data.updated_at = new Date().toISOString();
          return data;
        },
        "chat: " + s.id
      );
      input.value = "";
      lastFingerprint = "";
      await loadMessages(true);
      if (window.G5Realtime) G5Realtime.force();
    } catch (err) {
      msg.textContent = err.message || String(err);
      msg.classList.add("error");
      await loadMessages(true);
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function setMode(next) {
    mode = next;
    dmPeer = document.getElementById("chat-dm-peer").value || "";
    document.querySelectorAll(".chat-mode-btn").forEach(function (b) {
      b.classList.toggle("active", b.dataset.mode === mode);
    });
    var peerWrap = document.getElementById("chat-dm-wrap");
    if (peerWrap) peerWrap.hidden = mode !== "dm";
    lastFingerprint = "";
    loadMessages(false);
  }

  function startRealtime() {
    if (window.G5Realtime && G5Realtime.subscribe) {
      unsub = G5Realtime.subscribe(function () {
        loadMessages(true);
      });
    } else {
      setInterval(function () {
        loadMessages(true);
      }, 3000);
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateSessionUI();
    loadUsers();
    document.getElementById("chat-form").addEventListener("submit", sendMessage);
    document.getElementById("btn-chat-refresh").addEventListener("click", function () {
      lastFingerprint = "";
      loadMessages(false);
    });
    document.querySelectorAll(".chat-mode-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        setMode(btn.dataset.mode);
      });
    });
    var peer = document.getElementById("chat-dm-peer");
    if (peer) {
      peer.addEventListener("change", function () {
        dmPeer = peer.value;
        lastFingerprint = "";
        loadMessages(false);
      });
    }
    loadMessages(false);
    startRealtime();
  });
})();
