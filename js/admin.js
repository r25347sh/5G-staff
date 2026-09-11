/**
 * G⁵ Portal - admin.js
 * 日付固定 9/12・役割固定・急募・CSV/PDF・テーブル追加・CSVインポート
 */
(function () {
  "use strict";
  var BASE = (window.G5 && G5.BASE) || ".";
  var REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };
  var ALLOWED = ["admin", "teacher", "temporary"];
  var TANTO_OPTIONS = ["受付", "総務", "ブラックジャック", "ポーカー", "チンチロ"];
  var EVENT_DATE = "2026-09-12";
  var shiftsCache = [];
  var usersCache = [];
  var editIndex = -1;

  async function apiPut(path, content, message) {
    var token = (G5.loadTokenAsync ? await G5.loadTokenAsync() : G5.getToken());
    if (!token) throw new Error("token unavailable");
    var url = "https://api.github.com/repos/" + REPO.owner + "/" + REPO.repo + "/contents/" + path;
    var sha = null;
    var getRes = await fetch(url + "?ref=" + REPO.branch, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
    });
    if (getRes.ok) sha = (await getRes.json()).sha;
    var body = {
      message: message || "update via G5 Portal admin",
      content: btoa(unescape(encodeURIComponent(content))),
      branch: REPO.branch
    };
    if (sha) body.sha = sha;
    var res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(res.status + " " + (await res.text()).slice(0, 200));
    return await res.json();
  }

  function showMsg(el, text, isErr) {
    if (!el) return;
    el.textContent = text;
    el.classList.toggle("error", !!isErr);
  }

  async function doLogin(e) {
    e.preventDefault();
    var id = document.getElementById("login-id").value.trim();
    var pass = document.getElementById("login-pass").value;
    var msg = document.getElementById("login-msg");
    try {
      var u = await G5.loginWithCredentials(id, pass);
      if (ALLOWED.indexOf(u.role) === -1) {
        G5.clearSession();
        showMsg(msg, "管理権限がありません", true);
        return;
      }
      enterAdmin(u);
    } catch (err) {
      showMsg(msg, err.message || String(err), true);
    }
  }

  function enterAdmin(u) {
    document.getElementById("login-section").hidden = true;
    document.getElementById("admin-panel").hidden = false;
    document.getElementById("admin-user-label").textContent = (u.name || u.id) + "（" + u.role + "）";
    loadAdminData();
  }

  function fillUserSelects() {
    fillNotifyUsers && fillNotifyUsers();
    var opts = usersCache.map(function (u) {
      return '<option value="' + u.id + '">' + (u.name || u.id) + " (" + u.role + ")</option>";
    }).join("");
    var empty = '<option value="">— 選択 —</option>';
    var el = document.getElementById("shift-user");
    if (el) el.innerHTML = empty + opts;
    var bulk = document.getElementById("bulk-users");
    if (bulk) {
      bulk.innerHTML = usersCache.map(function (u) {
        return '<label class="chk-label bulk-user-item"><input type="checkbox" value="' + u.id + '"> ' + (u.name || u.id) + "</label>";
      }).join("");
    }
    var urgentTargets = document.getElementById("urgent-targets");
    if (urgentTargets) {
      urgentTargets.innerHTML = usersCache.map(function (u) {
        return '<label class="chk-label bulk-user-item"><input type="checkbox" class="urgent-target-cb" value="' + u.id + '"> ' + (u.name || u.id) + "</label>";
      }).join("");
    }
  }

  function fillTantoSelects() {
    var opts = TANTO_OPTIONS.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
    ["shift-tanto", "bulk-tanto", "urgent-tanto"].forEach(function (id) {
      var el = document.getElementById(id);
      if (el) el.innerHTML = '<option value="">— 役割 —</option>' + opts;
    });
  }

  async function loadAdminData() {
    var pair = await Promise.all([G5Shift.loadShifts(), G5Shift.loadUsers()]);
    shiftsCache = pair[0];
    usersCache = pair[1];
    fillUserSelects();
    fillTantoSelects();
    renderAdminShifts();
    initTableAdd(12);
    try {
      var b = await (await fetch(BASE + "/src/data/banner.json?t=" + Date.now())).json();
      var banner = Array.isArray(b) ? b[0] : b;
      document.getElementById("banner-enabled").checked = !!banner.enabled;
      document.getElementById("banner-text").value = banner.text || "";
      document.getElementById("banner-link").value = banner.link || "";
      var pages = banner.pages || [];
      document.querySelectorAll(".banner-page").forEach(function (cb) {
        cb.checked = pages.indexOf(cb.value) !== -1;
      });
    } catch (e) {}
  }

  function renderAdminShifts() {
    var map = Object.fromEntries(usersCache.map(function (u) { return [u.id, u]; }));
    var el = document.getElementById("admin-shift-list");
    if (!el) return;
    var sorted = shiftsCache.slice().sort(function (a, b) {
      var da = (a.date || EVENT_DATE) + a.time_start;
      var db = (b.date || EVENT_DATE) + b.time_start;
      return da < db ? -1 : da > db ? 1 : 0;
    });
    if (!sorted.length) {
      el.innerHTML = '<p class="empty-msg">シフトなし</p>';
      return;
    }
    var html = '<div class="shift-table-wrap admin-table-wrap"><table class="shift-table admin-shift-table"><thead><tr><th>時間</th><th>担当</th><th>役割</th><th>状態</th><th>メモ</th><th></th></tr></thead><tbody>';
    sorted.forEach(function (s) {
      var i = shiftsCache.indexOf(s);
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      var filled = s.slots_filled || (s.assignees && s.assignees.length) || 0;
      var needed = s.slots_needed || 1;
      var name = isOpen ? ((s.urgent ? "⚡急募" : "募集") + " " + filled + "/" + needed) : ((map[s.user_id] || {}).name || s.user_id);
      var st = s.urgent && isOpen ? "急募中" : isOpen ? "募集中" : "確定";
      var note = s.note || "";
      if (isOpen && s.target && s.target !== "all") {
        var tn = (Array.isArray(s.target) ? s.target : [s.target]).map(function (id) { return (map[id] || {}).name || id; }).join(", ");
        note = (note ? note + " / " : "") + "対象:" + tn;
      }
      html += '<tr class="shift-row' + (s.urgent ? " is-urgent" : "") + '" data-i="' + i + '"><td>' + s.time_start + " – " + s.time_end + "</td><td>" + name + "</td><td>" + (s.tanto || "") + "</td><td>" + st + '</td><td class="col-note">' + (note || "—") + '</td><td class="col-act"><button type="button" class="btn btn-ghost btn-edit" data-i="' + i + '">編集</button> <button type="button" class="btn btn-ghost btn-del" data-i="' + i + '">削除</button></td></tr>';
    });
    html += "</tbody></table></div>";
    el.innerHTML = html;
  }

  function fillForm(i) {
    var s = shiftsCache[i];
    if (!s) return;
    editIndex = i;
    var userEl = document.getElementById("shift-user");
    if (userEl) userEl.value = s.user_id && s.user_id !== "open" ? s.user_id : "";
    document.getElementById("shift-start").value = s.time_start;
    document.getElementById("shift-end").value = s.time_end;
    var tantoEl = document.getElementById("shift-tanto");
    if (tantoEl) {
      if (s.tanto && TANTO_OPTIONS.indexOf(s.tanto) === -1) {
        tantoEl.insertAdjacentHTML("beforeend", '<option value="' + s.tanto + '">' + s.tanto + "</option>");
      }
      tantoEl.value = s.tanto || "";
    }
    document.getElementById("btn-add-shift").textContent = "更新";
  }

  function resetForm() {
    editIndex = -1;
    var tanto = document.getElementById("shift-tanto");
    if (tanto) tanto.value = "";
    document.getElementById("btn-add-shift").textContent = "追加";
  }

  function addShift() {
    var user_id = document.getElementById("shift-user").value;
    var time_start = document.getElementById("shift-start").value;
    var time_end = document.getElementById("shift-end").value;
    var tanto = document.getElementById("shift-tanto").value.trim();
    if (!user_id || !time_start || !time_end) { alert("担当者・開始・終了は必須です"); return; }
    var payload = { user_id: user_id, date: EVENT_DATE, time_start: time_start, time_end: time_end, tanto: tanto, open: false, urgent: false };
    if (editIndex >= 0) {
      shiftsCache[editIndex] = Object.assign({}, shiftsCache[editIndex], payload);
      resetForm();
    } else {
      shiftsCache.push(Object.assign({ shift_id: "s" + Math.random().toString(36).slice(2, 10) }, payload));
    }
    renderAdminShifts();
  }

  function bulkAdd() {
    var time_start = document.getElementById("bulk-start").value;
    var time_end = document.getElementById("bulk-end").value;
    var tanto = document.getElementById("bulk-tanto").value.trim();
    var checks = document.querySelectorAll("#bulk-users input[type=checkbox]:checked");
    if (!time_start || !time_end) { alert("時間を入力してください"); return; }
    if (!checks.length) { alert("1人以上選択してください"); return; }
    var count = 0;
    checks.forEach(function (cb) {
      shiftsCache.push({ shift_id: "s" + Math.random().toString(36).slice(2, 10), user_id: cb.value, date: EVENT_DATE, time_start: time_start, time_end: time_end, tanto: tanto, open: false, urgent: false });
      count++;
    });
    renderAdminShifts();
    alert(count + "件追加しました（まだGitHub未保存）");
  }

  function importCSVFromFile(file) {
    var msg = document.getElementById("bulk-csv-msg");
    if (!file) { showMsg(msg, "ファイルを選んでください", true); return; }
    var reader = new FileReader();
    reader.onload = function (ev) {
      try {
        var raw = String(ev.target.result || "");
        if (raw.charCodeAt(0) === 0xfeff) raw = raw.slice(1);
        var lines = raw.split(/\r?\n/).filter(function (l) { return l.trim(); });
        if (lines.length < 2) { showMsg(msg, "データ行がありません", true); return; }
        var header = lines[0].split(",").map(function (h) { return h.replace(/^"|"$/g, "").trim().toLowerCase(); });
        var idx = {};
        header.forEach(function (h, i) { idx[h] = i; });
        if (idx.time_start == null || idx.time_end == null || idx.user_id == null) {
          showMsg(msg, "必須列不足 (time_start, time_end, user_id)", true); return;
        }
        var count = 0;
        for (var i = 1; i < lines.length; i++) {
          var cols = [], cur = "", inQ = false, line = lines[i];
          for (var c = 0; c < line.length; c++) {
            var ch = line[c];
            if (ch === '"') { inQ = !inQ; continue; }
            if (ch === "," && !inQ) { cols.push(cur); cur = ""; continue; }
            cur += ch;
          }
          cols.push(cur);
          var user_id = (cols[idx.user_id] || "").replace(/^"|"$/g, "").trim();
          var time_start = (cols[idx.time_start] || "").replace(/^"|"$/g, "").trim();
          var time_end = (cols[idx.time_end] || "").replace(/^"|"$/g, "").trim();
          if (!user_id || !time_start || !time_end) continue;
          var tanto = idx.tanto != null ? (cols[idx.tanto] || "").replace(/^"|"$/g, "").trim() : "";
          var urgent = idx.urgent != null && String(cols[idx.urgent]).trim() === "1";
          var openFlag = idx.open != null && String(cols[idx.open]).trim() === "1";
          var note = idx.note != null ? (cols[idx.note] || "").replace(/^"|"$/g, "").trim() : "";
          var sid = idx.shift_id != null ? (cols[idx.shift_id] || "").replace(/^"|"$/g, "").trim() : "";
          shiftsCache.push({
            shift_id: sid || ("s" + Math.random().toString(36).slice(2, 10)),
            user_id: openFlag ? "open" : user_id,
            date: EVENT_DATE,
            time_start: time_start,
            time_end: time_end,
            tanto: tanto,
            open: openFlag || user_id === "open",
            urgent: urgent,
            note: note
          });
          count++;
        }
        renderAdminShifts();
        showMsg(msg, count + "件を追加しました（未保存）");
      } catch (e) {
        showMsg(msg, "解析失敗: " + e.message, true);
      }
    };
    reader.readAsText(file, "UTF-8");
  }

  function buildTableRow(n) {
    var userOpts = '<option value="">—</option>' + usersCache.map(function (u) {
      return '<option value="' + u.id + '">' + (u.name || u.id) + "</option>";
    }).join("");
    var tantoOpts = '<option value="">—</option>' + TANTO_OPTIONS.map(function (t) {
      return '<option value="' + t + '">' + t + "</option>";
    }).join("");
    return "<tr data-row=\"" + n + "\"><td>" + (n + 1) + "</td><td><select class=\"ta-user\">" + userOpts + "</select></td><td><input type=\"time\" class=\"ta-start\" value=\"09:00\"></td><td><input type=\"time\" class=\"ta-end\" value=\"12:00\"></td><td><select class=\"ta-tanto\">" + tantoOpts + "</select></td><td><input type=\"text\" class=\"ta-note\" placeholder=\"メモ\"></td></tr>";
  }

  function initTableAdd(rows) {
    var body = document.getElementById("table-add-body");
    if (!body) return;
    var html = "";
    for (var i = 0; i < (rows || 10); i++) html += buildTableRow(i);
    body.innerHTML = html;
  }

  function addTableRows(count) {
    var body = document.getElementById("table-add-body");
    if (!body) return;
    var start = body.children.length;
    var html = "";
    for (var i = 0; i < (count || 5); i++) html += buildTableRow(start + i);
    body.insertAdjacentHTML("beforeend", html);
  }

  function commitTableRows() {
    var body = document.getElementById("table-add-body");
    if (!body) return;
    var count = 0;
    Array.prototype.forEach.call(body.querySelectorAll("tr"), function (tr) {
      var user = (tr.querySelector(".ta-user") || {}).value;
      var start = (tr.querySelector(".ta-start") || {}).value;
      var end = (tr.querySelector(".ta-end") || {}).value;
      var tanto = (tr.querySelector(".ta-tanto") || {}).value || "";
      var note = (tr.querySelector(".ta-note") || {}).value || "";
      if (!user || !start || !end) return;
      shiftsCache.push({
        shift_id: "s" + Math.random().toString(36).slice(2, 10),
        user_id: user,
        date: EVENT_DATE,
        time_start: start,
        time_end: end,
        tanto: tanto,
        note: note,
        open: false,
        urgent: false
      });
      count++;
    });
    renderAdminShifts();
    alert(count + "件をシフトに反映しました（GitHubに保存してください）");
  }

  function postUrgent() {
    var time_start = document.getElementById("urgent-start").value;
    var time_end = document.getElementById("urgent-end").value;
    var tanto = document.getElementById("urgent-tanto").value.trim();
    var note = (document.getElementById("urgent-note") || {}).value || "";
    var slots = parseInt((document.getElementById("urgent-slots") || {}).value || "1", 10);
    if (!slots || slots < 1) slots = 1;
    var scope = (document.querySelector('input[name="urgent-scope"]:checked') || {}).value;
    var target = "all";
    if (scope === "selected") {
      var cbs = document.querySelectorAll(".urgent-target-cb:checked");
      target = [];
      cbs.forEach(function (cb) { target.push(cb.value); });
      if (!target.length) { alert("対象者を1人以上選ぶか、「全員」にしてください"); return; }
    }
    if (!time_start || !time_end) { alert("時間を入力してください"); return; }
    shiftsCache.push({
      shift_id: "u" + Math.random().toString(36).slice(2, 10),
      user_id: "open",
      date: EVENT_DATE,
      time_start: time_start,
      time_end: time_end,
      tanto: tanto || "受付",
      open: true,
      urgent: true,
      note: note,
      target: target,
      slots_needed: slots,
      slots_filled: 0,
      assignees: []
    });
    renderAdminShifts();
    alert("急募枠を追加しました。GitHubに保存してください。");
  }

  async function saveShifts() {
    var msg = document.getElementById("shift-save-msg");
    showMsg(msg, "保存中…");
    try {
      await apiPut("src/data/shift.json", JSON.stringify(shiftsCache, null, 2), "admin: update shifts");
      try { await notifyUrgentShifts(shiftsCache); } catch (ne) { console.warn("urgent notif", ne); }
      showMsg(msg, "保存しました");
    } catch (e) {
      showMsg(msg, "失敗: " + e.message, true);
    }
  }

  async function notifyUrgentShifts(shifts) {
    if (!window.G5Notif || !G5Notif.sendNotification) return;
    var sent = [];
    try { sent = JSON.parse(localStorage.getItem("g5_urgent_notified_ids") || "[]"); } catch (e) {}
    for (var i = 0; i < (shifts || []).length; i++) {
      var s = shifts[i];
      if (!s.urgent || !s.open || !s.shift_id) continue;
      if (sent.indexOf(s.shift_id) !== -1) continue;
      var filled = s.slots_filled || (s.assignees && s.assignees.length) || 0;
      if (filled >= (s.slots_needed || 1)) continue;
      var to = (s.target === "all" || !s.target) ? "all" : (Array.isArray(s.target) ? s.target.concat(["staff"]) : [s.target, "staff"]);
      await G5Notif.sendNotification({
        to: to,
        title: "急募のお知らせ",
        body: (s.time_start || "") + "–" + (s.time_end || "") + "（" + (s.tanto || "") + "）募集中" + (s.note ? " — " + s.note : ""),
        type: "urgent",
        level: "urgent",
        link: "shift.html"
      });
      sent.push(s.shift_id);
    }
    try { localStorage.setItem("g5_urgent_notified_ids", JSON.stringify(sent.slice(-50))); } catch (e) {}
  }

  function fillNotifyUsers() {
    var sel = document.getElementById("notify-users");
    if (!sel) return;
    sel.innerHTML = usersCache.map(function (u) {
      return '<option value="' + u.id + '">' + (u.name || u.id) + "（" + u.role + "）</option>";
    }).join("");
  }

  async function loadNotifyHistory() {
    var box = document.getElementById("notify-history");
    if (!box) return;
    try {
      var list = window.G5Api ? await G5Api.fetchJson("src/data/notifications.json") : [];
      if (!Array.isArray(list)) list = [];
      list = list.slice().reverse().slice(0, 15);
      if (!list.length) { box.innerHTML = "<p class='hint-text'>まだ通知はありません</p>"; return; }
      box.innerHTML = list.map(function (n) {
        var to = n.to === "all" ? "全員" : n.to === "students" ? "全生徒" : Array.isArray(n.to) ? n.to.join(", ") : String(n.to || "");
        return "<div class='admin-card' style='padding:0.65rem 0.85rem;margin-bottom:0.4rem;'><strong>" + (n.title || "") + "</strong> <span class='hint-text'>→ " + to + "</span><br><span>" + (n.body || "") + "</span><br><span class='hint-text'>" + (n.from_name || n.from_id || "") + " · " + (n.created_at || "") + "</span></div>";
      }).join("");
    } catch (e) {
      box.innerHTML = "<p class='msg error'>履歴の取得に失敗</p>";
    }
  }

  async function sendAdminNotify() {
    var msg = document.getElementById("notify-msg");
    var mode = (document.getElementById("notify-to") || {}).value || "students";
    var title = ((document.getElementById("notify-title") || {}).value || "").trim();
    var body = ((document.getElementById("notify-body") || {}).value || "").trim();
    var link = (document.getElementById("notify-link") || {}).value || "";
    var level = (document.getElementById("notify-level") || {}).value || "normal";
    if (!title || !body) { showMsg(msg, "タイトルと本文を入力してください", true); return; }
    var to = "students";
    if (mode === "all") to = "all";
    else if (mode === "one" || mode === "multi") {
      var sel = document.getElementById("notify-users");
      var ids = [];
      if (sel) Array.prototype.forEach.call(sel.selectedOptions, function (o) { ids.push(o.value); });
      if (!ids.length) { showMsg(msg, "宛先ユーザーを選択してください", true); return; }
      to = mode === "one" ? ids[0] : ids;
    }
    showMsg(msg, "送信中…");
    try {
      if (!window.G5Notif || !G5Notif.sendNotification) throw new Error("通知モジュール未読込");
      await G5Notif.sendNotification({
        to: to,
        title: title,
        body: body,
        type: mode === "all" || mode === "students" ? "broadcast" : "direct",
        level: level,
        link: link
      });
      showMsg(msg, "送信しました");
      loadNotifyHistory();
    } catch (e) {
      showMsg(msg, "失敗: " + (e.message || e), true);
    }
  }

  async function saveBanner() {
    var msg = document.getElementById("banner-save-msg");
    showMsg(msg, "保存中…");
    try {
      var pages = [];
      document.querySelectorAll(".banner-page:checked").forEach(function (cb) { pages.push(cb.value); });
      var banner = {
        enabled: document.getElementById("banner-enabled").checked,
        text: document.getElementById("banner-text").value || "",
        link: document.getElementById("banner-link").value || "",
        pages: pages
      };
      await apiPut("src/data/banner.json", JSON.stringify(banner, null, 2), "admin: update banner");
      showMsg(msg, "保存しました");
    } catch (e) {
      showMsg(msg, "失敗: " + e.message, true);
    }
  }

  function exportCSV() {
    var map = Object.fromEntries(usersCache.map(function (u) { return [u.id, u]; }));
    var header = ["shift_id", "date", "time_start", "time_end", "user_id", "name", "tanto", "urgent", "open", "slots_needed", "slots_filled", "target"];
    var rows = [header.join(",")];
    shiftsCache.slice().sort(function (a, b) { return a.time_start < b.time_start ? -1 : 1; }).forEach(function (s) {
      var name = (map[s.user_id] || {}).name || (s.user_id === "open" ? "募集枠" : s.user_id || "");
      var target = s.target === "all" || !s.target ? "all" : Array.isArray(s.target) ? s.target.join("|") : s.target;
      rows.push([s.shift_id, s.date || EVENT_DATE, s.time_start, s.time_end, s.user_id || "", '"' + name + '"', '"' + (s.tanto || "") + '"', s.urgent ? "1" : "0", s.open || s.user_id === "open" ? "1" : "0", s.slots_needed || 1, s.slots_filled || 0, '"' + target + '"'].join(","));
    });
    var blob = new Blob(["\uFEFF" + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "5G-shifts-0912.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPDF() {
    var map = Object.fromEntries(usersCache.map(function (u) { return [u.id, u]; }));
    var sorted = shiftsCache.slice().sort(function (a, b) { return a.time_start < b.time_start ? -1 : 1; });
    var body = "<h1>G⁵ シフト表（9/12）</h1><p>出力日時: " + new Date().toLocaleString("ja-JP") + "</p><table><thead><tr><th>時間</th><th>担当者</th><th>役割</th><th>状態</th></tr></thead><tbody>";
    sorted.forEach(function (s) {
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      var name = isOpen ? ((s.urgent ? "急募" : "募集") + " " + (s.slots_filled || 0) + "/" + (s.slots_needed || 1)) : ((map[s.user_id] || {}).name || s.user_id || "—");
      var st = s.urgent && isOpen ? "急募" : isOpen ? "募集中" : "確定";
      body += "<tr><td>" + s.time_start + "–" + s.time_end + "</td><td>" + name + "</td><td>" + (s.tanto || "—") + "</td><td>" + st + "</td></tr>";
    });
    body += "</tbody></table>";
    var w = window.open("", "_blank");
    if (!w) { alert("ポップアップを許可してください"); return; }
    w.document.write("<!DOCTYPE html><html><head><meta charset=utf-8><title>シフト表</title><style>body{font-family:sans-serif;padding:1rem}table{border-collapse:collapse;width:100%}th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f5f5}</style></head><body>" + body + "</body></html>");
    w.document.close();
    w.focus();
    setTimeout(function () { w.print(); }, 300);
  }

  document.addEventListener("DOMContentLoaded", function () {
    var sess = G5.getSession && G5.getSession();
    if (sess && ALLOWED.indexOf(sess.role) !== -1) enterAdmin(sess);
    else if (sess) showMsg(document.getElementById("login-msg"), "管理権限がありません", true);

    var last = G5.getLastLoginId && G5.getLastLoginId();
    if (last) {
      var idEl = document.getElementById("login-id");
      if (idEl && !idEl.value) idEl.value = last;
    }

    window.__g5_onLoginSuccess = function (u) {
      if (!u) u = G5.getSession();
      if (!u || ALLOWED.indexOf(u.role) === -1) {
        showMsg(document.getElementById("login-msg"), "管理権限がありません", true);
        G5.clearSession();
        return;
      }
      enterAdmin(u);
    };

    document.getElementById("login-form").addEventListener("submit", doLogin);
    document.getElementById("btn-logout").addEventListener("click", function () {
      G5.clearSession();
      location.reload();
    });

    var tokBtn = document.getElementById("btn-set-token");
    if (tokBtn) tokBtn.addEventListener("click", function () {
      var cur = "";
      try { cur = localStorage.getItem("g5_gh_token") || ""; } catch (e) {}
      var v = prompt("GitHub PAT（repo権限）。空で削除。", cur ? "（設定済み・変更する場合は貼付）" : "");
      if (v === null) return;
      if (v === "" || v.indexOf("設定済み") !== -1) {
        if (v === "") { try { localStorage.removeItem("g5_gh_token"); } catch (e) {} alert("トークンを削除しました"); }
        return;
      }
      try { localStorage.setItem("g5_gh_token", v.trim()); alert("トークンを保存しました"); } catch (e) { alert("保存失敗"); }
    });

    document.getElementById("btn-add-shift").addEventListener("click", addShift);
    document.getElementById("btn-save-shifts").addEventListener("click", saveShifts);
    document.getElementById("btn-save-banner").addEventListener("click", saveBanner);

    var notifyBtn = document.getElementById("btn-send-notify");
    if (notifyBtn) notifyBtn.addEventListener("click", sendAdminNotify);
    var notifyTo = document.getElementById("notify-to");
    if (notifyTo) {
      notifyTo.addEventListener("change", function () {
        var wrap = document.getElementById("notify-users-wrap");
        if (wrap) wrap.hidden = notifyTo.value !== "one" && notifyTo.value !== "multi";
        var sel = document.getElementById("notify-users");
        if (sel) sel.multiple = notifyTo.value === "multi";
      });
    }

    document.querySelectorAll(".admin-tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".admin-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        var name = tab.dataset.tab;
        document.querySelectorAll(".tab-panel").forEach(function (p) {
          p.hidden = p.id !== "tab-" + name;
        });
        if (name === "notify") { fillNotifyUsers(); loadNotifyHistory(); }
        if (name === "table") initTableAdd(document.getElementById("table-add-body") && document.getElementById("table-add-body").children.length ? undefined : 12);
      });
    });

    var bulkBtn = document.getElementById("btn-bulk-add");
    if (bulkBtn) bulkBtn.addEventListener("click", bulkAdd);

    var csvImportBtn = document.getElementById("btn-bulk-csv-import");
    if (csvImportBtn) {
      csvImportBtn.addEventListener("click", function () {
        var f = document.getElementById("bulk-csv-file");
        if (f && f.files && f.files[0]) importCSVFromFile(f.files[0]);
        else showMsg(document.getElementById("bulk-csv-msg"), "CSVファイルを選択してください", true);
      });
    }

    ["btn-save-bulk", "btn-save-urgent", "btn-save-table"].forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", function () {
        saveShifts();
        var msgId = id === "btn-save-bulk" ? "bulk-save-msg" : id === "btn-save-urgent" ? "urgent-save-msg" : "table-save-msg";
        var msgEl = document.getElementById(msgId);
        var orig = document.getElementById("shift-save-msg");
        if (msgEl && orig) {
          var iv = setInterval(function () {
            msgEl.textContent = orig.textContent;
            msgEl.className = orig.className;
            if (orig.textContent && orig.textContent.indexOf("中") === -1) clearInterval(iv);
          }, 200);
          setTimeout(function () { clearInterval(iv); }, 5000);
        }
      });
    });

    var btnTableAdd = document.getElementById("btn-table-add-rows");
    if (btnTableAdd) btnTableAdd.addEventListener("click", function () { addTableRows(5); });
    var btnTableCommit = document.getElementById("btn-table-commit");
    if (btnTableCommit) btnTableCommit.addEventListener("click", commitTableRows);

    var urgentBtn = document.getElementById("btn-urgent-post");
    if (urgentBtn) urgentBtn.addEventListener("click", postUrgent);

    var csvBtn = document.getElementById("btn-export-csv");
    if (csvBtn) csvBtn.addEventListener("click", exportCSV);
    var pdfBtn = document.getElementById("btn-export-pdf");
    if (pdfBtn) pdfBtn.addEventListener("click", exportPDF);

    document.getElementById("admin-shift-list").addEventListener("click", function (e) {
      var del = e.target.closest(".btn-del");
      var edit = e.target.closest(".btn-edit");
      if (del) {
        if (!confirm("このシフトを削除しますか？")) return;
        shiftsCache.splice(+del.dataset.i, 1);
        if (editIndex === +del.dataset.i) resetForm();
        else if (editIndex > +del.dataset.i) editIndex--;
        renderAdminShifts();
      } else if (edit) {
        fillForm(+edit.dataset.i);
      }
    });

    document.querySelectorAll("[data-preset]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var p = btn.dataset.preset.split("-");
        var startId = btn.dataset.targetStart;
        var endId = btn.dataset.targetEnd;
        if (startId) document.getElementById(startId).value = p[0];
        if (endId) document.getElementById(endId).value = p[1];
      });
    });

    document.querySelectorAll('input[name="urgent-scope"]').forEach(function (r) {
      r.addEventListener("change", function () {
        var box = document.getElementById("urgent-targets-box");
        if (box) box.hidden = r.value !== "selected" || !r.checked;
      });
    });
  });
})();
