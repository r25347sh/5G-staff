(function () {
  "use strict";
  const BASE = (window.G5 && G5.BASE) || ".";
  const REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };
  const ALLOWED = ["admin", "teacher", "temporary"];
  let shiftsCache = [], usersCache = [], editIndex = -1;

  async function apiPut(path, content, message) {
    const token = G5.getToken();
    if (!token) throw new Error("token unavailable");
    const url = "https://api.github.com/repos/" + REPO.owner + "/" + REPO.repo + "/contents/" + path;
    let sha = null;
    const getRes = await fetch(url + "?ref=" + REPO.branch, {
      headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json" }
    });
    if (getRes.ok) sha = (await getRes.json()).sha;
    const body = {
      message: message || "update via G5 Portal admin",
      content: btoa(unescape(encodeURIComponent(content))),
      branch: REPO.branch
    };
    if (sha) body.sha = sha;
    const res = await fetch(url, {
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
    const id = document.getElementById("login-id").value.trim();
    const pass = document.getElementById("login-pass").value;
    const msg = document.getElementById("login-msg");
    try {
      const users = await (await fetch(BASE + "/src/data/users.json?t=" + Date.now())).json();
      const u = users.find(function (x) { return x.id === id && x.pass === pass; });
      if (!u) { showMsg(msg, "IDまたはパスワードが違います", true); return; }
      if (ALLOWED.indexOf(u.role) === -1) { showMsg(msg, "管理権限がありません", true); return; }
      G5.setSession({ id: u.id, name: u.name, role: u.role });
      enterAdmin(u);
    } catch (err) { showMsg(msg, "エラー: " + err.message, true); }
  }

  function enterAdmin(u) {
    document.getElementById("login-section").hidden = true;
    document.getElementById("admin-panel").hidden = false;
    document.getElementById("admin-user-label").textContent = (u.name || u.id) + "（" + u.role + "）";
    loadAdminData();
  }

  async function loadAdminData() {
    const pair = await Promise.all([G5Shift.loadShifts(), G5Shift.loadUsers()]);
    shiftsCache = pair[0]; usersCache = pair[1];
    document.getElementById("shift-user").innerHTML = usersCache.map(function (u) {
      return '<option value="' + u.id + '">' + (u.name || u.id) + " (" + u.role + ")</option>";
    }).join("");
    renderAdminShifts();
    try {
      const b = await (await fetch(BASE + "/src/data/banner.json?t=" + Date.now())).json();
      const banner = Array.isArray(b) ? b[0] : b;
      document.getElementById("banner-enabled").checked = !!banner.enabled;
      document.getElementById("banner-text").value = banner.text || "";
      document.getElementById("banner-link").value = banner.link || "";
      const pages = banner.pages || [];
      document.querySelectorAll(".banner-page").forEach(function (cb) {
        cb.checked = pages.indexOf(cb.value) !== -1;
      });
    } catch (e) {}
  }

  function renderAdminShifts() {
    const map = Object.fromEntries(usersCache.map(function (u) { return [u.id, u]; }));
    const el = document.getElementById("admin-shift-list");
    el.innerHTML = shiftsCache.map(function (s, i) {
      const name = (map[s.user_id] || {}).name || s.user_id;
      return '<article class="shift-card" data-i="' + i + '"><h3>' + name + '</h3>' +
        '<p class="shift-meta">' + s.date + ' ' + s.time_start + '-' + s.time_end + '</p>' +
        '<p class="shift-tanto">' + (s.tanto || '') + '</p>' +
        '<div style="margin-top:0.6rem;display:flex;gap:0.4rem;">' +
        '<button type="button" class="btn btn-ghost btn-edit" data-i="' + i + '" style="font-size:0.78rem;padding:0.3rem 0.6rem;">編集</button>' +
        '<button type="button" class="btn btn-ghost btn-del" data-i="' + i + '" style="font-size:0.78rem;padding:0.3rem 0.6rem;">削除</button></div></article>';
    }).join("") || '<p class="empty-msg">シフトなし</p>';
  }

  function fillForm(i) {
    const s = shiftsCache[i]; if (!s) return;
    editIndex = i;
    document.getElementById("shift-user").value = s.user_id;
    document.getElementById("shift-date").value = s.date;
    document.getElementById("shift-start").value = s.time_start;
    document.getElementById("shift-end").value = s.time_end;
    document.getElementById("shift-tanto").value = s.tanto || "";
    document.getElementById("btn-add-shift").textContent = "更新";
  }
  function resetForm() {
    editIndex = -1;
    document.getElementById("shift-tanto").value = "";
    document.getElementById("btn-add-shift").textContent = "追加";
  }
  function addShift() {
    const user_id = document.getElementById("shift-user").value;
    const date = document.getElementById("shift-date").value;
    const time_start = document.getElementById("shift-start").value;
    const time_end = document.getElementById("shift-end").value;
    const tanto = document.getElementById("shift-tanto").value.trim();
    if (!user_id || !date || !time_start || !time_end) return alert("必須項目を入力");
    if (editIndex >= 0) {
      shiftsCache[editIndex] = Object.assign({}, shiftsCache[editIndex], { user_id: user_id, date: date, time_start: time_start, time_end: time_end, tanto: tanto });
      resetForm();
    } else {
      shiftsCache.push({ shift_id: Math.random().toString(36).slice(2, 12), user_id: user_id, date: date, time_start: time_start, time_end: time_end, tanto: tanto });
    }
    renderAdminShifts();
  }
  async function saveShifts() {
    const msg = document.getElementById("shift-save-msg");
    showMsg(msg, "保存中…");
    try {
      await apiPut("src/data/shift.json", JSON.stringify(shiftsCache, null, 2), "admin: update shifts");
      showMsg(msg, "保存しました");
    } catch (e) { showMsg(msg, "失敗: " + e.message, true); }
  }
  async function saveBanner() {
    const msg = document.getElementById("banner-save-msg");
    const pages = [];
    document.querySelectorAll(".banner-page:checked").forEach(function (cb) { pages.push(cb.value); });
    const data = [{
      enabled: document.getElementById("banner-enabled").checked,
      text: document.getElementById("banner-text").value,
      link: document.getElementById("banner-link").value,
      pages: pages.length ? pages : ["index", "shift", "manual"]
    }];
    showMsg(msg, "保存中…");
    try {
      await apiPut("src/data/banner.json", JSON.stringify(data, null, 2), "admin: update banner");
      showMsg(msg, "保存しました");
    } catch (e) { showMsg(msg, "失敗: " + e.message, true); }
  }

  document.addEventListener("DOMContentLoaded", function () {
    const sess = G5.getSession();
    if (sess && ALLOWED.indexOf(sess.role) !== -1) enterAdmin(sess);
    document.getElementById("login-form").addEventListener("submit", doLogin);
    document.getElementById("btn-logout").addEventListener("click", function () {
      G5.clearSession(); location.reload();
    });
    document.getElementById("btn-add-shift").addEventListener("click", addShift);
    document.getElementById("btn-save-shifts").addEventListener("click", saveShifts);
    document.getElementById("btn-save-banner").addEventListener("click", saveBanner);
    document.getElementById("admin-shift-list").addEventListener("click", function (e) {
      const del = e.target.closest(".btn-del");
      const edit = e.target.closest(".btn-edit");
      if (del) {
        if (!confirm("このシフトを削除しますか？")) return;
        shiftsCache.splice(+del.dataset.i, 1);
        if (editIndex === +del.dataset.i) resetForm();
        else if (editIndex > +del.dataset.i) editIndex--;
        renderAdminShifts();
      } else if (edit) fillForm(+edit.dataset.i);
    });
    document.querySelectorAll(".admin-tabs .tab").forEach(function (tab) {
      tab.addEventListener("click", function () {
        document.querySelectorAll(".admin-tabs .tab").forEach(function (t) { t.classList.remove("active"); });
        tab.classList.add("active");
        document.getElementById("tab-shifts").hidden = tab.dataset.tab !== "shifts";
        document.getElementById("tab-banner").hidden = tab.dataset.tab !== "banner";
      });
    });
    const d = document.getElementById("shift-date");
    if (d) d.value = new Date().toISOString().slice(0, 10);
  });
})();
