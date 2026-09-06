/**
 * G⁵ Portal - GitHub Contents API helper
 * データファイルの読み書き（既存 PAT パターン踏襲）
 */
(function () {
  "use strict";
  var REPO = { owner: "r25347sh", repo: "5G-staff", branch: "main" };

  function base() {
    return (window.G5 && G5.BASE) || ".";
  }

  async function getToken() {
    if (window.G5 && G5.loadTokenAsync) return await G5.loadTokenAsync();
    if (window.G5 && G5.getToken) return G5.getToken();
    throw new Error("token unavailable");
  }

  function encodeContent(text) {
    return btoa(unescape(encodeURIComponent(text)));
  }

  async function getFileMeta(path) {
    var token = await getToken();
    var url =
      "https://api.github.com/repos/" +
      REPO.owner +
      "/" +
      REPO.repo +
      "/contents/" +
      path +
      "?ref=" +
      REPO.branch;
    var res = await fetch(url, {
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json"
      }
    });
    if (res.status === 404) return null;
    if (!res.ok) throw new Error("GET " + path + " " + res.status);
    return await res.json();
  }

  /** 生 JSON を fetch（キャッシュ回避） */
  async function fetchJson(path) {
    var res = await fetch(base() + "/" + path.replace(/^\//, "") + "?t=" + Date.now());
    if (!res.ok) throw new Error("fetch " + path + " " + res.status);
    return await res.json();
  }

  /** path に content を PUT（message 付き） */
  async function putFile(path, content, message) {
    var token = await getToken();
    var url =
      "https://api.github.com/repos/" +
      REPO.owner +
      "/" +
      REPO.repo +
      "/contents/" +
      path;
    var meta = null;
    try {
      meta = await getFileMeta(path);
    } catch (e) {}
    var body = {
      message: message || "update via G5 Portal",
      content: encodeContent(typeof content === "string" ? content : JSON.stringify(content, null, 2)),
      branch: REPO.branch
    };
    if (meta && meta.sha) body.sha = meta.sha;
    var res = await fetch(url, {
      method: "PUT",
      headers: {
        Authorization: "Bearer " + token,
        Accept: "application/vnd.github+json",
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      var t = await res.text();
      throw new Error(res.status + " " + t.slice(0, 240));
    }
    return await res.json();
  }

  /** 競合しにくい追記: 読み→加工→書き（簡易リトライ） */
  async function updateJson(path, mutator, message, retries) {
    retries = retries == null ? 2 : retries;
    var lastErr;
    for (var i = 0; i <= retries; i++) {
      try {
        var data;
        try {
          data = await fetchJson(path);
        } catch (e) {
          data = path.indexOf("chat") !== -1 ? { messages: [], updated_at: null } : [];
        }
        var next = await mutator(data);
        await putFile(path, next, message);
        return next;
      } catch (e) {
        lastErr = e;
        await new Promise(function (r) {
          setTimeout(r, 400 * (i + 1));
        });
      }
    }
    throw lastErr;
  }

  function uid(prefix) {
    return (prefix || "id") + "_" + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  window.G5Api = {
    REPO: REPO,
    fetchJson: fetchJson,
    putFile: putFile,
    updateJson: updateJson,
    getFileMeta: getFileMeta,
    uid: uid
  };
})();
