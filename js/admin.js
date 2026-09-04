/**
 * G⁵ Portal - admin.js
 * 日付固定 9/12・役割固定・急募（対象・人数）・CSV/PDF
 */
(function () {
  "use strict";
  var BASE = (window.G5 && G5.BASE) || ".";
  var REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };
  var ALLOWED = ["admin", "teacher", "temporary"];
  var TANTO_OPTIONS = [
    "受付",
    "総務",
    "ブラックジャック",
    "ポーカー",
    "チンチロ",
    "大富豪"
  ];
  var EVENT_DATE = "2026-09-12";

  var shiftsCache = [];
  var usersCache = [];
  var editIndex = -1;

  async function apiPut(path, content, message) {
    var token = G5.getToken();
    if (!token) throw new Error("token unavailable");
    var url =
      "https://api.github.com/repos/" +
      REPO.owner +
      "/" +
      REPO.repo +
      "/contents/" +
      path;
    var sha = null;
    var getRes = await fetch(url + "?ref=" + REPO.branch, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json"
      }
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
      var users = await (await fetch(BASE + "/src/data/users.json?t=" + Date.now())).json();
      var u = users.find(function (x) {
        return x.id === id && x.pass === pass;
      });
      if (!u) {
        showMsg(msg, "IDまたはパスワードが違います", true);
        return;
      }
      if (ALLOWED.indexOf(u.role) === -1) {
        showMsg(msg, "管理権限がありません", true);
        return;
      }
      G5.setSession({ id: u.id, name: u.name, role: u.role });
      enterAdmin(u);
    } catch (err) {
      showMsg(msg, "エラー: " + err.message, true);
    }
  }

  function enterAdmin(u) {
    document.getElementById("login-section").hidden = true;
    document.getElementById("admin-panel").hidden = false;
    document.getElementById("admin-user-label").textContent =
      (u.name || u.id) + "（" + u.role + "）";
    loadAdminData();
  }

  function fillUserSelects() {
    var opts = usersCache
      .map(function (u) {
        return (
          '<option value="' +
          u.id +
          '">' +
          (u.name || u.id) +
          " (" +
          u.role +
          ")</option>"
        );
      })
      .join("");
    var empty = '<option value="">— 選択 —</option>';
    var el = document.getElementById("shift-user");
    if (el) el.innerHTML = empty + opts;

    var bulk = document.getElementById("bulk-users");
    if (bulk) {
      bulk.innerHTML = usersCache
        .map(function (u) {
          return (
            '<label class="chk-label bulk-user-item"><input type="checkbox" value="' +
            u.id +
            '"> ' +
            (u.name || u.id) +
            "</label>"
          );
        })
        .join("");
    }

    var urgentTargets = document.getElementById("urgent-targets");
    if (urgentTargets) {
      urgentTargets.innerHTML = usersCache
        .map(function (u) {
          return (
            '<label class="chk-label bulk-user-item"><input type="checkbox" class="urgent-target-cb" value="' +
            u.id +
            '"> ' +
            (u.name || u.id) +
            "</label>"
          );
        })
        .join("");
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
    var map = Object.fromEntries(
      usersCache.map(function (u) {
        return [u.id, u];
      })
    );
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

    var html =
      '<div class="admin-day-group"><h3 class="admin-day-title">9/12 <span class="day-count">' +
      sorted.length +
      "件</span></h3><div class=\"admin-day-cards\">";

    sorted.forEach(function (s) {
      var i = shiftsCache.indexOf(s);
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      var filled = s.slots_filled || (s.assignees && s.assignees.length) || 0;
      var needed = s.slots_needed || 1;
      var name;
      if (isOpen) {
        name =
          (s.urgent ? "⚡急募" : "募集") +
          " " +
          filled +
          "/" +
          needed;
      } else {
        name = (map[s.user_id] || {}).name || s.user_id;
      }
      var urgentCls = s.urgent ? " is-urgent" : "";
      html +=
        '<article class="shift-card' +
        urgentCls +
        '" data-i="' +
        i +
        '">' +
        "<h3>" +
        name +
        "</h3>" +
        '<p class="shift-meta">' +
        s.time_start +
        " – " +
        s.time_end +
        "</p>" +
        '<p class="shift-tanto">' +
        (s.tanto || "") +
        "</p>" +
        '<div class="card-actions">' +
        '<button type="button" class="btn btn-ghost btn-edit" data-i="' +
        i +
        '">編集</button>' +
        '<button type="button" class="btn btn-ghost btn-del" data-i="' +
        i +
        '">削除</button>' +
        "</div></article>";
    });
    html += "</div></div>";
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
        tantoEl.insertAdjacentHTML(
          "beforeend",
          '<option value="' + s.tanto + '">' + s.tanto + "</option>"
        );
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

    if (!user_id || !time_start || !time_end) {
      alert("担当者・開始・終了は必須です");
      return;
    }

    var payload = {
      user_id: user_id,
      date: EVENT_DATE,
      time_start: time_start,
      time_end: time_end,
      tanto: tanto,
      open: false,
      urgent: false
    };

    if (editIndex >= 0) {
      shiftsCache[editIndex] = Object.assign({}, shiftsCache[editIndex], payload);
      resetForm();
    } else {
      shiftsCache.push(
        Object.assign(
          { shift_id: "s" + Math.random().toString(36).slice(2, 10) },
          payload
        )
      );
    }
    renderAdminShifts();
  }

  function bulkAdd() {
    var time_start = document.getElementById("bulk-start").value;
    var time_end = document.getElementById("bulk-end").value;
    var tanto = document.getElementById("bulk-tanto").value.trim();
    var checks = document.querySelectorAll("#bulk-users input[type=checkbox]:checked");
    if (!time_start || !time_end) {
      alert("時間を入力してください");
      return;
    }
    if (!checks.length) {
      alert("1人以上選択してください");
      return;
    }
    var count = 0;
    checks.forEach(function (cb) {
      shiftsCache.push({
        shift_id: "s" + Math.random().toString(36).slice(2, 10),
        user_id: cb.value,
        date: EVENT_DATE,
        time_start: time_start,
        time_end: time_end,
        tanto: tanto,
        open: false,
        urgent: false
      });
      count++;
    });
    renderAdminShifts();
    alert(count + "件追加しました（まだGitHub未保存）");
  }

  function postUrgent() {
    var time_start = document.getElementById("urgent-start").value;
    var time_end = document.getElementById("urgent-end").value;
    var tanto = document.getElementById("urgent-tanto").value.trim();
    var note = (document.getElementById("urgent-note") || {}).value || "";
    var slots = parseInt(
      (document.getElementById("urgent-slots") || {}).value || "1",
      10
    );
    if (!slots || slots < 1) slots = 1;

    var scope = (
      document.querySelector('input[name="urgent-scope"]:checked') || {}
    ).value;
    var target = "all";
    if (scope === "selected") {
      var cbs = document.querySelectorAll(".urgent-target-cb:checked");
      target = [];
      cbs.forEach(function (cb) {
        target.push(cb.value);
      });
      if (!target.length) {
        alert("対象者を1人以上選ぶか、「全員」にしてください");
        return;
      }
    }

    if (!time_start || !time_end) {
      alert("時間を入力してください");
      return;
    }

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
    alert(
      "急募枠を追加しました（定員" +
        slots +
        "・対象" +
        (target === "all" ? "全員" : target.length + "人") +
        "）。GitHubに保存してください。"
    );
  }

  async function saveShifts() {
    var msg = document.getElementById("shift-save-msg");
    showMsg(msg, "保存中…");
    try {
      await apiPut(
        "src/data/shift.json",
        JSON.stringify(shiftsCache, null, 2),
        "admin: update shifts"
      );
      showMsg(msg, "保存しました");
    } catch (e) {
      showMsg(msg, "失敗: " + e.message, true);
    }
  }

  async function saveBanner() {
    var msg = document.getElementById("banner-save-msg");
    var pages = [];
    document.querySelectorAll(".banner-page:checked").forEach(function (cb) {
      pages.push(cb.value);
    });
    var data = [
      {
        enabled: document.getElementById("banner-enabled").checked,
        text: document.getElementById("banner-text").value,
        link: document.getElementById("banner-link").value,
        pages: pages.length ? pages : ["index", "shift", "manual"]
      }
    ];
    showMsg(msg, "保存中…");
    try {
      await apiPut(
        "src/data/banner.json",
        JSON.stringify(data, null, 2),
        "admin: update banner"
      );
      showMsg(msg, "保存しました");
    } catch (e) {
      showMsg(msg, "失敗: " + e.message, true);
    }
  }

  function exportCSV() {
    var map = Object.fromEntries(
      usersCache.map(function (u) {
        return [u.id, u];
      })
    );
    var header = [
      "shift_id",
      "date",
      "time_start",
      "time_end",
      "user_id",
      "name",
      "tanto",
      "urgent",
      "open",
      "slots_needed",
      "slots_filled",
      "target"
    ];
    var rows = [header.join(",")];
    shiftsCache
      .slice()
      .sort(function (a, b) {
        return a.time_start < b.time_start ? -1 : 1;
      })
      .forEach(function (s) {
        var name =
          (map[s.user_id] || {}).name ||
          (s.user_id === "open" ? "募集枠" : s.user_id || "");
        var target =
          s.target === "all" || !s.target
            ? "all"
            : Array.isArray(s.target)
              ? s.target.join("|")
              : s.target;
        rows.push(
          [
            s.shift_id,
            s.date || EVENT_DATE,
            s.time_start,
            s.time_end,
            s.user_id || "",
            '"' + name + '"',
            '"' + (s.tanto || "") + '"',
            s.urgent ? "1" : "0",
            s.open || s.user_id === "open" ? "1" : "0",
            s.slots_needed || 1,
            s.slots_filled || 0,
            '"' + target + '"'
          ].join(",")
        );
      });
    var bom = "\uFEFF";
    var blob = new Blob([bom + rows.join("\n")], {
      type: "text/csv;charset=utf-8"
    });
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "5G-shifts-0912.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  function exportPDF() {
    var map = Object.fromEntries(
      usersCache.map(function (u) {
        return [u.id, u];
      })
    );
    var sorted = shiftsCache.slice().sort(function (a, b) {
      return a.time_start < b.time_start ? -1 : 1;
    });
    var body = "<h1>G⁵ シフト表（9/12）</h1>";
    body +=
      "<p>出力日時: " + new Date().toLocaleString("ja-JP") + "</p><table><thead><tr>" +
      "<th>時間</th><th>担当者</th><th>役割</th><th>状態</th></tr></thead><tbody>";
    sorted.forEach(function (s) {
      var isOpen = !s.user_id || s.user_id === "open" || s.open;
      var name = isOpen
        ? (s.urgent ? "急募" : "募集") +
          " " +
          (s.slots_filled || 0) +
          "/" +
          (s.slots_needed || 1)
        : (map[s.user_id] || {}).name || s.user_id || "—";
      var st = s.urgent && isOpen ? "急募" : isOpen ? "募集中" : "確定";
      body +=
        "<tr><td>" +
        s.time_start +
        "–" +
        s.time_end +
        "</td><td>" +
        name +
        "</td><td>" +
        (s.tanto || "—") +
        "</td><td>" +
        st +
        "</td></tr>";
    });
    body += "</tbody></table>";
    var w = window.open("", "_blank");
    if (!w) {
      alert("ポップアップを許可してください");
      return;
    }
    w.document.write(
      "<!DOCTYPE html><html lang=ja><head><meta charset=UTF-8><title>G5 シフト表</title>" +
        "<style>body{font-family:sans-serif;padding:24px}h1{font-size:1.4rem}" +
        "table{width:100%;border-collapse:collapse;font-size:0.9rem}" +
        "th,td{border:1px solid #ccc;padding:6px 10px;text-align:left}th{background:#f5f0ff}" +
        "</style></head><body>" +
        body +
        "<script>window.onload=function(){window.print();}<\\/script></body></html>"
    );
    w.document.close();
  }

  document.addEventListener("DOMContentLoaded", function () {
    var sess = G5.getSession();
    if (sess && ALLOWED.indexOf(sess.role) !== -1) enterAdmin(sess);

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
      try { localStorage.setItem("g5_gh_token", v.trim()); alert("トークンを保存しました（このブラウザのみ）"); } catch (e) { alert("保存失敗"); }
    });


    document.getElementById("btn-add-shift").addEventListener("click", addShift);
    document.getElementById("btn-save-shifts").addEventListener("click", saveShifts);
    document.getElementById("btn-save-banner").addEventListener("click", saveBanner);

    var bulkBtn = document.getElementById("btn-bulk-add");
    if (bulkBtn) bulkBtn.addEventListener("click", bulkAdd);

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

    document.querySelectorAll(".admin-tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".admin-tabs .tab").forEach(function (t) {
          t.classList.remove("active");
        });
        tab.classList.add("active");
        var name = tab.dataset.tab;
        document.querySelectorAll(".tab-panel").forEach(function (p) {
          p.hidden = p.id !== "tab-" + name;
        });
      });
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
