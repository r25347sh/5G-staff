/**
 * G⁵ Portal - メール送信（学校 Workspace 向け）
 *
 * 【重要】アクセスを「大学内の全員」しか選べない場合:
 *   ウェブアプリの匿名POSTは使えません。
 *   代わりに「メールキュー方式」を使います。
 *
 * 方式A（推奨・ドメイン制限OK）:
 *   1. サイトが Supabase mail_queue に行を追加
 *   2. この GAS を 1分おきの時間主導型トリガーで実行
 *   3. GAS がキューを読んで GmailApp で送信
 *   → 「ウェブアプリ公開」不要。差出人は学校アカウント
 *
 * 方式B（アクセスを「全員」にできる場合のみ）:
 *   doPost ウェブアプリ + トークン
 *
 * セットアップ（方式A）:
 * 1. script.google.com で新規（学校アカウント r25347sh@hs.reitaku.jp）
 * 2. このコードを貼る
 * 3. SUPABASE_URL / SUPABASE_ANON_KEY を確認（下記は公開 anon）
 * 4. エディタで processMailQueue を1回実行して権限承認
 * 5. トリガー: processMailQueue / 時間主導型 / 1分おき
 */

var SUPABASE_URL = "https://ngjculhtbbxazgkkelvi.supabase.co";
var SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5namN1bGh0YmJ4YXpna2tlbHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjYyMzEsImV4cCI6MjEwNDE0MjIzMX0.2AF7s7-cwgTMGuBl5TN1INhhkTaFJ2z-7Oj8t26iu2k";

var SEND_TOKEN = "CHANGE_ME_TO_A_LONG_SECRET_TOKEN"; // 方式B用

/** トリガーから呼ぶ本体 */
function processMailQueue() {
  var pending = sbRequest("GET", "/rest/v1/mail_queue?status=eq.pending&order=created_at.asc&limit=20");
  if (!pending || !pending.length) {
    Logger.log("no pending mail");
    return;
  }

  for (var i = 0; i < pending.length; i++) {
    var row = pending[i];
    try {
      var emails = row.emails;
      if (typeof emails === "string") {
        try {
          emails = JSON.parse(emails);
        } catch (e) {
          emails = [];
        }
      }
      if (!emails || !emails.length) {
        sbRequest(
          "PATCH",
          "/rest/v1/mail_queue?id=eq." + encodeURIComponent(row.id),
          { status: "sent", sent_at: new Date().toISOString(), error: "no recipients" }
        );
        continue;
      }

      sendMail_(row.title, row.body, row.from_name, row.link, emails);

      sbRequest(
        "PATCH",
        "/rest/v1/mail_queue?id=eq." + encodeURIComponent(row.id),
        { status: "sent", sent_at: new Date().toISOString(), error: null }
      );
      Logger.log("sent " + row.id + " to " + emails.length);
    } catch (err) {
      sbRequest(
        "PATCH",
        "/rest/v1/mail_queue?id=eq." + encodeURIComponent(row.id),
        { status: "error", error: String(err).slice(0, 500) }
      );
      Logger.log("error " + row.id + " " + err);
    }
  }
}

function sendMail_(title, body, fromName, link, emails) {
  var subject = "[G⁵] " + (title || "お知らせ");
  var text = body || "";
  fromName = fromName || "G⁵ Portal";
  var html =
    '<div style="font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,\'Hiragino Sans\',\'Noto Sans JP\',sans-serif;line-height:1.65;color:#1a1525;max-width:560px;margin:0 auto;background:#f8f6fc;border-radius:16px;overflow:hidden;border:1px solid #e8e0f0;">' +
    '<div style="background:linear-gradient(105deg,#ff2d95,#c026d3);padding:18px 22px;color:#fff;">' +
    '<div style="font-size:13px;opacity:0.9;letter-spacing:0.04em;">G⁵ Portal</div>' +
    '<h1 style="margin:6px 0 0;font-size:20px;font-weight:700;">' +
    escapeHtml_(title || "お知らせ") +
    "</h1></div>" +
    '<div style="padding:22px 22px 8px;">' +
    "<p style='white-space:pre-wrap;margin:0 0 18px;font-size:15px;color:#2a2438;'>" +
    escapeHtml_(text) +
    "</p>" +
    (link
      ? "<p style='margin:0 0 18px;'><a href='" +
        escapeHtml_(link) +
        "' style='display:inline-block;padding:10px 18px;background:linear-gradient(105deg,#ff2d95,#c026d3);color:#fff;text-decoration:none;border-radius:999px;font-weight:600;font-size:14px;'>ポータルで開く</a></p>"
      : "") +
    "<p style='font-size:13px;color:#6b6280;margin:0;'>送信: " +
    escapeHtml_(fromName) +
    "</p></div>" +
    "<div style='padding:14px 22px 18px;border-top:1px solid #ebe4f4;background:#f0ebf7;'><p style='margin:0;font-size:12px;color:#8a8199;'>G⁵ Portal · 麗澤高校 5年G組スタッフ</p></div></div>";

  var list = [];
  var seen = {};
  for (var i = 0; i < emails.length; i++) {
    var em = String(emails[i] || "")
      .trim()
      .toLowerCase();
    if (!em || seen[em] || em.indexOf("@") === -1) continue;
    seen[em] = true;
    list.push(em);
  }
  if (!list.length) return;

  var chunk = 40;
  for (var s = 0; s < list.length; s += chunk) {
    var part = list.slice(s, s + chunk);
    GmailApp.sendEmail(part[0], subject, text, {
      htmlBody: html,
      name: fromName,
      bcc: part.length > 1 ? part.slice(1).join(",") : undefined
    });
  }
}

function sbRequest(method, path, body) {
  var url = SUPABASE_URL + path;
  var headers = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: "Bearer " + SUPABASE_ANON_KEY,
    "Content-Type": "application/json",
    Prefer: method === "PATCH" ? "return=minimal" : "return=representation"
  };
  var options = {
    method: method,
    headers: headers,
    muteHttpExceptions: true
  };
  if (body) options.payload = JSON.stringify(body);
  var res = UrlFetchApp.fetch(url, options);
  var code = res.getResponseCode();
  var text = res.getContentText();
  if (code >= 400) {
    throw new Error("Supabase " + code + " " + text.slice(0, 200));
  }
  if (!text) return null;
  return JSON.parse(text);
}

function escapeHtml_(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** 手動テスト: キューに自分宛を1件入れてから実行してもよい */
function testSendSelf() {
  var me = Session.getActiveUser().getEmail();
  sendMail_("GASテスト", "G⁵ メール送信テストです。", "管理者", "", [me]);
  Logger.log("sent to " + me);
}

/* ===== 方式B: ウェブアプリ（「全員」が選べるときだけ） ===== */
function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    if (!body.token || body.token !== SEND_TOKEN) {
      return ContentService.createTextOutput(JSON.stringify({ ok: false, error: "unauthorized" })).setMimeType(
        ContentService.MimeType.JSON
      );
    }
    sendMail_(body.title, body.body, body.from_name, body.link, body.emails || []);
    return ContentService.createTextOutput(JSON.stringify({ ok: true })).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ ok: false, error: String(err) })).setMimeType(
      ContentService.MimeType.JSON
    );
  }
}

function doGet() {
  return ContentService.createTextOutput(
    JSON.stringify({ ok: true, mode: "queue-trigger preferred for Workspace domain lock" })
  ).setMimeType(ContentService.MimeType.JSON);
}
