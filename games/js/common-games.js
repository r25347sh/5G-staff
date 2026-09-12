(function () {
  "use strict";
  window.G5Games = {
    rand: function (n) { return Math.floor(Math.random() * n); },
    pick: function (arr) { return arr[Math.floor(Math.random() * arr.length)]; },
    sleep: function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); },
    shuffle: function (arr) {
      var a = arr.slice();
      for (var i = a.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var t = a[i]; a[i] = a[j]; a[j] = t;
      }
      return a;
    }
  };
})();
