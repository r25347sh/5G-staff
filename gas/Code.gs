/**
 * G⁵ Portal - 通知メール送信（Google Apps Script / Workspace）
 *
 * セットアップ:
 * 1. https://script.google.com で新規プロジェクト
 * 2. このファイルの内容を Code.gs に貼り付け
 * 3. SEND_TOKEN を自分だけ知っている長い文字列に変更
 * 4. 「デプロイ」→「新しいデプロイ」→ 種類: ウェブアプリ
 *    - 実行ユーザー: 自分
 *    - アクセスできるユーザー: 全員（匿名含む）
 *      ※ トークンで守る。トークン無しでは送れない
 * 5. 発行された URL をサイトの js/email.js の GAS_URL に設定
 * 6. 同じトークンを GAS_TOKEN に設定
 *
 * 差出人: このスクリプトをデプロイした Google アカウント
 * （r25347sh@hs.reitaku.jp でログインして作ること）
 */

var SEND_TOKEN = "CHANGE_ME_TO_A_LONG_SECRET_TOKEN";

function doPost(e) {
  try {
    var body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }

    if (!body.token || body.token !== SEND_TOKEN) {
      return jsonOut({ ok: false, error: "unauthorized" }, 401);
    }

    var title = String(body.title || "お知らせ");
    var text = String(body.body || "");
    var fromName = String(body.from_name || "G⁵ Portal");
    var link = String(body.link || "");
    var emails = body.emails;

    if (!emails || !emails.length) {
      return jsonOut({ ok: true, sent: 0, reason: "no recipients" });
    }

    // 念のため配列化・重複排除・簡易バリデーション
    var seen = {};
    var list = [];
    for (var i = 0; i < emails.length; i++) {
      var em = String(emails[i] || "").trim().toLowerCase();
      if (!em || seen[em]) continue;
      if (em.indexOf("@") === -1) continue;
      seen[em] = true;
      list.push(em);
    }
    if (!list.length) {
      return jsonOut({ ok: true, sent: 0, reason: "no valid emails" });
    }

    var subject = "[G⁵] " + title;
    var html =
      '<div style="font-family:sans-serif;line-height:1.6;color:#222">' +
      "<h2 style='margin:0 0 12px'>" +
      escapeHtml(title) +
      "</h2>" +
      "<p style='white-space:pre-wrap;margin:0 0 16px'>" +
      escapeHtml(text) +
      "</p>" +
      "<p style='font-size:13px;color:#666'>送信: " +
      escapeHtml(fromName) +
      "</p>" +
      (link
        ? "<p><a href='" + escapeHtml(link) + "'>ポータルで開く</a></p>"
        : "") +
      "<hr style='border:none;border-top:1px solid #eee;margin:20px 0'/>" +
      "<p style='font-size:12px;color:#999'>G⁵ Portal · 麗澤高校 5年G組スタッフ</p>" +
      "</div>";

    // Workspace の Gmail で送信（デプロイアカウントが差出人）
    // 一度に多すぎると制限に当たるので分割
    var chunk = 40;
    var sent = 0;
    for (var s = 0; s < list.length; s += chunk) {
      var part = list.slice(s, s + chunk);
      GmailApp.sendEmail(
        part[0],
        subject,
        text,
        {
          htmlBody: html,
          name: fromName,
          bcc: part.length > 1 ? part.slice(1).join(",") : undefined,
          noReply: false
        }
      );
      sent += part.length;
    }

    return jsonOut({ ok: true, sent: sent });
  } catch (err) {
    return jsonOut({ ok: false, error: String(err) }, 500);
  }
}

function doGet() {
  return jsonOut({
    ok: true,
    service: "G5 notification mail",
    hint: "POST JSON { token, title, body, emails[], from_name, link }"
  });
}

function jsonOut(obj, code) {
  var out = ContentService.createTextOutput(JSON.stringify(obj));
  out.setMimeType(ContentService.MimeType.JSON);
  return out;
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** エディタから直接実行して疎通確認 */
function testSend() {
  var result = doPost({
    postData: {
      contents: JSON.stringify({
        token: SEND_TOKEN,
        title: "GASテスト",
        body: "G⁵ Portal メール送信テストです。",
        from_name: "管理者",
        emails: [Session.getActiveUser().getEmail()],
        link: ""
      })
    }
  });
  Logger.log(result.getContent());
}
