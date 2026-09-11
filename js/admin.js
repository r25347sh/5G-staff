/**
 * G⁵ Portal - admin.js
 * 日付固定 9/12・役割固定・急募・CSV/PDF・テーブル追加・CSVインポート
 * 保存は Supabase 優先 + GitHub バックアップ（反映不具合対策）
 */
(function () {
  "use strict";
  var BASE = (window.G5 && G5.BASE) || ".";
  var REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };
  var ALLOWED = ["admin", "teacher", "temporary"];
  var TANTO_OPTIONS = ["受付", "総務", "ブラックジャック", "ポーカー", "チンチロ", "ルーレット"];
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
    var noteEl = document.getElementById("shift-note");
    if (noteEl) noteEl.value = s.note || "";
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
    var noteEl = document.getElementById("shift-note");
    if (noteEl) noteEl.value = "";
    document.getElementById("btn-add-shift").textContent = "追加";
  }

  function addShift() {
    var user_id = document.getElementById("shift-user").value;
    var time_start = document.getElementById("shift-start").value;
    var time_end = document.getElementById("shift-end").value;
    var tanto = document.getElementById("shift-tanto").value.trim();
    var note = ((document.getElementById("shift-note") || {}).value || "").trim();
    if (!user_id || !time_start || !time_end) { alert("担当者・開始・終了は必須です"); return; }
    var payload = { user_id: user_id, date: EVENT_DATE, time_start: time_start, time_end: time_end, tanto: tanto, note: note, open: false, urgent: false };
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
    var note = ((document.getElementById("bulk-note") || {}).value || "").trim();
    var checks = document.querySelectorAll("#bulk-users input[type=checkbox]:checked");
    if (!time_start || !time_end) { alert("時間を入力してください"); return; }
    if (!checks.length) { alert("1人以上選択してください"); return; }
    var count = 0;
    checks.forEach(function (cb) {
      shiftsCache.push({ shift_id: "s" + Math.random().toString(36).slice(2, 10), user_id: cb.value, date: EVENT_DATE, time_start: time_start, time_end: time_end, tanto: tanto, note: note, open: false, urgent: false });
      count++;
    });
    renderAdminShifts();
    alert(count + "件追加しました（まだ未保存）");
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
    alert(count + "件をシフトに反映しました（保存ボタンを押してください）");
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
    alert("急募枠を追加しました。保存ボタンを押してください。");
  }

  async function saveShifts() {
    var msg = document.getElementById("shift-save-msg");
    showMsg(msg, "保存中…");
    try {
      var via = [];
      if (window.G5Supabase && G5Supabase.replaceAllShifts) {
        try {
          await G5Supabase.replaceAllShifts(shiftsCache);
          via.push("Supabase");
        } catch (se) {
          console.warn("Supabase save failed", se);
          showMsg(msg, "Supabase失敗: " + (se.message || se) + " → GitHubへ…", true);
        }
      }
      try {
        await apiPut("src/data/shift.json", JSON.stringify(shiftsCache, null, 2), "admin: update shifts");
        via.push("GitHub");
      } catch (ge) {
        if (!via.length) throw ge;
        console.warn("GitHub save failed", ge);
      }
      try { await notifyUrgentShifts(shiftsCache); } catch (ne) { console.warn("urgent notif", ne); }
      showMsg(msg, "保存しました（" + (via.join(" + ") || "不明") + "）");
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
      var timeLabel = s.time_start + "–" + s.time_end;
      var title = "急募のお知らせ";
      var body = timeLabel + "（" + (s.tanto || "担当") + "）募集中";
      if (s.note) body += " — " + s.note;
      await G5Notif.sendNotification({
        title: title,
        body: body,
        author_id: ((window.G5 && G5.getSession()) || {}).id || "admin",
        author_name: ((window.G5 && G5.getSession()) || {}).name || "管理者",
        author_role: ((window.G5 && G5.getSession()) || {}).role || "admin",
        target: s.target || "all",
        type: "urgent",
        level: "urgent",
        link: "shift.html"
      });
      sent.push(s.shift_id);
    }
    try { localStorage.setItem("g5_urgent_notified_ids", JSON.stringify(sent)); } catch (e) {}
  }

  function exportCSV() {
    var header = "shift_id,user_id,date,time_start,time_end,tanto,open,urgent,note,slots_needed,slots_filled\n";
    var rows = shiftsCache.map(function (s) {
      return [
        s.shift_id || "",
        s.user_id || "",
        s.date || EVENT_DATE,
        s.time_start || "",
        s.time_end || "",
        s.tanto || "",
        s.open ? "1" : "0",
        s.urgent ? "1" : "0",
        (s.note || "").replace(/,/g, " "),
        s.slots_needed || 1,
        s.slots_filled || 0
      ].join(",");
    });
    var blob = new Blob(["\uFEFF" + header + rows.join("\n")], { type: "text/csv;charset=utf-8" });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "shifts_" + EVENT_DATE + ".csv";
    a.click();
  }

  function delShift(i) {
    if (!confirm("このシフトを削除しますか？")) return;
    shiftsCache.splice(i, 1);
    renderAdminShifts();
  }

  function bindAdminEvents() {
    var loginForm = document.getElementById("admin-login-form");
    if (loginForm) loginForm.addEventListener("submit", doLogin);
    var btnAdd = document.getElementById("btn-add-shift");
    if (btnAdd) btnAdd.addEventListener("click", addShift);
    var btnBulk = document.getElementById("btn-bulk-add");
    if (btnBulk) btnBulk.addEventListener("click", bulkAdd);
    var btnSave = document.getElementById("btn-save-shifts");
    if (btnSave) btnSave.addEventListener("click", saveShifts);
    var btnUrgent = document.getElementById("btn-post-urgent");
    if (btnUrgent) btnUrgent.addEventListener("click", postUrgent);
    var btnCsv = document.getElementById("btn-export-csv");
    if (btnCsv) btnCsv.addEventListener("click", exportCSV);
    var btnTableCommit = document.getElementById("btn-table-commit");
    if (btnTableCommit) btnTableCommit.addEventListener("click", commitTableRows);
    var btnTableAddRows = document.getElementById("btn-table-add-rows");
    if (btnTableAddRows) btnTableAddRows.addEventListener("click", function () { addTableRows(5); });
    var csvInput = document.getElementById("bulk-csv-file");
    if (csvInput) csvInput.addEventListener("change", function () { importCSVFromFile(csvInput.files[0]); });
    var list = document.getElementById("admin-shift-list");
    if (list) {
      list.addEventListener("click", function (e) {
        var edit = e.target.closest(".btn-edit");
        var del = e.target.closest(".btn-del");
        if (edit) fillForm(parseInt(edit.getAttribute("data-i"), 10));
        if (del) delShift(parseInt(del.getAttribute("data-i"), 10));
      });
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      bindAdminEvents();
      var session = (window.G5 && G5.getSession && G5.getSession()) || null;
      if (session && ALLOWED.indexOf(session.role) !== -1) enterAdmin(session);
    });
  } else {
    bindAdminEvents();
  }
})();
