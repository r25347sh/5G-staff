/**
 * G⁵ Portal - notifications page
 * admin / teacher からの通知を表示し、ログインユーザーが返信可能
 */
(function () {
  "use strict";

  var STAFF_ROLES = ["admin", "teacher", "temporary"];

  function escapeHtml(s) {
    if (s == null) return "";
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatTime(iso) {
    if (!iso) return "";
    try {
      var d = new Date(iso);
      if (isNaN(d.getTime())) return String(iso).slice(0, 16).replace("T", " ");
      return d.toLocaleString("ja-JP", {
        month: "numeric",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch (e) {
      return String(iso).slice(0, 16).replace("T", " ");
    }
  }

  function levelLabel(level) {
    if (level === "urgent") return "緊急";
    if (level === "high") return "重要";
    if (level === "low") return "低";
    return "通常";
  }

  function isStaffRole(role) {
    return STAFF_ROLES.indexOf(role) !== -1;
  }

  async function loadReplies(id, container) {
    var ul = container.querySelector(".reply-list");
    if (!ul) return;
    try {
      var replies = await G5Supabase.fetchReplies(id);
      if (!replies.length) {
        ul.innerHTML = '<li class="reply-empty">返信はまだありません</li>';
        return;
      }
      ul.innerHTML = replies
        .map(function (r) {
          var staffClass = "";
          /* author_name だけでは role 不明のため、author_id から判定できない場合は通常表示 */
          return (
            "<li>" +
            '<span class="reply-author">' +
            escapeHtml(r.author_name || r.author_id) +
            "</span>: " +
            escapeHtml(r.body) +
            ' <span class="reply-time">' +
            escapeHtml(formatTime(r.created_at)) +
            "</span></li>"
          );
        })
        .join("");
    } catch (e) {
      console.warn("[notif-page] replies", e);
      ul.innerHTML = '<li class="reply-empty">返信の読み込みに失敗しました</li>';
    }
  }

  function bindReplyForms(listEl, sess) {
    listEl.querySelectorAll(".reply-form").forEach(function (form) {
      if (form.dataset.bound === "1") return;
      form.dataset.bound = "1";
      form.addEventListener("submit", async function (e) {
        e.preventDefault();
        var input = form.querySelector('input[name="body"]');
        var btn = form.querySelector('button[type="submit"]');
        var body = (input && input.value ? input.value : "").trim();
        if (!body) return;
        var nid = form.getAttribute("data-nid");
        if (!nid) return;
        if (btn) btn.disabled = true;
        try {
          await G5Supabase.postReply({
            notification_id: nid,
            author_id: sess.id,
            author_name: sess.name || sess.id,
            body: body,
            created_at: new Date().toISOString()
          });
          if (input) input.value = "";
          var article = form.closest(".notif-item");
          if (article) await loadReplies(nid, article);
        } catch (err) {
          alert("返信に失敗: " + (err.message || err));
        } finally {
          if (btn) btn.disabled = false;
        }
      });
    });
  }

  async function render() {
    var listEl = document.getElementById("notif-list-page");
    var hint = document.getElementById("notif-login-hint");
    if (!listEl) return;

    var sess = window.G5 && G5.getSession && G5.getSession();
    if (!sess) {
      if (hint) hint.hidden = false;
      listEl.innerHTML = "";
      return;
    }
    if (hint) hint.hidden = true;
    listEl.innerHTML = '<p class="empty-msg">読み込み中…</p>';

    try {
      if (!window.G5Supabase || !G5Supabase.fetchNotifications) {
        listEl.innerHTML =
          '<p class="empty-msg">通知APIが利用できません（Supabase 未読込）</p>';
        return;
      }

      var items = await G5Supabase.fetchNotifications(sess.id);
      if (!items.length) {
        listEl.innerHTML = '<p class="empty-msg">通知はまだありません</p>';
        return;
      }

      var focusId = new URLSearchParams(location.search).get("id");

      listEl.innerHTML = items
        .map(function (n) {
          var open = focusId && String(n.id) === String(focusId);
          var lv = n.level || "normal";
          return (
            '<article class="notif-item' +
            (open ? " is-focus" : "") +
            '" data-id="' +
            escapeHtml(n.id) +
            '">' +
            "<h3>" +
            '<span class="notif-level-tag lv-' +
            escapeHtml(lv) +
            '">' +
            escapeHtml(levelLabel(lv)) +
            "</span>" +
            escapeHtml(n.title || "お知らせ") +
            "</h3>" +
            '<div class="notif-meta">from ' +
            escapeHtml(n.author_name || n.author_id || "staff") +
            " · " +
            escapeHtml(formatTime(n.created_at)) +
            "</div>" +
            '<div class="notif-body">' +
            escapeHtml(n.body || "") +
            "</div>" +
            '<div class="reply-box">' +
            '<div class="reply-box-label">💬 返信</div>' +
            '<ul class="reply-list"></ul>' +
            '<form class="reply-form" data-nid="' +
            escapeHtml(n.id) +
            '">' +
            '<input type="text" name="body" placeholder="返信を入力…" required maxlength="500" autocomplete="off">' +
            '<button type="submit" class="btn btn-primary">送信</button>' +
            "</form></div></article>"
          );
        })
        .join("");

      var articles = listEl.querySelectorAll(".notif-item");
      articles.forEach(function (el) {
        loadReplies(el.getAttribute("data-id"), el);
      });

      bindReplyForms(listEl, sess);

      if (focusId) {
        var focusEl = listEl.querySelector('.notif-item[data-id="' + focusId + '"]');
        if (focusEl) {
          setTimeout(function () {
            focusEl.scrollIntoView({ behavior: "smooth", block: "center" });
          }, 120);
        }
      }
    } catch (e) {
      listEl.innerHTML =
        '<p class="empty-msg">読み込みに失敗しました（Supabase テーブル未作成の可能性）</p>';
      console.error("[notif-page]", e);
    }
  }

  function subscribeRealtime() {
    if (!window.G5Supabase) return;
    if (G5Supabase.subscribeNotifications) {
      G5Supabase.subscribeNotifications(function () {
        render();
      });
    }
    if (G5Supabase.subscribeReplies) {
      G5Supabase.subscribeReplies(function (payload) {
        var nid =
          payload &&
          payload.new &&
          (payload.new.notification_id || payload.new.notificationId);
        if (!nid) {
          render();
          return;
        }
        var article = document.querySelector(
          '.notif-item[data-id="' + String(nid).replace(/"/g, "") + '"]'
        );
        if (article) loadReplies(nid, article);
        else render();
      });
    }
  }

  function boot() {
    var tries = 0;
    function attempt() {
      tries += 1;
      /* load.js が非同期で supabase を注入するため少し待つ */
      if (!window.G5Supabase && tries < 25) {
        setTimeout(attempt, 120);
        return;
      }
      render();
      subscribeRealtime();
    }
    attempt();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
