/**
 * G⁵ 文化祭・簡易ポーカー（フロップ・ショーダウン）
 * 手札2 + 場3 / ベット1回 / 再レイズなし
 */
(function () {
  "use strict";

  var SUITS = [
    { s: "♠", color: "black" },
    { s: "♥", color: "red" },
    { s: "♦", color: "red" },
    { s: "♣", color: "black" }
  ];
  var RANKS = ["2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K", "A"];
  var RANK_VAL = {};
  RANKS.forEach(function (r, i) {
    RANK_VAL[r] = i + 2;
  });

  var ANTE = 10;
  var state = {
    balance: 500,
    pot: 0,
    phase: "idle", // idle | action | showdown | over
    deck: [],
    player: [],
    cpu: [],
    board: [],
    playerIn: true,
    cpuIn: true,
    raised: false,
    toCall: 0
  };

  function $(id) {
    return document.getElementById(id);
  }

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = (Math.random() * (i + 1)) | 0;
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function newDeck() {
    var d = [];
    SUITS.forEach(function (su) {
      RANKS.forEach(function (r) {
        d.push({ rank: r, suit: su.s, color: su.color, v: RANK_VAL[r] });
      });
    });
    return shuffle(d);
  }

  function cardHtml(c, faceDown) {
    if (faceDown) return '<div class="card back"></div>';
    if (!c) return '<div class="card placeholder"></div>';
    return (
      '<div class="card ' +
      c.color +
      '"><span>' +
      c.rank +
      '</span><span class="suit">' +
      c.suit +
      "</span><span>" +
      c.rank +
      "</span></div>"
    );
  }

  function renderCards() {
    var board = $("pk-board");
    var ph = $("pk-player-hand");
    var ch = $("pk-cpu-hand");
    if (board) {
      var slots = [0, 1, 2].map(function (i) {
        return state.board[i] ? cardHtml(state.board[i], false) : cardHtml(null);
      });
      board.innerHTML = slots.join("");
    }
    if (ph) {
      ph.innerHTML = state.player.length
        ? state.player.map(function (c) {
            return cardHtml(c, false);
          }).join("")
        : cardHtml(null) + cardHtml(null);
    }
    if (ch) {
      var hide = state.phase !== "showdown" && state.phase !== "over";
      ch.innerHTML = state.cpu.length
        ? state.cpu
            .map(function (c) {
              return cardHtml(c, hide && state.cpuIn);
            })
            .join("")
        : cardHtml(null) + cardHtml(null);
    }
  }

  function setMsg(html) {
    var el = $("pk-msg");
    if (el) el.innerHTML = html;
  }

  function setResult(text) {
    var el = $("pk-result");
    if (el) el.textContent = text || "";
  }

  function updateHUD() {
    var b = $("pk-balance");
    var p = $("pk-pot");
    if (b) b.textContent = String(state.balance);
    if (p) p.textContent = String(state.pot);
    renderCards();
    var deal = $("btn-pk-deal");
    var fold = $("btn-pk-fold");
    var call = $("btn-pk-call");
    var raise = $("btn-pk-raise");
    var acting = state.phase === "action" && state.playerIn;
    if (deal) deal.disabled = state.phase === "action";
    if (fold) fold.disabled = !acting;
    if (call) {
      call.disabled = !acting;
      call.textContent = state.raised ? "コール +" + state.toCall : "コール +" + ANTE;
    }
    if (raise) raise.disabled = !acting || state.raised || state.balance < ANTE * 2;
  }

  /** 5枚の役評価 → { score: number[], name: string } 大きいほど強い */
  function evalFive(cards) {
    var vs = cards.map(function (c) {
      return c.v;
    }).sort(function (a, b) {
      return b - a;
    });
    var suits = {};
    var ranks = {};
    cards.forEach(function (c) {
      suits[c.suit] = (suits[c.suit] || 0) + 1;
      ranks[c.v] = (ranks[c.v] || 0) + 1;
    });
    var flush = Object.keys(suits).some(function (k) {
      return suits[k] >= 5;
    });
    var uniq = vs.filter(function (v, i, a) {
      return a.indexOf(v) === i;
    });
    var straight = false;
    var highStraight = 0;
    if (uniq.length >= 5) {
      for (var i = 0; i <= uniq.length - 5; i++) {
        if (uniq[i] - uniq[i + 4] === 4) {
          straight = true;
          highStraight = uniq[i];
          break;
        }
      }
    }
    /* A-2-3-4-5 */
    if (
      !straight &&
      uniq.indexOf(14) !== -1 &&
      uniq.indexOf(5) !== -1 &&
      uniq.indexOf(4) !== -1 &&
      uniq.indexOf(3) !== -1 &&
      uniq.indexOf(2) !== -1
    ) {
      straight = true;
      highStraight = 5;
    }

    var counts = Object.keys(ranks)
      .map(function (k) {
        return { v: +k, n: ranks[k] };
      })
      .sort(function (a, b) {
        if (b.n !== a.n) return b.n - a.n;
        return b.v - a.v;
      });

    if (straight && flush) {
      return { score: [8, highStraight], name: "ストレートフラッシュ" };
    }
    if (counts[0].n === 4) {
      return { score: [7, counts[0].v, counts[1] ? counts[1].v : 0], name: "フォーカード" };
    }
    if (counts[0].n === 3 && counts[1] && counts[1].n === 2) {
      return { score: [6, counts[0].v, counts[1].v], name: "フルハウス" };
    }
    if (flush) {
      return { score: [5].concat(vs), name: "フラッシュ" };
    }
    if (straight) {
      return { score: [4, highStraight], name: "ストレート" };
    }
    if (counts[0].n === 3) {
      var kickers3 = counts.slice(1).map(function (c) {
        return c.v;
      });
      return { score: [3, counts[0].v].concat(kickers3), name: "スリーカード" };
    }
    if (counts[0].n === 2 && counts[1] && counts[1].n === 2) {
      var hi = Math.max(counts[0].v, counts[1].v);
      var lo = Math.min(counts[0].v, counts[1].v);
      var k = counts[2] ? counts[2].v : 0;
      return { score: [2, hi, lo, k], name: "ツーペア" };
    }
    if (counts[0].n === 2) {
      var kick = counts.slice(1).map(function (c) {
        return c.v;
      });
      return { score: [1, counts[0].v].concat(kick), name: "ワンペア" };
    }
    return { score: [0].concat(vs), name: "ハイカード" };
  }

  function cmpScore(a, b) {
    var n = Math.max(a.length, b.length);
    for (var i = 0; i < n; i++) {
      var x = a[i] || 0;
      var y = b[i] || 0;
      if (x !== y) return x > y ? 1 : -1;
    }
    return 0;
  }

  function deal() {
    if (state.balance < ANTE) {
      setMsg("チップが足りません。ページを再読込すると練習用チップがリセットされます。");
      return;
    }
    state.deck = newDeck();
    state.player = [state.deck.pop(), state.deck.pop()];
    state.cpu = [state.deck.pop(), state.deck.pop()];
    state.board = [state.deck.pop(), state.deck.pop(), state.deck.pop()];
    state.playerIn = true;
    state.cpuIn = true;
    state.raised = false;
    state.toCall = ANTE;
    state.pot = ANTE * 2;
    state.balance -= ANTE;
    state.phase = "action";
    setResult("");
    setMsg(
      "アンティ <strong>" +
        ANTE +
        "</strong> を支払いました。場の3枚を見て、<strong>降りる / 乗る / 上げる</strong>を選んでください。"
    );
    updateHUD();
  }

  function cpuDecision() {
    if (!state.cpuIn) return;
    var hand = state.cpu.concat(state.board);
    var e = evalFive(hand);
    /* 簡易AI: ペア以上は乗りやすい */
    var strength = e.score[0];
    if (state.raised) {
      if (strength >= 1 || Math.random() < 0.35) {
        /* call already accounted in pot by player raise path */
      } else {
        state.cpuIn = false;
      }
      return;
    }
    if (strength >= 2 && Math.random() < 0.25 && !state.raised) {
      /* occasional raise handled only from player side for simplicity */
    }
    if (strength === 0 && Math.random() < 0.4) {
      state.cpuIn = false;
    }
  }

  function playerFold() {
    if (state.phase !== "action" || !state.playerIn) return;
    state.playerIn = false;
    state.phase = "over";
    setMsg("フォールドしました。ポットはCPUへ。");
    setResult("負け（フォールド）");
    updateHUD();
  }

  function playerCall() {
    if (state.phase !== "action" || !state.playerIn) return;
    var cost = state.raised ? state.toCall : ANTE;
    if (state.balance < cost) {
      setMsg("チップ不足です。");
      return;
    }
    state.balance -= cost;
    state.pot += cost;
    /* CPU 側もコール相当をポットに（簡易: 既にアンティ済み。レイズ時はCPUも追加） */
    if (state.raised) {
      /* player matching raise — CPU already put raise amount when we simulated? 
         簡易ルール: レイズはプレイヤーのみ。CPUはコールかフォールド */
      cpuDecision();
      if (state.cpuIn) {
        /* CPU calls raise: add toCall to pot from "cpu bank" (infinite for demo aesthetic, don't touch player) */
        state.pot += state.toCall;
      }
    } else {
      state.pot += ANTE; /* CPU calls */
      cpuDecision();
      if (!state.cpuIn) {
        state.phase = "over";
        state.balance += state.pot;
        setMsg("CPUがフォールド。ポット <strong>" + state.pot + "</strong> を獲得！");
        setResult("勝ち（相手フォールド）");
        state.pot = 0;
        updateHUD();
        return;
      }
    }
    showdown();
  }

  function playerRaise() {
    if (state.phase !== "action" || !state.playerIn || state.raised) return;
    var cost = ANTE * 2;
    if (state.balance < cost) {
      setMsg("レイズに必要なチップが足りません。");
      return;
    }
    state.balance -= cost;
    state.pot += cost;
    state.raised = true;
    state.toCall = cost;
    setMsg("レイズ（+" + cost + "）。CPUが応答します…");
    updateHUD();
    setTimeout(function () {
      var hand = state.cpu.concat(state.board);
      var e = evalFive(hand);
      if (e.score[0] >= 1 || Math.random() < 0.3) {
        state.pot += cost;
        setMsg("CPUがコール。ショーダウン！");
        showdown();
      } else {
        state.cpuIn = false;
        state.phase = "over";
        state.balance += state.pot;
        setMsg("CPUがフォールド。ポット <strong>" + state.pot + "</strong> を獲得！");
        setResult("勝ち（相手フォールド）");
        state.pot = 0;
        updateHUD();
      }
    }, 450);
  }

  function showdown() {
    state.phase = "showdown";
    var pEval = evalFive(state.player.concat(state.board));
    var cEval = evalFive(state.cpu.concat(state.board));
    var cmp = cmpScore(pEval.score, cEval.score);
    var msg =
      "あなた: <strong>" +
      pEval.name +
      "</strong> ／ CPU: <strong>" +
      cEval.name +
      "</strong> — ";
    if (cmp > 0) {
      state.balance += state.pot;
      msg += "あなたの勝ち！ +" + state.pot;
      setResult("勝ち · " + pEval.name);
    } else if (cmp < 0) {
      msg += "CPUの勝ち…";
      setResult("負け · 相手 " + cEval.name);
    } else {
      var half = Math.floor(state.pot / 2);
      state.balance += half;
      msg += "引き分け（分割）";
      setResult("引き分け");
    }
    state.pot = 0;
    state.phase = "over";
    setMsg(msg);
    updateHUD();
  }

  function bind() {
    var d = $("btn-pk-deal");
    var f = $("btn-pk-fold");
    var c = $("btn-pk-call");
    var r = $("btn-pk-raise");
    if (d) d.addEventListener("click", deal);
    if (f) f.addEventListener("click", playerFold);
    if (c) c.addEventListener("click", playerCall);
    if (r) r.addEventListener("click", playerRaise);
    setMsg("「ディール」で文化祭ルールの1ハンドを開始します。アンティは <strong>" + ANTE + "</strong> です。");
    updateHUD();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", bind);
  } else {
    bind();
  }
})();
