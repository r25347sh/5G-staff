/**
 * G⁵ Portal - 通知メール送信 Edge Function
 *
 * デプロイ:
 *   supabase functions deploy send-notification-email
 *
 * Secrets（Dashboard → Edge Functions → Secrets）:
 *   RESEND_API_KEY = re_xxxx
 *   MAIL_FROM      = r25347sh@hs.reitaku.jp   ※ドメイン認証後
 *   # 認証前の暫定:
 *   # MAIL_FROM    = onboarding@resend.dev
 *   MAIL_FROM_NAME = G⁵ Portal
 *
 * Resend で hs.reitaku.jp を Domain 登録し、DNS (SPF/DKIM) を通すと
 * From: r25347sh@hs.reitaku.jp で送れます。
 */
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") || "";
const MAIL_FROM = Deno.env.get("MAIL_FROM") || "onboarding@resend.dev";
const MAIL_FROM_NAME = Deno.env.get("MAIL_FROM_NAME") || "G⁵ Portal";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: cors });
  }

  try {
    if (!RESEND_API_KEY) {
      return new Response(JSON.stringify({ ok: false, reason: "RESEND_API_KEY not set" }), {
        status: 200,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const payload = await req.json();
    const title = String(payload.title || "お知らせ");
    const body = String(payload.body || "");
    const to = payload.to ?? "all";
    const fromName = String(payload.from_name || "staff");
    const link = String(payload.link || "");

    const sb = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
    let q = sb.from("user_profiles").select("email, user_id").not("email", "is", null);
    // target が配列の場合のみ絞る（"all" は全員の登録メールへ）
    if (Array.isArray(to) && to.length) {
      q = q.in("user_id", to);
    } else if (typeof to === "string" && to !== "all" && to !== "students" && to !== "staff") {
      q = q.eq("user_id", to);
    }

    const { data: profiles, error } = await q;
    if (error) throw error;

    const emails = (profiles || [])
      .map((p: { email?: string }) => p.email)
      .filter((e: string | undefined): e is string => !!e && e.includes("@"));

    if (!emails.length) {
      return new Response(JSON.stringify({ ok: true, sent: 0, reason: "no emails" }), {
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    const html = `
      <div style="font-family:sans-serif;line-height:1.6;color:#222">
        <h2 style="margin:0 0 12px">${escapeHtml(title)}</h2>
        <p style="white-space:pre-wrap;margin:0 0 16px">${escapeHtml(body)}</p>
        <p style="font-size:13px;color:#666">送信: ${escapeHtml(fromName)}</p>
        ${link ? `<p><a href="${escapeHtml(link)}">詳細を開く</a></p>` : ""}
        <hr style="border:none;border-top:1px solid #eee;margin:20px 0" />
        <p style="font-size:12px;color:#999">G⁵ Portal · 5年G組スタッフ</p>
      </div>`;

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${MAIL_FROM_NAME} <${MAIL_FROM}>`,
        to: emails,
        subject: `[G⁵] ${title}`,
        html,
        reply_to: "r25347sh@hs.reitaku.jp",
      }),
    });

    const result = await res.json();
    if (!res.ok) {
      return new Response(JSON.stringify({ ok: false, result }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ ok: true, sent: emails.length, result }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: String(e) }), {
      status: 500,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
