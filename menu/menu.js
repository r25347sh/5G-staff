/**
 * G⁵ Portal — radial MENU (click empty space)
 */
(function () {
  "use strict";
  const BASE = (window.G5 && G5.BASE) || ".";
  function href(page) {
    if (!BASE || BASE === ".") return page === "/" || page === "" ? "index.html" : page.replace(/^\//, "");
    return BASE + (page.startsWith("/") ? page : "/" + page);
  }
  const ITEMS = [
    { label: "ホーム", href: href("/"), icon: "✦" },
    { label: "シフト", href: href("/shift.html"), icon: "◈" },
    { label: "マニュアル", href: href("/manual.html"), icon: "◇" },
    { label: "管理", href: href("/admin.html"), icon: "✧" },
    { label: "トップへ", href: "#", icon: "↑", action: "scrollTop" }
  ];
  const RADIUS = 158;
  const IGNORE = new Set(["A", "BUTTON", "INPUT", "TEXTAREA", "SELECT", "LABEL"]);

  function build() {
    const stage = document.createElement("div");
    stage.className = "eb-stage";
    stage.setAttribute("role", "dialog");
    stage.innerHTML = '<div class="eb-veil"></div><div class="eb-core"><span>5G</span></div><div class="eb-hint">外側をクリック · ESC</div>';
    const tip = document.createElement("div");
    tip.className = "eb-tip";
    tip.textContent = "何もないところをクリックするとメニューが開きます";
    const items = ITEMS.map(function (it, i) {
      const a = document.createElement("a");
      a.className = "eb-item";
      a.href = it.href;
      a.innerHTML = '<span class="eb-item-icon">' + it.icon + '</span><span class="eb-item-label">' + it.label + '</span>';
      if (it.action === "scrollTop") {
        a.addEventListener("click", function (e) {
          e.preventDefault(); close(); window.scrollTo({ top: 0, behavior: "smooth" });
        });
      } else {
        a.addEventListener("click", function () { setTimeout(close, 90); });
      }
      stage.appendChild(a);
      return { el: a, angle: (i / ITEMS.length) * Math.PI * 2 - Math.PI / 2 };
    });
    document.body.appendChild(stage);
    document.body.appendChild(tip);
    let open = false;
    function openAt(x, y) {
      open = true;
      stage.classList.add("open");
      tip.classList.add("hide");
      const cx = x, cy = y;
      stage.style.setProperty("--x", cx + "px");
      stage.style.setProperty("--y", cy + "px");
      items.forEach(function (it, i) {
        const dx = Math.cos(it.angle) * RADIUS;
        const dy = Math.sin(it.angle) * RADIUS;
        it.el.style.transitionDelay = i * 0.04 + "s";
        it.el.style.transform = "translate(" + dx + "px," + dy + "px) scale(1)";
        it.el.style.opacity = "1";
      });
    }
    function close() {
      open = false;
      stage.classList.remove("open");
      items.forEach(function (it) {
        it.el.style.transitionDelay = "0s";
        it.el.style.transform = "translate(0,0) scale(0.5)";
        it.el.style.opacity = "0";
      });
    }
    document.addEventListener("click", function (e) {
      if (open) { close(); return; }
      if (IGNORE.has(e.target.tagName) || e.target.closest("a,button,input,label,.notif-bell,.notif-panel")) return;
      openAt(e.clientX, e.clientY);
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && open) close();
    });
    setTimeout(function () { tip.classList.add("show"); }, 1200);
    setTimeout(function () { tip.classList.add("hide"); }, 5000);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", build);
  else build();
})();
