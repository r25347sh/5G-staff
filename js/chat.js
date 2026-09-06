/**
 * G⁵ Portal - class chat
 * 生徒同士のグループチャット（全ロール閲覧可）
 */
(function () {
  "use strict";
  var POLL_MS = 8000;
  var timer = null;
  var lastCount = 0;

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

  function updateSessionUI() {
    var s = G5.getSession();
    var el = document.getElementById("chat-session");
    var form = document.getElementById("chat-form");
    var need = document.getElementById("chat-need-login");
    if (el) el.textContent = s ? (s.name || s.id) + " として参加中" : "閲覧のみ";
    if (form) form.hidden = !s;
    if (need) need.hidden = !!s;
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
    if (!messages.length) {
      box.innerHTML = "<p class='empty-msg'>まだメッセージはありません。最初の一言をどうぞ。</p>";
      lastCount = 0;
      return;
    }
    var sess = G5.getSession();
    var myId = sess && sess.id;
    var html = messages
      .map(function (m) {
        var mine = myId && m.user_id === myId;
        return (
          '<div class="chat-bubble ' +
          (mine ? "mine" : "") +
          '">' +
          '<div class="chat-meta">' +
          escapeHtml(m.user_name || m.user_id) +
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
      box.scrollHeight - box.scrollTop - box.clientHeight < 80 || lastCount === 0;
    box.innerHTML = html;
    if (atBottom || messages.length > lastCount) {
      box.scrollTop = box.scrollHeight;
    }
    lastCount = messages.length;
  }

  async function sendMessage(e) {
    e.preventDefault();
    var s = G5.getSession();
    if (!s) {
      location.href = "login.html?next=chat.html";
      return;
    }
    var input = document.getElementById("chat-input");
    var msg = document.getElementById("chat-msg");
    var text = (input.value || "").trim();
    if (!text) return;
    input.disabled = true;
    msg.textContent = "送信中…";
    msg.classList.remove("error");
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
            text: text,
            created_at: new Date().toISOString()
          });
          if (data.messages.length > 300) data.messages = data.messages.slice(-300);
          data.updated_at = new Date().toISOString();
          return data;
        },
        "chat: " + s.id
      );
      input.value = "";
      msg.textContent = "";
      await loadMessages(true);
    } catch (err) {
      msg.textContent = err.message || String(err);
      msg.classList.add("error");
    } finally {
      input.disabled = false;
      input.focus();
    }
  }

  function startPoll() {
    if (timer) return;
    timer = setInterval(function () {
      loadMessages(true);
    }, POLL_MS);
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateSessionUI();
    document.getElementById("chat-form").addEventListener("submit", sendMessage);
    document.getElementById("btn-chat-refresh").addEventListener("click", function () {
      loadMessages(false);
    });
    loadMessages(false);
    startPoll();
  });
})();
