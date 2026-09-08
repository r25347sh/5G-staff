/**
 * G⁵ Portal - Supabase client
 * シフト・通知・ユーザー拡張（email / LINE）用
 * Project: ngjculhtbbxazgkkelvi
 */
(function () {
  "use strict";

  var SUPABASE_URL = "https://ngjculhtbbxazgkkelvi.supabase.co";
  var SUPABASE_ANON_KEY =
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5namN1bGh0YmJ4YXpna2tlbHZpIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg1NjYyMzEsImV4cCI6MjEwNDE0MjIzMX0.2AF7s7-cwgTMGuBl5TN1INhhkTaFJ2z-7Oj8t26iu2k";

  var client = null;
  var readyPromise = null;

  function loadSdk() {
    if (window.supabase && window.supabase.createClient) {
      return Promise.resolve();
    }
    return new Promise(function (resolve, reject) {
      var s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("Supabase SDK load failed")); };
      document.head.appendChild(s);
    });
  }

  function getClient() {
    if (client) return Promise.resolve(client);
    if (readyPromise) return readyPromise;
    readyPromise = loadSdk().then(function () {
      var sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      });
      client = sb;
      return client;
    });
    return readyPromise;
  }

  /**
   * 汎用 select
   */
  async function from(table) {
    var sb = await getClient();
    return sb.from(table);
  }

  /**
   * shifts を取得（新しい順）
   */
  async function fetchShifts() {
    var sb = await getClient();
    var res = await sb.from("shifts").select("*").order("time_start", { ascending: true });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  /**
   * shift を upsert（claim 等）
   */
  async function upsertShift(row) {
    var sb = await getClient();
    var res = await sb.from("shifts").upsert(row, { onConflict: "shift_id" }).select();
    if (res.error) throw new Error(res.error.message);
    return res.data && res.data[0];
  }

  /**
   * 複数 shifts を一括 put（管理画面用）
   */
  async function replaceAllShifts(rows) {
    var sb = await getClient();
    var del = await sb.from("shifts").delete().neq("shift_id", "__never__");
    if (del.error) throw new Error(del.error.message);
    if (!rows || !rows.length) return [];
    var ins = await sb.from("shifts").insert(rows).select();
    if (ins.error) throw new Error(ins.error.message);
    return ins.data;
  }

  /**
   * ユーザー拡張情報（email / line_user_id）
   */
  async function getUserProfile(userId) {
    var sb = await getClient();
    var res = await sb.from("user_profiles").select("*").eq("user_id", userId).maybeSingle();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async function upsertUserProfile(profile) {
    var sb = await getClient();
    var res = await sb
      .from("user_profiles")
      .upsert(profile, { onConflict: "user_id" })
      .select()
      .single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  /**
   * 通知（admin/teacher → 対象）
   */
  async function fetchNotifications(forUserId) {
    var sb = await getClient();
    var q = sb.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
    var res = await q;
    if (res.error) throw new Error(res.error.message);
    var list = res.data || [];
    if (!forUserId) return list;
    return list.filter(function (n) {
      if (!n.target || n.target === "all") return true;
      if (Array.isArray(n.target)) return n.target.indexOf(forUserId) !== -1;
      return n.target === forUserId;
    });
  }

  async function createNotification(payload) {
    var sb = await getClient();
    var res = await sb.from("notifications").insert(payload).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  async function fetchReplies(notificationId) {
    var sb = await getClient();
    var res = await sb
      .from("notification_replies")
      .select("*")
      .eq("notification_id", notificationId)
      .order("created_at", { ascending: true });
    if (res.error) throw new Error(res.error.message);
    return res.data || [];
  }

  async function postReply(payload) {
    var sb = await getClient();
    var res = await sb.from("notification_replies").insert(payload).select().single();
    if (res.error) throw new Error(res.error.message);
    return res.data;
  }

  /**
   * Realtime 購読（シフト更新など）
   */
  async function subscribeShifts(onChange) {
    var sb = await getClient();
    return sb
      .channel("shifts-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "shifts" },
        function (payload) {
          if (typeof onChange === "function") onChange(payload);
        }
      )
      .subscribe();
  }

  async function subscribeNotifications(onChange) {
    var sb = await getClient();
    return sb
      .channel("notif-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications" },
        function (payload) {
          if (typeof onChange === "function") onChange(payload);
        }
      )
      .subscribe();
  }


  /**
   * メール通知（Supabase Edge Function）
   * 未デプロイ時は黙ってスキップ
   */
  async function notifyEmail(item) {
    try {
      var sb = await getClient();
      var { error } = await sb.functions.invoke("send-notification-email", {
        body: {
          title: item.title,
          body: item.body,
          to: item.to,
          from_name: item.from_name,
          link: item.link || ""
        }
      });
      if (error) console.warn("email fn", error);
    } catch (e) {
      /* Edge Function 未設定なら無視 */
    }
  }

  window.G5Supabase = {
    URL: SUPABASE_URL,
    getClient: getClient,
    from: from,
    fetchShifts: fetchShifts,
    upsertShift: upsertShift,
    replaceAllShifts: replaceAllShifts,
    getUserProfile: getUserProfile,
    upsertUserProfile: upsertUserProfile,
    fetchNotifications: fetchNotifications,
    createNotification: createNotification,
    fetchReplies: fetchReplies,
    postReply: postReply,
    subscribeShifts: subscribeShifts,
    subscribeNotifications: subscribeNotifications,
    notifyEmail: notifyEmail
  };
})();
