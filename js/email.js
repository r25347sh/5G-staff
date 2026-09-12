/**
 * G⁵ Portal - メール通知
 * 本線: Supabase mail_queue → GAS トリガーが GmailApp で送信
 * 補助: Edge Function (Resend) が設定されていれば並行送信
 */
(function () {
  "use strict";

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

  async function resolveUserIdsByRole(to) {
    if (to !== "students" && to !== "staff") return null;
    try {
      var base = (window.G5 && G5.BASE) || window.__G5_BASE__ || ".";
      var res = await fetch(
        String(base).replace(/\/$/, "") + "/src/data/users.json?t=" + Date.now(),
        { cache: "no-store" }
      );
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

  async function enqueue(item, emails) {
    if (!window.G5Supabase || !G5Supabase.getClient) {
      return { ok: false, reason: "no supabase" };
    }
    var list = emails && emails.length ? uniqEmails(emails) : await resolveEmails(item && item.to);
    if (!list.length) {
      return {
        ok: true,
        sent: 0,
        queued: false,
        recipients: 0,
        reason: "no emails — user_profiles にメール登録がありません"
      };
    }

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
    return {
      ok: true,
      queued: true,
      id: res.data && res.data.id,
      recipients: list.length,
      emails: list,
      via: "mail_queue"
    };
  }

  async function postToGas(item, emails) {
    if (!GAS_URL || !GAS_TOKEN) return { ok: false, skipped: true, reason: "GAS_URL empty" };
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

  async function postToEdge(item, emails) {
    if (!window.G5Supabase || !G5Supabase.getClient) {
      return { ok: false, skipped: true, reason: "no supabase" };
    }
    try {
      var list = emails && emails.length ? uniqEmails(emails) : await resolveEmails(item && item.to);
      var sb = await G5Supabase.getClient();
      var result = await sb.functions.invoke("send-notification-email", {
        body: {
          title: (item && item.title) || "お知らせ",
          body: (item && item.body) || "",
          to: (item && item.to) != null ? item.to : "all",
          from_name: (item && item.from_name) || "G⁵ Portal",
          link: absoluteLink(item && item.link),
          emails: list
        }
      });
      if (result.error) {
        return { ok: false, via: "edge", error: String(result.error.message || result.error) };
      }
      var data = result.data || {};
      return {
        ok: !!data.ok,
        via: "edge",
        sent: data.sent || 0,
        reason: data.reason || null,
        raw: data
      };
    } catch (e) {
      return { ok: false, via: "edge", error: String(e.message || e) };
    }
  }

  /**
   * 本線 mail_queue + 補助 Edge Function
   * 常に詳細ステータスを返す
   */
  async function sendNotificationEmail(item, emails) {
    var results = { ok: false, paths: [] };
    var resolved =
      emails && emails.length ? uniqEmails(emails) : await resolveEmails(item && item.to);

    if (!resolved.length) {
      return {
        ok: true,
        recipients: 0,
        reason: "no emails — 受信者が user_profiles にメール登録していません（アカウントメニュー→メール登録）",
        paths: []
      };
    }

    /* 1) mail_queue（GAS 用） */
    try {
      var q = await enqueue(item, resolved);
      results.paths.push(q);
      if (q && q.ok && q.queued) {
        results.ok = true;
        results.queued = true;
        results.recipients = q.recipients;
        results.id = q.id;
        results.via = "mail_queue";
      } else if (q && q.ok && q.recipients === 0) {
        results.reason = q.reason;
      }
    } catch (e) {
      console.warn("[G5Email] queue failed", e);
      results.paths.push({ ok: false, via: "mail_queue", error: String(e.message || e) });
    }

    /* 2) Edge Function（Resend）— Secrets が無ければ ok:false で戻るだけ */
    try {
      var edge = await postToEdge(item, resolved);
      results.paths.push(edge);
      if (edge && edge.ok && (edge.sent || 0) > 0) {
        results.ok = true;
        results.edgeSent = edge.sent;
        if (!results.via) results.via = "edge";
      }
    } catch (e2) {
      results.paths.push({ ok: false, via: "edge", error: String(e2.message || e2) });
    }

    /* 3) GAS 直接（通常無効） */
    try {
      var gas = await postToGas(item, resolved);
      if (gas && !gas.skipped) {
        results.paths.push(gas);
        if (gas.ok) {
          results.ok = true;
          if (!results.via) results.via = "gas";
        }
      }
    } catch (e3) {
      results.paths.push({ ok: false, via: "gas", error: String(e3.message || e3) });
    }

    if (!results.ok && !results.reason) {
      results.reason = "メール送信に失敗しました（mail_queue / Edge とも失敗）";
    }
    if (results.ok && results.queued) {
      results.hint =
        "mail_queue に追加しました。GAS トリガー（processMailQueue）1〜5分以内に送信されます。";
    }
    console.info("[G5Email] result", results);
    return results;
  }

  /** 管理画面用: キュー状態 */
  async function getQueueStats() {
    if (!window.G5Supabase || !G5Supabase.getClient) {
      return { ok: false, reason: "no supabase" };
    }
    try {
      var sb = await G5Supabase.getClient();
      var pending = await sb
        .from("mail_queue")
        .select("id, title, status, created_at, error, emails", { count: "exact" })
        .eq("status", "pending")
        .order("created_at", { ascending: false })
        .limit(10);
      var recent = await sb
        .from("mail_queue")
        .select("id, title, status, created_at, error, sent_at")
        .order("created_at", { ascending: false })
        .limit(15);
      var profiles = await sb
        .from("user_profiles")
        .select("user_id, email, notify_email")
        .not("email", "is", null);
      return {
        ok: true,
        pendingCount: pending.count != null ? pending.count : (pending.data || []).length,
        pending: pending.data || [],
        recent: recent.data || [],
        registeredEmails: (profiles.data || []).filter(function (p) {
          return p.email && p.notify_email !== false;
        }).length
      };
    } catch (e) {
      return { ok: false, error: String(e.message || e) };
    }
  }

  window.G5Email = {
    sendNotificationEmail: sendNotificationEmail,
    enqueue: enqueue,
    resolveEmails: resolveEmails,
    getQueueStats: getQueueStats
  };
})();
