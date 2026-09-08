/**
 * G⁵ Portal - メール通知
 * 学校 Workspace がウェブアプリ「全員」不可のため、
 * Supabase mail_queue に積み → GAS 時間トリガーが送信（推奨）
 */
(function () {
  "use strict";

  /** 方式B用（通常は空でOK） */
  var GAS_URL = "";
  var GAS_TOKEN = "";

  function absoluteLink(link) {
    if (!link) {
      try {
        return new URL("notifications.html", location.href).href;
      } catch (e) {
        return "notifications.html";
      }
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
      if (Array.isArray(to) && to.length) q = q.in("user_id", to);
      else if (typeof to === "string" && to !== "all" && to !== "students" && to !== "staff") {
        q = q.eq("user_id", to);
      }
      var res = await q;
      if (res.error) throw res.error;
      return (res.data || []).map(function (r) { return r.email; }).filter(Boolean);
    } catch (e) {
      console.warn("[G5Email] profiles", e);
      return [];
    }
  }

  /** mail_queue に積む（本線） */
  async function enqueue(item, emails) {
    if (!window.G5Supabase || !G5Supabase.getClient) {
      return { ok: false, reason: "no supabase" };
    }
    var list = emails && emails.length ? emails : await resolveEmails(item && item.to);
    if (!list.length) return { ok: true, sent: 0, reason: "no emails" };

    var sb = await G5Supabase.getClient();
    var row = {
      title: (item && item.title) || "お知らせ",
      body: (item && item.body) || "",
      from_name: (item && item.from_name) || "G⁵ Portal",
      link: absoluteLink(item && item.link),
      emails: list,
      status: "pending"
    };
    var res = await sb.from("mail_queue").insert(row).select().single();
    if (res.error) throw new Error(res.error.message);
    return { ok: true, queued: true, id: res.data && res.data.id, recipients: list.length };
  }

  /** 方式B: 直接 GAS（ドメインが「全員」許可のとき） */
  async function postToGas(item, emails) {
    if (!GAS_URL || !GAS_TOKEN) return { ok: false, skipped: true };
    var list = emails && emails.length ? emails : await resolveEmails(item && item.to);
    var res = await fetch(GAS_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({
        token: GAS_TOKEN,
        title: (item && item.title) || "お知らせ",
        body: (item && item.body) || "",
        from_name: (item && item.from_name) || "G⁵ Portal",
        link: absoluteLink(item && item.link),
        emails: list
      }),
      redirect: "follow"
    });
    var text = await res.text();
    try {
      return JSON.parse(text);
    } catch (e) {
      return { ok: res.ok, raw: text.slice(0, 200) };
    }
  }

  async function sendNotificationEmail(item, emails) {
    try {
      /* 本線: キュー */
      var q = await enqueue(item, emails);
      if (q && q.ok) return q;
    } catch (e) {
      console.warn("[G5Email] queue failed", e);
    }
    /* 予備: 直接 GAS */
    try {
      return await postToGas(item, emails);
    } catch (e2) {
      console.warn("[G5Email] gas failed", e2);
      return { ok: false, error: String(e2) };
    }
  }

  window.G5Email = {
    sendNotificationEmail: sendNotificationEmail,
    enqueue: enqueue,
    resolveEmails: resolveEmails
  };
})();
