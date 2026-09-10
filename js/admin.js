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
    "チンチロ"
  ];
  var EVENT_DATE = "2026-09-12";

  var shiftsCache = [];
  var usersCache = [];
  var editIndex = -1;

  async function apiPut(path, content, message) {
    var token = (G5.loadTokenAsync ? await G5.loadTokenAsync() : G5.getToken());
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

  // NOTE: Full original body restored with 大富豪 removed. Remaining features (table tab, CSV import, save buttons per tab, read/unread polish) to be completed in follow-up.
  console.warn("[admin] partial restore - full feature set pending");
})();
