/**
 * G⁵ Portal Radial Menu — system fully based on asobiseminar MENU
 * Design tokens: 5G-staff (pink / cyan / gold / deep)
 */
(function () {
  'use strict';

  var BASE = (window.G5 && G5.BASE) || '.';
  function href(page) {
    if (!BASE || BASE === '.') {
      return page === '/' || page === '' ? 'index.html' : String(page).replace(/^\//, '');
    }
    return BASE + (String(page).indexOf('/') === 0 ? page : '/' + page);
  }

  function buildMenuData() {
    return [
      { label: 'ホーム', icon: '✦', url: href('/') },
      { label: 'シフト', icon: '◈', url: href('/shift.html') },
      { label: 'マニュアル', icon: '◇', url: href('/manual.html') },
      { label: '管理', icon: '✧', url: href('/admin.html') },
      {
        label: 'その他',
        icon: '◎',
        items: [
          { label: 'トップへ', icon: '↑', action: 'scrollTop' },
          { label: '更新', icon: '↻', action: 'reload' }
        ]
      }
    ];
  }

  var LONG_PRESS_MS = 360;
  var TRIPLE_TAP_DELAY_MS = 300;
  var MOVE_THRESHOLD = 8;
  var SHELL_CAPACITIES = [6, 10, 14];
  var SHELL_RADII = [118, 190, 262];

  var menuEl, itemsContainer, orbitsContainer, coreBtn, canvas, ctx;
  var timer, startX, startY, isOpen = false, menuStack = [];
  var pieDisabled = false;
  var tapCount = 0, tapTimer = null;

  function navigateWithDelay(url) {
    closeMenu();
    setTimeout(function () { location.href = url; }, 180);
  }

  function triggerParticleBurst() {
    if (!canvas || !ctx) return;
    canvas.width = 640;
    canvas.height = 640;
    var cX = 320, cY = 320;
    var ring1R = 12, ring1A = 1;
    var ring2R = 6, ring2A = 0.85;
    var particles = [];
    for (var i = 0; i < 32; i++) {
      var a = (i / 32) * Math.PI * 2 + Math.random() * 0.2;
      var spd = Math.random() * 7.5 + 3.2;
      var hue = [330, 190, 48][i % 3];
      particles.push({
        x: cX, y: cY,
        vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
        size: Math.random() * 3.2 + 1.4,
        color: 'hsl(' + (hue + Math.random() * 12 - 6) + ', 92%, 62%)',
        alpha: 1
      });
    }
    function draw() {
      ctx.clearRect(0, 0, 640, 640);
      if (ring1A > 0) {
        ctx.beginPath();
        ctx.arc(cX, cY, ring1R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,45,149,' + ring1A + ')';
        ctx.lineWidth = 3.5;
        ctx.stroke();
        ring1R += 8.5;
        ring1A -= 0.045;
      }
      if (ring2A > 0) {
        ctx.beginPath();
        ctx.arc(cX, cY, ring2R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0,245,255,' + ring2A + ')';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ring2R += 6.8;
        ring2A -= 0.036;
      }
      var alive = false;
      particles.forEach(function (p) {
        if (p.alpha > 0) {
          alive = true;
          p.x += p.vx; p.y += p.vy;
          p.vx *= 0.92; p.vy *= 0.92;
          p.alpha -= 0.032;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.globalAlpha = Math.max(0, p.alpha);
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
      if (ring1A > 0 || ring2A > 0 || alive) requestAnimationFrame(draw);
      else ctx.clearRect(0, 0, 640, 640);
    }
    draw();
  }

  function calculateShellLayout(items) {
    var layout = [], remaining = items.length, itemIdx = 0;
    for (var sIdx = 0; sIdx < SHELL_CAPACITIES.length && remaining > 0; sIdx++) {
      var count = Math.min(remaining, SHELL_CAPACITIES[sIdx]);
      var radius = SHELL_RADII[sIdx];
      for (var i = 0; i < count; i++) {
        var angle = (i / count) * 2 * Math.PI - Math.PI / 2;
        layout.push({
          item: items[itemIdx],
          x: Math.round(Math.cos(angle) * radius),
          y: Math.round(Math.sin(angle) * radius),
          shellIndex: sIdx
        });
        itemIdx++;
      }
      remaining -= count;
    }
    return layout;
  }

  function handleItemAction(item) {
    if (item.action === 'scrollTop') {
      closeMenu();
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (item.action === 'reload') {
      closeMenu();
      location.reload();
      return;
    }
    if (item.url) navigateWithDelay(item.url);
  }

  function renderMenuLevel(items) {
    var old = itemsContainer.querySelectorAll('.rm-item');
    for (var i = 0; i < old.length; i++) {
      old[i].classList.remove('rendered');
      (function (el) {
        setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 220);
      })(old[i]);
    }
    orbitsContainer.innerHTML = '';
    var layout = calculateShellLayout(items);
    var activeShells = {};
    layout.forEach(function (data, index) {
      activeShells[data.shellIndex] = true;
      var btn = document.createElement('button');
      btn.className = 'rm-item' + (data.item.items ? ' has-sub' : '');
      btn.setAttribute('data-label', data.item.label);
      btn.innerHTML = data.item.icon || '•';
      btn.style.setProperty('--x', data.x + 'px');
      btn.style.setProperty('--y', data.y + 'px');
      btn.style.transitionDelay = (index * 0.024) + 's';
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        if (e.stopImmediatePropagation) e.stopImmediatePropagation();
        if (data.item.items && data.item.items.length) {
          menuStack.push(items);
          renderMenuLevel(data.item.items);
          triggerParticleBurst();
        } else {
          handleItemAction(data.item);
        }
      });
      itemsContainer.appendChild(btn);
      requestAnimationFrame(function () {
        setTimeout(function () { btn.classList.add('rendered'); }, 14);
      });
    });
    Object.keys(activeShells).forEach(function (sIdx) {
      sIdx = +sIdx;
      var orbit = document.createElement('div');
      orbit.className = 'rm-shell-orbit';
      var d = SHELL_RADII[sIdx] * 2;
      orbit.style.width = d + 'px';
      orbit.style.height = d + 'px';
      orbit.style.marginTop = -SHELL_RADII[sIdx] + 'px';
      orbit.style.marginLeft = -SHELL_RADII[sIdx] + 'px';
      orbitsContainer.appendChild(orbit);
    });
    coreBtn.classList.toggle('visible', menuStack.length > 0);
  }

  function createMenuDOM() {
    menuEl = document.createElement('div');
    menuEl.className = 'radial-menu-wrapper';
    canvas = document.createElement('canvas');
    canvas.className = 'rm-canvas-layer';
    ctx = canvas.getContext('2d');
    menuEl.appendChild(canvas);
    orbitsContainer = document.createElement('div');
    menuEl.appendChild(orbitsContainer);
    itemsContainer = document.createElement('div');
    menuEl.appendChild(itemsContainer);
    coreBtn = document.createElement('button');
    coreBtn.className = 'rm-core-btn';
    coreBtn.innerHTML = '←';
    coreBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      if (menuStack.length) {
        renderMenuLevel(menuStack.pop());
        triggerParticleBurst();
      } else closeMenu();
    });
    menuEl.appendChild(coreBtn);
    document.body.appendChild(menuEl);
  }

  function openMenu(x, y) {
    if (!menuEl) return;
    var margin = 180;
    menuEl.style.left = Math.max(margin, Math.min(x || window.innerWidth / 2, window.innerWidth - margin)) + 'px';
    menuEl.style.top = Math.max(margin, Math.min(y || window.innerHeight / 2, window.innerHeight - margin)) + 'px';
    menuEl.classList.add('active');
    isOpen = true;
    menuStack = [];
    renderMenuLevel(buildMenuData());
    triggerParticleBurst();
  }

  function closeMenu() {
    if (!menuEl) return;
    menuEl.classList.remove('active');
    itemsContainer.querySelectorAll('.rm-item').forEach(function (i) { i.classList.remove('rendered'); });
    coreBtn.classList.remove('visible');
    isOpen = false;
  }

  function ensureHamburgerUI() {
    if (document.getElementById('ham-overlay')) return;
    var style = document.createElement('style');
    style.id = 'ham-style';
    style.textContent = [
      '#ham-overlay{position:fixed;inset:0;z-index:100000;display:none;background:rgba(7,5,15,.72);backdrop-filter:blur(8px);-webkit-backdrop-filter:blur(8px);}',
      '#ham-overlay.open{display:block}',
      '#ham-panel{position:fixed;inset:0;z-index:100001;display:none;flex-direction:column;',
      'background:linear-gradient(165deg,#0a0714 0%,#120a1f 55%,#1a0f2e 100%);color:#f5f0ff;padding:1.25rem 1.25rem 2rem;overflow:auto}',
      '#ham-panel.open{display:flex}',
      '#ham-panel .ham-top{display:flex;align-items:center;justify-content:space-between;margin-bottom:1.25rem}',
      '#ham-panel .ham-title{font-weight:700;font-size:1.15rem;letter-spacing:.04em;background:linear-gradient(105deg,#fff,#ff2d95,#00f5ff);-webkit-background-clip:text;background-clip:text;color:transparent}',
      '#ham-panel .ham-close{border:0;background:rgba(255,45,149,.2);color:#fff;width:42px;height:42px;border-radius:50%;font-size:1.25rem;cursor:pointer;border:1px solid rgba(255,45,149,.35)}',
      '#ham-panel .ham-list{display:flex;flex-direction:column;gap:.55rem;max-width:520px;margin:0 auto;width:100%}',
      '#ham-panel .ham-link,#ham-panel .ham-group-btn{display:block;width:100%;text-align:left;border:0;border-radius:14px;',
      'padding:.95rem 1.1rem;font:inherit;font-weight:600;font-size:1rem;cursor:pointer;text-decoration:none;color:#f5f0ff;',
      'background:rgba(255,255,255,.06);border:1px solid rgba(255,255,255,.1)}',
      '#ham-panel .ham-link:hover,#ham-panel .ham-group-btn:hover{background:rgba(255,45,149,.22);border-color:rgba(255,45,149,.4)}',
      '#ham-panel .ham-sub{margin:.15rem 0 .35rem 1rem;display:flex;flex-direction:column;gap:.35rem}',
      '#ham-panel .ham-sub a{font-size:.92rem;padding:.7rem 1rem;border-radius:12px;background:rgba(0,0,0,.25);color:#e8e0f5;text-decoration:none;border:1px solid rgba(255,255,255,.06)}',
      '#ham-panel .ham-hint{margin-top:auto;padding-top:1.5rem;font-size:.8rem;opacity:.65;text-align:center;color:rgba(245,240,255,.7)}'
    ].join('');
    document.head.appendChild(style);
    var ov = document.createElement('div');
    ov.id = 'ham-overlay';
    var panel = document.createElement('div');
    panel.id = 'ham-panel';
    panel.innerHTML = '<div class="ham-top"><div class="ham-title">G⁵ Portal Menu</div>' +
      '<button type="button" class="ham-close" id="ham-close" aria-label="閉じる">✕</button></div>' +
      '<div class="ham-list" id="ham-list"></div>' +
      '<p class="ham-hint">閉じると長押しパイメニューが再び使えます</p>';
    document.body.appendChild(ov);
    document.body.appendChild(panel);
    document.getElementById('ham-close').onclick = closeHamburger;
    ov.onclick = closeHamburger;
    document.getElementById('ham-panel').addEventListener('click', function (e) { e.stopPropagation(); });
  }

  function openHamburger() {
    ensureHamburgerUI();
    pieDisabled = true;
    closeMenu();
    var list = document.getElementById('ham-list');
    list.innerHTML = '';
    var data = buildMenuData();
    data.forEach(function (item) {
      if (item.items && item.items.length) {
        var wrap = document.createElement('div');
        var btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'ham-group-btn';
        btn.textContent = (item.icon ? item.icon + ' ' : '') + item.label;
        var sub = document.createElement('div');
        sub.className = 'ham-sub';
        sub.style.display = 'none';
        item.items.forEach(function (subItem) {
          var a = document.createElement('a');
          a.href = subItem.url || '#';
          a.textContent = (subItem.icon ? subItem.icon + ' ' : '') + subItem.label;
          if (subItem.action) {
            a.addEventListener('click', function (e) {
              e.preventDefault();
              closeHamburger();
              handleItemAction(subItem);
            });
          }
          sub.appendChild(a);
        });
        btn.onclick = function () {
          sub.style.display = sub.style.display === 'none' ? 'flex' : 'none';
        };
        wrap.appendChild(btn);
        wrap.appendChild(sub);
        list.appendChild(wrap);
      } else {
        var a = document.createElement('a');
        a.className = 'ham-link';
        a.href = item.url || '#';
        a.textContent = (item.icon ? item.icon + ' ' : '') + item.label;
        list.appendChild(a);
      }
    });
    document.getElementById('ham-overlay').classList.add('open');
    document.getElementById('ham-panel').classList.add('open');
    document.body.style.overflow = 'hidden';
  }

  function closeHamburger() {
    var ov = document.getElementById('ham-overlay');
    var panel = document.getElementById('ham-panel');
    if (ov) ov.classList.remove('open');
    if (panel) panel.classList.remove('open');
    document.body.style.overflow = '';
    pieDisabled = false;
  }

  function mountFab() {
    if (document.querySelector('.menu-fab')) return;
    var fab = document.createElement('button');
    fab.type = 'button';
    fab.className = 'menu-fab';
    fab.setAttribute('aria-label', 'メニューを開く');
    fab.innerHTML = '☰';
    document.body.appendChild(fab);
    fab.onclick = function (e) {
      e.stopPropagation();
      openHamburger();
    };
  }

  function initEvents() {
    document.addEventListener('pointerdown', function (e) {
      if (e.target.closest && (
        e.target.closest('.menu-fab') ||
        e.target.closest('.radial-menu-wrapper') ||
        e.target.closest('#ham-panel') ||
        e.target.closest('#ham-overlay') ||
        e.target.closest('.notif-bell') ||
        e.target.closest('.notif-panel') ||
        e.target.closest('a') ||
        e.target.closest('button') ||
        e.target.closest('input') ||
        e.target.closest('select') ||
        e.target.closest('textarea') ||
        e.target.closest('label')
      )) return;

      if (isOpen && menuEl && !menuEl.contains(e.target)) {
        closeMenu();
        return;
      }
      startX = e.clientX;
      startY = e.clientY;
      tapCount++;
      clearTimeout(tapTimer);
      if (tapCount === 3) {
        clearTimeout(timer);
        timer = null;
        tapCount = 0;
        if (!pieDisabled) openMenu(startX, startY);
        return;
      }
      tapTimer = setTimeout(function () { tapCount = 0; }, TRIPLE_TAP_DELAY_MS);
      if (pieDisabled) return;
      clearTimeout(timer);
      timer = setTimeout(function () {
        if (pieDisabled) return;
        tapCount = 0;
        openMenu(startX, startY);
      }, LONG_PRESS_MS);
    });
    document.addEventListener('pointermove', function (e) {
      if (!timer || isOpen) return;
      if (Math.hypot(e.clientX - startX, e.clientY - startY) > MOVE_THRESHOLD) {
        clearTimeout(timer);
        timer = null;
      }
    });
    document.addEventListener('pointerup', function () {
      if (timer && !isOpen) {
        clearTimeout(timer);
        timer = null;
      }
    });
    document.addEventListener('keydown', function (e) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (pieDisabled) return;
        if (isOpen) closeMenu();
        else openMenu();
      }
      if (e.key === 'Escape' && pieDisabled) closeHamburger();
      if (e.key === 'Escape' && isOpen) closeMenu();
    });
  }

  function boot() {
    createMenuDOM();
    initEvents();
    mountFab();
    ensureHamburgerUI();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
