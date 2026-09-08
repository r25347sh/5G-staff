/**
 * G⁵ Portal - 共通ヘッダー認証 UI
 * 未ログイン: 右上ログインボタン
 * ログイン済: アカウントメニュー（メール登録 / LINE連携 / ログアウト）
 */
(function () {
  "use strict";

  var LIFF_ID = "2011469610-d3tvoLDD"; // LIFF アプリ ID を設定してください（LINE Developers）
  var STYLE_ID = "g5-auth-ui-style";

  function injectStyles() {
    if (document.getElementById(STYLE_ID)) return;
    var css = [
      ".g5-auth-bar{position:fixed;top:max(.75rem,env(safe-area-inset-top));right:max(3.6rem,calc(env(safe-area-inset-right) + 3.6rem));z-index:9200;display:flex;align-items:center;gap:.5rem;padding:0;pointer-events:none}",
      ".g5-auth-bar > *{pointer-events:auto}",
      "body.has-auth-bar .notif-bell{right:max(.75rem,env(safe-area-inset-right))}",
      "body.has-auth-bar .notif-panel{right:max(.75rem,env(safe-area-inset-right))}",
      ".g5-auth-login{display:inline-flex;align-items:center;gap:.4rem;padding:.45rem .9rem;border-radius:999px;font-size:.85rem;font-weight:600;",
      "background:linear-gradient(105deg,#ff2d95,#c026d3);color:#fff;border:0;cursor:pointer;text-decoration:none;",
      "box-shadow:0 4px 16px rgba(255,45,149,.35);transition:transform .15s,box-shadow .15s}",
      ".g5-auth-login:hover{transform:translateY(-1px);box-shadow:0 6px 20px rgba(255,45,149,.45)}",
      ".g5-account-btn{display:inline-flex;align-items:center;gap:.45rem;padding:.4rem .75rem .4rem .4rem;border-radius:999px;",
      "background:rgba(20,14,32,.88);border:1px solid rgba(255,255,255,.14);color:#f5f0ff;cursor:pointer;font:inherit;font-size:.85rem}",
      ".g5-account-avatar{width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#ff2d95,#00f5ff);",
      "display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#0a0714}",
      ".g5-account-menu{position:absolute;top:calc(100% + 6px);right:0;min-width:260px;background:rgba(14,10,24,.96);",
      "border:1px solid rgba(255,255,255,.12);border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.5);padding:.5rem;display:none}",
      ".g5-account-wrap{position:relative}",
      ".g5-account-wrap.open .g5-account-menu{display:block}",
      ".g5-account-menu button,.g5-account-menu a{display:flex;align-items:center;gap:.55rem;width:100%;text-align:left;",
      "padding:.65rem .75rem;border:0;border-radius:10px;background:transparent;color:#f5f0ff;font:inherit;font-size:.88rem;",
      "cursor:pointer;text-decoration:none}",
      ".g5-account-menu button:hover,.g5-account-menu a:hover{background:rgba(255,45,149,.18)}",
      ".g5-account-meta{padding:.5rem .75rem .65rem;border-bottom:1px solid rgba(255,255,255,.08);margin-bottom:.25rem}",
      ".g5-account-meta .name{font-weight:600;font-size:.92rem}",
      ".g5-account-meta .role{font-size:.75rem;opacity:.7;margin-top:.15rem}",
      ".g5-account-modal{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;",
      "background:rgba(7,5,15,.72);backdrop-filter:blur(6px)}",
      ".g5-account-modal.open{display:flex}",
      ".g5-account-modal-card{width:min(400px,92vw);background:rgba(18,12,28,.98);border:1px solid rgba(255,255,255,.12);",
      "border-radius:16px;padding:1.25rem 1.35rem;box-shadow:0 20px 50px rgba(0,0,0,.55)}",
      ".g5-account-modal-card h3{margin:0 0 .85rem;font-size:1.1rem}",
      ".g5-account-modal-card label{display:block;font-size:.85rem;margin-bottom:.75rem}",
      ".g5-account-modal-card input{display:block;width:100%;margin-top:.3rem;padding:.55rem .7rem;border-radius:8px;",
      "border:1px solid rgba(255,255,255,.14);background:rgba(0,0,0,.35);color:#fff;font-size:.95rem}",
      ".g5-account-modal-actions{display:flex;gap:.5rem;justify-content:flex-end;margin-top:1rem}",
      ".g5-account-modal .msg{font-size:.82rem;margin-top:.5rem;min-height:1.2em}",
      ".g5-account-modal .msg.error{color:#ff6b9d}",
      "@media (max-width:480px){.g5-auth-bar{right:max(3.4rem,calc(env(safe-area-inset-right) + 3.4rem))}}"
    ].join("");
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
  }

  function ensureBar() {
    var bar = document.getElementById("g5-auth-bar");
    if (bar) return bar;
    bar = document.createElement("div");
    bar.id = "g5-auth-bar";
    bar.className = "g5-auth-bar";
    document.body.appendChild(bar);
    document.body.classList.add("has-auth-bar");
    return bar;
  }

  function render() {
    injectStyles();
    var bar = ensureBar();
    var sess = window.G5 && G5.getSession ? G5.getSession() : null;

    if (!sess) {
      bar.innerHTML =
        '<a class="g5-auth-login" href="login.html" id="g5-header-login">ログイン</a>';
      return;
    }

    var initial = (sess.name || sess.id || "?").charAt(0);
    bar.innerHTML =
      '<div class="g5-account-wrap" id="g5-account-wrap">' +
      '<button type="button" class="g5-account-btn" id="g5-account-btn" aria-haspopup="true" aria-expanded="false">' +
      '<span class="g5-account-avatar">' +
      initial +
      "</span>" +
      "<span>" +
      (sess.name || sess.id) +
      "</span>" +
      "</button>" +
      '<div class="g5-account-menu" role="menu">' +
      '<div class="g5-account-meta"><div class="name">' +
      (sess.name || sess.id) +
      '</div><div class="role">' +
      sess.role +
      "</div></div>" +
      '<button type="button" id="g5-btn-email" role="menuitem">✉️ メールアドレス登録</button>' +
      '<button type="button" id="g5-btn-line" role="menuitem">💬 LINEアカウント連携</button>' +
      '<a href="index.html" role="menuitem">🏠 ポータルホーム</a>' +
      '<button type="button" id="g5-btn-logout" role="menuitem">🚪 ログアウト</button>' +
      "</div></div>";

    var wrap = document.getElementById("g5-account-wrap");
    var btn = document.getElementById("g5-account-btn");
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var open = wrap.classList.toggle("open");
      btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    document.addEventListener("click", function () {
      wrap.classList.remove("open");
      btn.setAttribute("aria-expanded", "false");
    });

    document.getElementById("g5-btn-logout").addEventListener("click", function () {
      if (confirm("ログアウトしますか？")) {
        G5.clearSession();
        location.reload();
      }
    });
    document.getElementById("g5-btn-email").addEventListener("click", openEmailModal);
    document.getElementById("g5-btn-line").addEventListener("click", linkLine);
  }

  function openEmailModal() {
    var existing = document.getElementById("g5-email-modal");
    if (existing) existing.remove();
    var modal = document.createElement("div");
    modal.id = "g5-email-modal";
    modal.className = "g5-account-modal open";
    modal.innerHTML =
      '<div class="g5-account-modal-card">' +
      "<h3>メールアドレス登録</h3>" +
      "<p style=\"font-size:.85rem;opacity:.8;margin:0 0 .75rem\">通知をメールでも受け取れます（任意）</p>" +
      '<label>メールアドレス<input type="email" id="g5-email-input" placeholder="you@example.com" autocomplete="email"></label>' +
      '<p class="msg" id="g5-email-msg"></p>' +
      '<div class="g5-account-modal-actions">' +
      '<button type="button" class="btn btn-ghost" id="g5-email-cancel">キャンセル</button>' +
      '<button type="button" class="btn btn-primary" id="g5-email-save">保存</button>' +
      "</div></div>";
    document.body.appendChild(modal);

    var sess = G5.getSession();
    if (window.G5Supabase && sess) {
      G5Supabase.getUserProfile(sess.id)
        .then(function (p) {
          if (p && p.email) document.getElementById("g5-email-input").value = p.email;
        })
        .catch(function () {});
    }

    document.getElementById("g5-email-cancel").onclick = function () {
      modal.remove();
    };
    modal.addEventListener("click", function (e) {
      if (e.target === modal) modal.remove();
    });
    document.getElementById("g5-email-save").onclick = async function () {
      var email = document.getElementById("g5-email-input").value.trim();
      var msg = document.getElementById("g5-email-msg");
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        msg.textContent = "メール形式が正しくありません";
        msg.classList.add("error");
        return;
      }
      try {
        if (!window.G5Supabase) throw new Error("Supabase 未初期化");
        await G5Supabase.upsertUserProfile({
          user_id: sess.id,
          email: email || null,
          updated_at: new Date().toISOString()
        });
        msg.textContent = "保存しました";
        msg.classList.remove("error");
        setTimeout(function () {
          modal.remove();
        }, 700);
      } catch (e) {
        msg.textContent = e.message || String(e);
        msg.classList.add("error");
      }
    };
  }

  async function linkLine() {
    if (!LIFF_ID) {
      alert(
        "LINE連携（LIFF）を有効にするには、js/auth-ui.js の LIFF_ID に LINE Developers で発行した LIFF App ID を設定してください。"
      );
      return;
    }
    try {
      if (!window.liff) {
        await new Promise(function (resolve, reject) {
          var s = document.createElement("script");
          s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
          s.onload = resolve;
          s.onerror = reject;
          document.head.appendChild(s);
        });
      }
      await liff.init({ liffId: LIFF_ID });
      if (!liff.isLoggedIn()) {
        liff.login();
        return;
      }
      var profile = await liff.getProfile();
      var sess = G5.getSession();
      if (!sess) return;
      await G5Supabase.upsertUserProfile({
        user_id: sess.id,
        line_user_id: profile.userId,
        line_display_name: profile.displayName,
        updated_at: new Date().toISOString()
      });
      alert("LINEアカウントを連携しました（" + profile.displayName + "）");
    } catch (e) {
      alert("LINE連携に失敗: " + (e.message || e));
    }
  }

  function boot() {
    // login ページでは出さない
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("login.html") !== -1) return;
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }

  window.G5AuthUI = { refresh: render, openEmailModal: openEmailModal, linkLine: linkLine };
})();
