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
      "display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:700;color:#0a0714;overflow:hidden;flex-shrink:0}",
      ".g5-account-avatar img{width:100%;height:100%;object-fit:cover;display:block}",
      ".g5-account-meta .line-badge{font-size:.7rem;color:#06c755;margin-top:.2rem}",
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
    var avatarHtml =
      sess.line_picture_url
        ? '<img src="' +
          String(sess.line_picture_url).replace(/"/g, "&quot;") +
          '" alt="" referrerpolicy="no-referrer">'
        : initial;
    var lineBadge =
      sess.line_user_id
        ? '<div class="line-badge">LINE連携済み' +
          (sess.line_display_name ? " · " + sess.line_display_name : "") +
          "</div>"
        : "";
    var lineBtnLabel = sess.line_user_id ? "💬 LINE連携を更新" : "💬 LINEアカウント連携";
    bar.innerHTML =
      '<div class="g5-account-wrap" id="g5-account-wrap">' +
      '<button type="button" class="g5-account-btn" id="g5-account-btn" aria-haspopup="true" aria-expanded="false">' +
      '<span class="g5-account-avatar">' +
      avatarHtml +
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
      "</div>" +
      lineBadge +
      "</div>" +
      '<button type="button" id="g5-btn-email" role="menuitem">✉️ メールアドレス登録</button>' +
      '<button type="button" id="g5-btn-line" role="menuitem">' +
      lineBtnLabel +
      "</button>" +
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
          notify_email: email ? true : false,
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

  /**
   * LIFF の redirectUri は「Endpoint URL で始まる URL」である必要がある。
   * クエリ付き location.href を渡すと access.line.me で 400 になることが多いため、
   * origin + pathname のみを使う。戻り先は sessionStorage に別保存。
   */
    function getLiffRedirectUri(preferLoginPage) {
    var origin = location.origin || "";
    var pathname = location.pathname || "/";
    if (preferLoginPage) {
      /* 同一ディレクトリの login.html（GitHub Pages の /repo/login.html 対応） */
      if (/login\.html$/i.test(pathname)) {
        return origin + pathname;
      }
      var dir = pathname.replace(/\/[^/]*$/, "/");
      if (dir.indexOf("/") !== 0) dir = "/" + dir;
      return origin + dir + "login.html";
    }
    return origin + pathname;
  }
function stashLineReturn() {
    try {
      sessionStorage.setItem("g5_line_return", location.href.split("#")[0]);
      var params = new URLSearchParams(location.search || "");
      var next = params.get("next");
      if (next) sessionStorage.setItem("g5_line_next", next);
    } catch (e) {}
  }

  function consumeLineNext() {
    try {
      var n = sessionStorage.getItem("g5_line_next");
      if (n) {
        sessionStorage.removeItem("g5_line_next");
        return n;
      }
    } catch (e) {}
    return null;
  }

  var _liffInitPromise = null;

  async function ensureLiff() {
    if (!LIFF_ID || LIFF_ID.indexOf("ここに") !== -1) {
      throw new Error(
        "LIFF_ID 未設定です。LINE Developers で LIFF アプリを作成し、js/auth-ui.js の LIFF_ID を設定してください。"
      );
    }
    if (!window.liff) {
      await new Promise(function (resolve, reject) {
        var existing = document.querySelector('script[src*="liff/edge"]');
        if (existing) {
          existing.addEventListener("load", resolve);
          existing.addEventListener("error", function () {
            reject(new Error("LIFF SDK の読み込みに失敗しました"));
          });
          /* 既に load 済みの場合 */
          if (window.liff) resolve();
          return;
        }
        var s = document.createElement("script");
        s.src = "https://static.line-scdn.net/liff/edge/2/sdk.js";
        s.async = true;
        s.onload = resolve;
        s.onerror = function () {
          reject(new Error("LIFF SDK の読み込みに失敗しました（ネットワーク）"));
        };
        document.head.appendChild(s);
      });
    }
    if (!_liffInitPromise) {
      _liffInitPromise = liff
        .init({
          liffId: LIFF_ID,
          /* 外部ブラウザ（Chrome 等）でもログインできるようにする */
          withLoginOnExternalBrowser: true
        })
        .catch(function (err) {
          _liffInitPromise = null;
          var msg = (err && (err.message || err.code)) || String(err);
          throw new Error(
            "LIFF 初期化に失敗: " +
              msg +
              "\n\nLINE Developers の Endpoint URL がこのサイトの URL（例: https://＜user＞.github.io/5G-staff/）と一致しているか確認してください。"
          );
        });
    }
    await _liffInitPromise;
  }

  /** LINE ログイン画面へ。redirectUri はクエリ無しの正規 URL のみ */
  async function startLineLogin(options) {
    options = options || {};
    await ensureLiff();
    if (liff.isLoggedIn()) return true;
    stashLineReturn();
    try {
      sessionStorage.setItem("g5_line_pending", "1");
    } catch (e) {}
    var redirectUri = getLiffRedirectUri(!!options.preferLoginPage);
    try {
      liff.login({ redirectUri: redirectUri });
    } catch (e) {
      /* redirectUri 拒否時はデフォルト（Endpoint URL）へフォールバック */
      console.warn("[LINE] login with redirectUri failed, retry default", e);
      liff.login();
    }
    return false;
  }

  async function linkLine() {
    try {
      await ensureLiff();
      if (!liff.isLoggedIn()) {
        await startLineLogin({ preferLoginPage: false });
        return;
      }
      var profile = await liff.getProfile();
      var sess = G5.getSession();
      if (!sess) {
        alert("先にポータルにログインしてから LINE 連携を行ってください。");
        return;
      }
      if (!window.G5Supabase) throw new Error("Supabase 未初期化");
      await G5Supabase.upsertUserProfile({
        user_id: sess.id,
        line_user_id: profile.userId,
        line_display_name: profile.displayName,
        line_picture_url: profile.pictureUrl || null,
        updated_at: new Date().toISOString()
      });
      /* セッションにも反映してアイコン即時更新 */
      G5.setSession({
        id: sess.id,
        name: sess.name,
        role: sess.role,
        line_user_id: profile.userId,
        line_display_name: profile.displayName,
        line_picture_url: profile.pictureUrl || null
      });
      alert(
        "LINEアカウントを連携しました（" +
          profile.displayName +
          "）\n\n【LINE連携の恩恵】\n・プロフィール画像がアイコンに表示\n・次回から LINE ログインで自動サインイン可能\n・連携状態がメニューに表示"
      );
      render();
    } catch (e) {
      alert("LINE連携に失敗: " + (e.message || e));
    }
  }

  /**
   * LINE がログイン済み & ポータルに紐づいている場合に自動ログイン
   * （未ログイン時に呼ばれる）
   */
  async function tryAutoLoginWithLine(options) {
    options = options || {};
    if (G5.getSession()) return false;
    try {
      /*
       * force なしでは SDK 初期化もしない（index を開くだけで LINE ログイン画面に飛ぶのを防ぐ）
       * 許可: ユーザー操作後 / LINE から戻ってきた直後 / 既に liff 初期化済み
       */
      var returning = false;
      try {
        returning = sessionStorage.getItem("g5_line_pending") === "1";
      } catch (e) {}
      if (!options.force && !returning && !window.liff) {
        return false;
      }
      await ensureLiff();
      if (!liff.isLoggedIn()) return false;
      var profile = await liff.getProfile();
      if (!window.G5Supabase) return false;
      var linked = await G5Supabase.getUserProfileByLineId(profile.userId);
      if (!linked || !linked.user_id) return false;

      /* users.json から名前・ロールを取得 */
      var usersRes = await fetch(
        (window.G5 && G5.BASE ? G5.BASE : ".") + "/src/data/users.json?t=" + Date.now()
      );
      var users = await usersRes.json();
      var u = users.find(function (x) {
        return x.id === linked.user_id;
      });
      if (!u) return false;

      G5.setSession({
        id: u.id,
        name: u.name,
        role: u.role,
        line_user_id: profile.userId,
        line_display_name: profile.displayName || linked.line_display_name,
        line_picture_url: profile.pictureUrl || linked.line_picture_url || null
      });
      G5.setLastLoginId(u.id);
      try {
        sessionStorage.removeItem("g5_line_pending");
      } catch (e) {}

      /* プロフィール画像が変わっていたら更新 */
      if (profile.pictureUrl && profile.pictureUrl !== linked.line_picture_url) {
        G5Supabase.upsertUserProfile({
          user_id: u.id,
          line_user_id: profile.userId,
          line_display_name: profile.displayName,
          line_picture_url: profile.pictureUrl,
          updated_at: new Date().toISOString()
        }).catch(function () {});
      }
      return true;
    } catch (e) {
      console.warn("LINE auto-login skipped:", e);
      return false;
    }
  }

  async function boot() {
    // login ページではヘッダーUIは出さない（ログインページ側で LINE を扱う）
    var path = (location.pathname || "").toLowerCase();
    if (path.indexOf("login.html") !== -1) return;

    /*
     * 一般ページでは LINE 自動ログインしない。
     * （ensureLiff / liff.init が原因で LINE ログイン画面へ飛ばされるのを防ぐ）
     * LINE ログインは login.html のボタン、またはアカウントメニューの連携からのみ。
     */
    if (G5.getSession()) {
      try {
        var sess = G5.getSession();
        if (sess && !sess.line_picture_url && window.G5Supabase) {
          var p = await G5Supabase.getUserProfile(sess.id);
          if (p && (p.line_picture_url || p.line_user_id)) {
            G5.setSession({
              id: sess.id,
              name: sess.name,
              role: sess.role,
              line_user_id: p.line_user_id || sess.line_user_id,
              line_display_name: p.line_display_name || sess.line_display_name,
              line_picture_url: p.line_picture_url || null
            });
          }
        }
      } catch (e) {}
    }
    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      boot();
    });
  } else {
    boot();
  }

  window.G5AuthUI = {
    refresh: render,
    openEmailModal: openEmailModal,
    linkLine: linkLine,
    tryAutoLoginWithLine: tryAutoLoginWithLine,
    ensureLiff: ensureLiff,
    startLineLogin: startLineLogin,
    getLiffRedirectUri: getLiffRedirectUri,
    consumeLineNext: consumeLineNext
  };
})();
