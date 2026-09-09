/**
 * G⁵ Portal - メール通知
 * 学校 Workspace がウェブアプリ「全員」不可のため、
 * Supabase mail_queue に積み → GAS 時間トリガーが送信（推奨）
 */
(function () {
  "use strict";

  /** 方式B用（通常は空でOK・Workspace制限時は使えない） */
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

  function uniqEmails(list) {
    var seen = {};
    var out = [];
    (list || []).forEach(function (e) {
      var em = String(e || "")
        .trim()
        .toLowerCase();
      if (!em || em.indexOf("@") === -1 || seen[em]) return;
      seen[em] = true;
      out.push(em);
    });
    return out;
  }

  /** users.json からロール別 user_id を解決 */
  async function resolveUserIdsByRole(to) {
    if (to !== "students" && to !== "staff") return null;
    try {
      var base = (window.G5 && G5.BASE) || (window.__G5_BASE__ || ".");
      var res = await fetch(String(base).replace(/\/$/, "") + "/src/data/users.json?t=" + Date.now(), {
        cache: "no-store"
      });
      if (!res.ok) return null;
      var users = await res.json();
      if (!Array.isArray(users)) return null;
      var ids = [];
      users.forEach(function (u) {
        if (!u || !u.id) return;
        if (to === "students") {
          if (u.role === "student" || u.role === "temporary") ids.push(u.id);
        } else if (to === "staff") {
          if (u.role === "admin" || u.role === "teacher" || u.role === "temporary") ids.push(u.id);
        }
      });
      return ids;
    } catch (e) {
      console.warn("[G5Email] users.json", e);
      return null;
    }
  }

  /**
   * to: "all" | "students" | "staff" | userId | userId[]
   * notify_email が false の行は除外（null/true は送信対象）
   */
  async function resolveEmails(to) {
    if (!window.G5Supabase || !G5Supabase.getClient) return [];
    try {
      var sb = await G5Supabase.getClient();
      var roleIds = null;
      if (to === "students" || to === "staff") {
        roleIds = await resolveUserIdsByRole(to);
        if (roleIds && !roleIds.length) return [];
      }

      var q = sb
        .from("user_profiles")
        .select("email, user_id, notify_email")
        .not("email", "is", null);

      if (Array.isArray(to) && to.length) {
        q = q.in("user_id", to);
      } else if (roleIds) {
        q = q.in("user_id", roleIds);
      } else if (typeof to === "string" && to !== "all" && to !== "students" && to !== "staff") {
        q = q.eq("user_id", to);
      }

      var res = await q;
      if (res.error) throw res.error;

      var emails = (res.data || [])
        .filter(function (r) {
          if (!r || !r.email) return false;
          /* false のみ除外。未設定・true は送る */
          if (r.notify_email === false) return false;
          return true;
        })
        .map(function (r) {
          return r.email;
        });

      return uniqEmails(emails);
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
    var list = emails && emails.length ? uniqEmails(emails) : await resolveEmails(item && item.to);
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

  /** 方式B: 直接 GAS（ドメインが「全員」許可のときのみ） */
  async function postToGas(item, emails) {
    if (!GAS_URL || !GAS_TOKEN) return { ok: false, skipped: true };
    var list = emails && emails.length ? uniqEmails(emails) : await resolveEmails(item && item.to);
    if (!list.length) return { ok: true, sent: 0, reason: "no emails" };
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
      var q = await enqueue(item, emails);
      if (q && q.ok) return q;
    } catch (e) {
      console.warn("[G5Email] queue failed", e);
    }
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
