/**
 * G⁵ Portal - メール通知クライアント
 * Google Apps Script (Workspace) 経由で送信
 *
 * 設定:
 *   GAS_URL   … ウェブアプリの URL
 *   GAS_TOKEN … Code.gs の SEND_TOKEN と同じ文字列
 *
 * 未設定なら何もしない（サイトは通常動作）
 */
(function () {
  "use strict";

  /* ===== ここだけ埋める ===== */
  var GAS_URL = ""; // 例: https://script.google.com/macros/s/xxxxx/exec
  var GAS_TOKEN = ""; // Code.gs の SEND_TOKEN と同じ
  /* ========================= */

  function configured() {
    return !!(GAS_URL && GAS_TOKEN && GAS_URL.indexOf("http") === 0);
  }

  /**
   * 通知1件分をメール配信
   * item: { title, body, from_name, to, link }
   * emails: string[]  （省略時は Supabase user_profiles から取得）
   */
  async function sendNotificationEmail(item, emails) {
    if (!configured()) {
      console.info("[G5Email] GAS 未設定のためスキップ");
      return { ok: false, skipped: true };
    }

    var list = emails;
    if (!list || !list.length) {
      list = await resolveEmails(item && item.to);
    }
    if (!list || !list.length) {
      return { ok: true, sent: 0, reason: "no emails" };
    }

    var payload = {
      token: GAS_TOKEN,
      title: (item && item.title) || "お知らせ",
      body: (item && item.body) || "",
      from_name: (item && item.from_name) || "G⁵ Portal",
      link: absoluteLink(item && item.link),
      emails: list
    };

    /* GAS はリダイレクトするため mode/cors に注意。text で受ける */
    var res = await fetch(GAS_URL, {
      method: "POST",
      // text/plain にすると CORS プリフライトを避けやすい
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(payload),
      redirect: "follow"
    });

    var text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: res.ok, raw: text.slice(0, 200) };
    }
  }

  function absoluteLink(link) {
    if (!link) {
      var base = (window.G5 && G5.BASE) || "";
      if (base && base !== ".") {
        return location.origin + (base.charAt(0) === "/" ? base : "/" + base) + "/notifications.html";
      }
      return location.origin + location.pathname.replace(/[^/]+$/, "") + "notifications.html";
    }
    if (/^https?:/i.test(link)) return link;
    try {
      return new URL(link, location.href).href;
    } catch (e) {
      return link;
    }
  }

  async function resolveEmails(to) {
    if (!window.G5Supabase || !G5Supabase.getClient) return [];
    try {
      var sb = await G5Supabase.getClient();
      var q = sb.from("user_profiles").select("email, user_id").not("email", "is", null);
      if (Array.isArray(to) && to.length) {
        q = q.in("user_id", to);
      } else if (typeof to === "string" && to !== "all" && to !== "students" && to !== "staff") {
        q = q.eq("user_id", to);
      }
      var res = await q;
      if (res.error) throw res.error;
      return (res.data || [])
        .map(function (r) {
          return r.email;
        })
        .filter(Boolean);
    } catch (e) {
      console.warn("[G5Email] profiles", e);
      return [];
    }
  }

  window.G5Email = {
    configured: configured,
    sendNotificationEmail: sendNotificationEmail,
    resolveEmails: resolveEmails
  };
})();
