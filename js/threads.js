/**
 * G⁵ Portal - threads (掲示板)
 */
(function () {
  "use strict";
  var threadsCache = [];
  var currentId = null;

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/\n/g, "<br>");
  }

  function canPost() {
    var s = G5.getSession();
    return !!s;
  }

  function canCreateThread() {
    var s = G5.getSession();
    if (!s) return false;
    return ["admin", "teacher", "temporary", "student"].indexOf(s.role) !== -1;
  }

  function updateSessionUI() {
    var s = G5.getSession();
    var el = document.getElementById("thread-session");
    var btn = document.getElementById("btn-new-thread");
    if (el) el.textContent = s ? (s.name || s.id) + " で表示中" : "閲覧のみ（ログインで返信可）";
    if (btn) btn.hidden = !canCreateThread();
  }

  async function loadThreads() {
    var list = document.getElementById("thread-list");
    if (list) list.innerHTML = "<p class='empty-msg'>読み込み中…</p>";
    try {
      threadsCache = await G5Api.fetchJson("src/data/threads.json");
      if (!Array.isArray(threadsCache)) threadsCache = [];
    } catch (e) {
      threadsCache = [];
    }
    renderList();
  }

  function renderList() {
    var list = document.getElementById("thread-list");
    if (!list) return;
    if (!threadsCache.length) {
      list.innerHTML = "<p class='empty-msg'>スレッドはまだありません</p>";
      return;
    }
    var sorted = threadsCache.slice().sort(function (a, b) {
      return (b.updated_at || b.created_at || "").localeCompare(a.updated_at || a.created_at || "");
    });
    list.innerHTML = sorted
      .map(function (t) {
        var n = (t.replies && t.replies.length) || 0;
        return (
          '<button type="button" class="thread-item" data-id="' +
          escapeHtml(t.id) +
          '">' +
          "<h3>" +
          escapeHtml(t.title) +
          "</h3>" +
          '<p class="thread-meta">' +
          escapeHtml(t.author_name || t.author_id) +
          " · " +
          formatDate(t.created_at) +
          " · 返信 " +
          n +
          "</p>" +
          '<p class="thread-preview">' +
          escapeHtml((t.body || "").slice(0, 100)) +
          "</p>" +
          "</button>"
        );
      })
      .join("");
  }

  function formatDate(iso) {
    if (!iso) return "";
    try {
      return new Date(iso).toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return iso;
    }
  }

  function showDetail(id) {
    currentId = id;
    var t = threadsCache.find(function (x) {
      return x.id === id;
    });
    var list = document.getElementById("thread-list");
    var detail = document.getElementById("thread-detail");
    var article = document.getElementById("thread-article");
    var replyBox = document.getElementById("reply-box");
    if (!t || !detail || !article) return;
    if (list) list.hidden = true;
    detail.hidden = false;
    var repliesHtml = (t.replies || [])
      .map(function (r) {
        return (
          '<div class="reply">' +
          '<div class="reply-meta">' +
          escapeHtml(r.author_name || r.author_id) +
          " · " +
          formatDate(r.created_at) +
          "</div>" +
          '<div class="reply-body">' +
          escapeHtml(r.body) +
          "</div></div>"
        );
      })
      .join("");
    article.innerHTML =
      "<h2>" +
      escapeHtml(t.title) +
      "</h2>" +
      '<p class="thread-meta">' +
      escapeHtml(t.author_name || t.author_id) +
      " · " +
      formatDate(t.created_at) +
      "</p>" +
      '<div class="thread-body">' +
      escapeHtml(t.body) +
      "</div>" +
      '<div class="replies-head">返信（' +
      ((t.replies && t.replies.length) || 0) +
      "）</div>" +
      (repliesHtml || "<p class='empty-msg'>まだ返信はありません</p>");
    if (replyBox) replyBox.hidden = !canPost();
  }

  function showList() {
    currentId = null;
    document.getElementById("thread-detail").hidden = true;
    document.getElementById("thread-list").hidden = false;
  }

  async function postThread() {
    var s = G5.getSession();
    if (!s) {
      location.href = "login.html?next=threads.html";
      return;
    }
    var title = document.getElementById("nt-title").value.trim();
    var body = document.getElementById("nt-body").value.trim();
    var msg = document.getElementById("nt-msg");
    if (!title || !body) {
      msg.textContent = "タイトルと本文を入力してください";
      msg.classList.add("error");
      return;
    }
    msg.textContent = "投稿中…";
    msg.classList.remove("error");
    try {
      await G5Api.updateJson(
        "src/data/threads.json",
        function (list) {
          if (!Array.isArray(list)) list = [];
          list.push({
            id: G5Api.uid("th"),
            title: title,
            body: body,
            author_id: s.id,
            author_name: s.name || s.id,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            replies: []
          });
          return list;
        },
        "thread: " + title
      );
      document.getElementById("nt-title").value = "";
      document.getElementById("nt-body").value = "";
      document.getElementById("new-thread-box").hidden = true;
      msg.textContent = "投稿しました";
      await loadThreads();
    } catch (e) {
      msg.textContent = e.message || String(e);
      msg.classList.add("error");
    }
  }

  async function postReply() {
    var s = G5.getSession();
    if (!s || !currentId) {
      location.href = "login.html?next=threads.html";
      return;
    }
    var body = document.getElementById("reply-text").value.trim();
    var msg = document.getElementById("reply-msg");
    if (!body) {
      msg.textContent = "本文を入力してください";
      msg.classList.add("error");
      return;
    }
    msg.textContent = "送信中…";
    msg.classList.remove("error");
    try {
      await G5Api.updateJson(
        "src/data/threads.json",
        function (list) {
          if (!Array.isArray(list)) list = [];
          var t = list.find(function (x) {
            return x.id === currentId;
          });
          if (!t) throw new Error("スレッドが見つかりません");
          if (!t.replies) t.replies = [];
          t.replies.push({
            id: G5Api.uid("rp"),
            body: body,
            author_id: s.id,
            author_name: s.name || s.id,
            created_at: new Date().toISOString()
          });
          t.updated_at = new Date().toISOString();
          return list;
        },
        "reply: " + currentId
      );
      document.getElementById("reply-text").value = "";
      msg.textContent = "返信しました";
      await loadThreads();
      showDetail(currentId);
    } catch (e) {
      msg.textContent = e.message || String(e);
      msg.classList.add("error");
    }
  }

  function bind() {
    document.getElementById("btn-refresh-threads").addEventListener("click", loadThreads);
    document.getElementById("btn-new-thread").addEventListener("click", function () {
      var box = document.getElementById("new-thread-box");
      box.hidden = !box.hidden;
    });
    document.getElementById("btn-post-thread").addEventListener("click", postThread);
    document.getElementById("btn-post-reply").addEventListener("click", postReply);
    document.getElementById("btn-back-list").addEventListener("click", showList);
    document.getElementById("thread-list").addEventListener("click", function (e) {
      var btn = e.target.closest(".thread-item");
      if (btn) showDetail(btn.dataset.id);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    updateSessionUI();
    bind();
    loadThreads();
  });
})();
