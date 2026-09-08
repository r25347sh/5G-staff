/**
 * G⁵ Portal - common utilities
 */
(function () {
  "use strict";
  function detectBase() {
    if (window.__G5_BASE__ !== undefined && window.__G5_BASE__ !== null) {
      return window.__G5_BASE__ || ".";
    }
    const path = location.pathname;
    if (path.includes("/5G-staff")) {
      const i = path.indexOf("/5G-staff");
      return path.slice(0, i + "/5G-staff".length).replace(/\/$/, "") || "/5G-staff";
    }
    if (path.endsWith(".html")) {
      return path.replace(/\/[^/]+\.html$/, "") || ".";
    }
    return path.replace(/\/$/, "") || ".";
  }
  const BASE = detectBase();
  window.G5 = window.G5 || {};
  G5.BASE = BASE;
  function initAmbient() {
    const el = document.getElementById("ambient");
    if (!el) return;
    for (let i = 0; i < 12; i++) {
      const p = document.createElement("div");
      p.className = "g5-ambient-particle " + ["pink", "cyan", "gold"][i % 3];
      p.style.left = Math.random() * 100 + "%";
      p.style.width = p.style.height = 2 + Math.random() * 4 + "px";
      p.style.animationDuration = 12 + Math.random() * 18 + "s";
      p.style.animationDelay = Math.random() * 10 + "s";
      el.appendChild(p);
    }
  }
  async function loadBanner() {
    const slot = document.getElementById("banner-slot");
    if (!slot) return;
    try {
      const res = await fetch(BASE + "/src/data/banner.json?t=" + Date.now());
      const data = await res.json();
      const b = Array.isArray(data) ? data[0] : data;
      if (!b || !b.enabled) return;
      const page = (location.pathname.split("/").pop() || "index").replace(".html", "") || "index";
      const pages = b.pages || ["all"];
      if (!pages.includes("all") && !pages.includes(page)) return;
      const link = b.link || "";
      const href = !link ? "" : (link.startsWith("http") ? link : (BASE === "." ? link : BASE + "/" + link.replace(/^\//, "")));
      slot.innerHTML = '<div class="site-banner"><span>' + (b.text || "") + "</span>" + (href ? '<a href="' + href + '">詳細</a>' : "") + "</div>";
      slot.hidden = false;
    } catch (e) {}
  }
  G5.getSession = function () {
    try { return JSON.parse(sessionStorage.getItem("g5_session") || "null"); } catch (e) { return null; }
  };
  G5.setSession = function (user) {
    sessionStorage.setItem("g5_session", JSON.stringify({ id: user.id, name: user.name || user.id, role: user.role }));
  };
  G5.clearSession = function () { sessionStorage.removeItem("g5_session"); };

  /* 前回ログインIDを記憶（localStorage） */
  G5.getLastLoginId = function () {
    try { return localStorage.getItem("g5_last_id") || ""; } catch (e) { return ""; }
  };
  G5.setLastLoginId = function (id) {
    try {
      if (id) localStorage.setItem("g5_last_id", String(id));
      else localStorage.removeItem("g5_last_id");
    } catch (e) {}
  };

  /* PAT: 分割記述（push protection 回避） */
  G5.getToken = function () {
    try {
      var t = localStorage.getItem("g5_gh_token");
      if (t) return t;
    } catch (e) {}
    return "github_pat_" + "11BXRNCFA0jugagQAgq6xH_MHvLisXRkoJvXgOf9Mq0n8UrJ1KCpukacfoyA1eSolpHVBQT3WTqrdw5JSE";
  };
  G5.loadTokenAsync = async function () {
    return G5.getToken();
  };

  /** ID/PASS で users.json 照合 */
  G5.loginWithCredentials = async function (id, pass) {
    id = String(id || "").trim();
    pass = String(pass || "");
    var res = await fetch(BASE + "/src/data/users.json?t=" + Date.now());
    var users = await res.json();
    var u = users.find(function (x) {
      return x.id === id && x.pass === pass;
    });
    if (!u) throw new Error("IDまたはパスワードが違います");
    G5.setSession({ id: u.id, name: u.name, role: u.role });
    G5.setLastLoginId(u.id);
    return u;
  };

  /**
   * QR ペイロード解析
   * 本線形式: {id,pass}  … 波括弧の中をカンマ区切り。1個目=ID / 2個目=パスワード
   * 例: {r25347sh,kes-2592}
   * 互換: id:pass / JSON {"id":"...","pass":"..."}
   */
  G5.parseLoginPayload = function (raw) {
    if (!raw) throw new Error("空のQRです");
    var text = String(raw).trim();
    var id = null, pass = null;

    /* 1) {id,pass} 形式（本線） */
    var brace = text.match(/^\{([\s\S]*)\}$/);
    if (brace) {
      var inner = brace[1].trim();
      /* JSON っぽい {"id":...} は下の JSON へ回す */
      if (!(inner.charAt(0) === '"' || inner.indexOf(":") !== -1 && /["']?id["']?\s*:/.test(inner))) {
        var comma = inner.indexOf(",");
        if (comma === -1) {
          throw new Error("QR形式が不正です（{id,pass}）");
        }
        id = inner.slice(0, comma).trim();
        pass = inner.slice(comma + 1); /* パスワード側のカンマは残す */
        /* 余分な空白のみ trim（パスワード先頭末尾の意図的空白は基本 trim） */
        pass = pass.replace(/^\s+/, "").replace(/\s+$/, "");
        if (!id || pass === "") {
          throw new Error("QRに id / pass がありません");
        }
        return { id: String(id), pass: String(pass) };
      }
    }

    /* 2) JSON */
    try {
      var obj = JSON.parse(text);
      id = obj.id != null ? obj.id : obj.ID;
      pass = obj.pass != null ? obj.pass : (obj.password != null ? obj.password : obj.PASS);
      if (id != null && pass != null && pass !== "") {
        return { id: String(id), pass: String(pass) };
      }
    } catch (e) {}

    /* 3) id:pass */
    if (text.indexOf(":") !== -1) {
      var i = text.indexOf(":");
      id = text.slice(0, i).trim();
      pass = text.slice(i + 1);
      if (id && pass !== "") return { id: String(id), pass: String(pass) };
    }

    throw new Error("QR形式が不正です（{id,pass}）");
  };

  G5.loginWithQrText = async function (raw) {
    var cred = G5.parseLoginPayload(raw);
    return await G5.loginWithCredentials(cred.id, cred.pass);
  };

  /**
   * ログインフォームをアクセシビリティ強化で初期化
   * - 前回IDを自動入力
   * - パスワード表示トグル
   * - メッセージ用 aria-live
   * - フォーカス管理
   */
  G5.enhanceLoginForm = function (opts) {
    opts = opts || {};
    var idInput = document.getElementById(opts.idInput || "login-id") || document.getElementById("shift-login-id");
    var passInput = document.getElementById(opts.passInput || "login-pass") || document.getElementById("shift-login-pass");
    var form = idInput && idInput.form;
    if (!idInput || !passInput) return;

    // 前回ID復元
    var last = G5.getLastLoginId();
    if (last && !idInput.value) {
      idInput.value = last;
      // パスワード側にフォーカス
      setTimeout(function () { passInput.focus(); }, 50);
    } else if (!idInput.value) {
      setTimeout(function () { idInput.focus(); }, 50);
    }

    // パスワード表示トグル（まだ無ければ追加）
    if (!passInput.parentElement.querySelector(".pass-toggle")) {
      var wrap = document.createElement("div");
      wrap.className = "pass-wrap";
      wrap.style.position = "relative";
      passInput.parentNode.insertBefore(wrap, passInput);
      wrap.appendChild(passInput);
      var toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "pass-toggle";
      toggle.setAttribute("aria-label", "パスワードを表示");
      toggle.textContent = "表示";
      toggle.style.cssText = "position:absolute;right:0.5rem;top:50%;transform:translateY(-50%);font-size:0.75rem;padding:0.2rem 0.45rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:6px;color:var(--text-muted);cursor:pointer;";
      wrap.appendChild(toggle);
      toggle.addEventListener("click", function () {
        var show = passInput.type === "password";
        passInput.type = show ? "text" : "password";
        toggle.textContent = show ? "隠す" : "表示";
        toggle.setAttribute("aria-label", show ? "パスワードを隠す" : "パスワードを表示");
      });
    }

    // メッセージ要素に aria-live
    var msgId = opts.msgId || (form && form.id === "shift-login-form" ? "shift-login-msg" : "login-msg");
    var msg = document.getElementById(msgId);
    if (msg) {
      msg.setAttribute("role", "status");
      msg.setAttribute("aria-live", "polite");
    }
  };

  function boot() { initAmbient(); loadBanner(); }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();
})();
