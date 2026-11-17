// prank.js — gags purement visuels (branche dev).
// Rien de caché : tout se voit à l'écran, ne touche ni aux prix réels, ni à la production,
// ni au classement, et un simple rechargement de la page remet tout en place.
(() => {
  'use strict';

  const PO_IMG = (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.getURL)
    ? chrome.runtime.getURL('assets/po.png')
    : 'assets/po.png';

  let balloonMode = false;

  /* ============================================================
   *  Gag 1 — la puce SEC perd ses broches, puis s'envole
   * ============================================================ */

  // Un clic sur la puce = une broche qui tombe. Quand il n'en reste plus → envol.
  document.addEventListener('click', (e) => {
    const chip = e.target.closest && e.target.closest('#tycChip');
    if (!chip || balloonMode) return;
    dropOnePin(chip);
  }, true);

  function dropOnePin(chip) {
    const pins = [...chip.querySelectorAll('.tyc-pins rect:not(.prk-gone)')];
    if (!pins.length) { startBalloon(chip); return; }
    const pin = pins[Math.floor(Math.random() * pins.length)];
    pin.classList.add('prk-gone');
    spawnFallingPin(pin);
    if (chip.querySelectorAll('.tyc-pins rect:not(.prk-gone)').length === 0) {
      setTimeout(() => startBalloon(chip), 450); // laisser la dernière broche tomber
    }
  }

  // Petite broche dorée en overlay qui tombe et disparaît
  function spawnFallingPin(pinEl) {
    const r = pinEl.getBoundingClientRect();
    const d = document.createElement('div');
    d.className = 'prk-pin';
    d.style.left = `${r.left}px`;
    d.style.top = `${r.top}px`;
    d.style.width = `${Math.max(4, r.width)}px`;
    d.style.height = `${Math.max(4, r.height)}px`;
    d.style.setProperty('--prk-spin', `${(Math.random() * 2 - 1) * 720}deg`);
    d.style.setProperty('--prk-drift', `${(Math.random() * 2 - 1) * 80}px`);
    document.body.appendChild(d);
    requestAnimationFrame(() => d.classList.add('prk-pin-fall'));
    setTimeout(() => d.remove(), 1700);
  }

  // La puce se détache et part en vrille comme un ballon qui se dégonfle, 30 s, puis explose.
  function startBalloon(chip) {
    if (balloonMode) return;
    balloonMode = true;

    const rect = chip.getBoundingClientRect();
    document.body.appendChild(chip); // sortie de toute zone qui la masquerait → toujours au premier plan
    chip.style.position = 'fixed';
    chip.style.left = `${rect.left}px`;
    chip.style.top = `${rect.top}px`;
    chip.style.width = `${rect.width}px`;
    chip.style.height = `${rect.height}px`;
    chip.style.margin = '0';
    chip.style.zIndex = '2147483646';
    chip.classList.add('prk-balloon');

    showBanner('Double-clic sur la puce avant qu’elle explose !');

    const state = { defused: false, exploded: false, raf: 0, boom: 0 };

    let x = rect.left, y = rect.top;
    let vx = (Math.random() * 2 - 1) * 7, vy = -8;
    let rot = 0, vr = (Math.random() * 2 - 1) * 9, scale = 1;
    const t0 = performance.now();

    function frame(now) {
      if (state.defused || state.exploded) return;
      const t = now - t0;
      // dégonflage : poussées aléatoires façon « pfffft »
      vx += (Math.random() * 2 - 1) * 2.35;
      vy += (Math.random() * 2 - 1) * 2.35;
      const sp = Math.hypot(vx, vy), max = 14.5;
      if (sp > max) { vx = vx / sp * max; vy = vy / sp * max; }
      x += vx; y += vy;
      scale = Math.max(0.5, 1 - (t / 30000) * 0.45);
      const w = rect.width * scale, h = rect.height * scale;
      if (x < 0) { x = 0; vx = Math.abs(vx); }
      if (x > innerWidth - w) { x = innerWidth - w; vx = -Math.abs(vx); }
      if (y < 0) { y = 0; vy = Math.abs(vy); }
      if (y > innerHeight - h) { y = innerHeight - h; vy = -Math.abs(vy); }
      vr += (Math.random() * 2 - 1) * 6; vr *= 0.92; rot += vr;
      chip.style.left = `${x}px`;
      chip.style.top = `${y}px`;
      chip.style.transform = `rotate(${rot}deg) scale(${scale})`;
      state.raf = requestAnimationFrame(frame);
    }
    state.raf = requestAnimationFrame(frame);

    // Double-clic sur la puce = désamorçage (elle s'arrête ; recharger pour tout remettre)
    chip.addEventListener('dblclick', (ev) => {
      ev.preventDefault();
      if (state.exploded || state.defused) return;
      state.defused = true;
      cancelAnimationFrame(state.raf);
      clearTimeout(state.boom);
      removeBanner();
      chip.style.transition = 'transform .4s ease';
      chip.style.transform = 'rotate(0deg) scale(1)';
      setTimeout(() => { chip.style.transition = ''; enableDrag(chip); }, 420);
      shuffleButtons(); // les boutons d'achat se mélangent
    });

    // Sinon, explosion au bout de 30 s : toute l'interface disparaît (rechargement nécessaire)
    state.boom = setTimeout(() => {
      if (state.defused) return;
      state.exploded = true;
      cancelAnimationFrame(state.raf);
      explode(chip);
    }, 30000);
  }

  function explode(chip) {
    removeBanner();
    const r = chip.getBoundingClientRect();
    const boom = document.createElement('div');
    boom.className = 'prk-boom';
    boom.textContent = '💥';
    boom.style.left = `${r.left + r.width / 2}px`;
    boom.style.top = `${r.top + r.height / 2}px`;
    document.body.appendChild(boom);
    chip.style.display = 'none';
    setTimeout(() => {
      const panel = document.querySelector('.tyc') || document.getElementById('tycPanel');
      if (panel) panel.style.visibility = 'hidden';
      showDeadLabel();
    }, 450);
    setTimeout(() => boom.remove(), 1600);
  }

  // Petit texte au centre une fois le labo disparu
  function showDeadLabel() {
    if (document.querySelector('.prk-dead')) return;
    const d = document.createElement('div');
    d.className = 'prk-dead';
    d.textContent = 'Ton labo a explosé';
    document.body.appendChild(d);
  }

  // Glisser-déposer la puce désamorcée pour la remettre où on veut
  function enableDrag(chip) {
    chip.style.cursor = 'grab';
    chip.addEventListener('mousedown', (e) => {
      e.preventDefault();
      chip.style.cursor = 'grabbing';
      const r = chip.getBoundingClientRect();
      const ox = e.clientX - r.left, oy = e.clientY - r.top;
      const move = (ev) => {
        chip.style.left = `${ev.clientX - ox}px`;
        chip.style.top = `${ev.clientY - oy}px`;
      };
      const up = () => {
        chip.style.cursor = 'grab';
        document.removeEventListener('mousemove', move);
        document.removeEventListener('mouseup', up);
      };
      document.addEventListener('mousemove', move);
      document.addEventListener('mouseup', up);
    });
  }

  // Mélange l'ordre d'affichage des machines (via l'ordre flex : résiste aux maj de prix du jeu)
  function shuffleButtons() {
    const list = document.getElementById('tycBuildings');
    if (!list) return;
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    const rows = [...list.querySelectorAll('.tyc-b')];
    const order = rows.map((_, i) => i);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    rows.forEach((r, i) => { r.style.order = String(order[i]); });
  }

  /* ============================================================
   *  Gag 2 — les boutons d'achat esquivent le curseur
   * ============================================================ */
  document.addEventListener('mouseover', (e) => {
    const btn = e.target.closest && e.target.closest('.tyc-buy');
    if (!btn) return;
    const n = (btn._prkDodge || 0);
    if (n >= 3) return; // après 3 esquives, on se laisse cliquer
    btn._prkDodge = n + 1;
    const dx = (Math.random() * 2 - 1) * 90;
    const dy = (Math.random() * 2 - 1) * 46;
    btn.style.transition = 'transform .18s ease';
    btn.style.transform = `translate(${dx.toFixed(0)}px, ${dy.toFixed(0)}px)`;
    clearTimeout(btn._prkT);
    btn._prkT = setTimeout(() => { btn.style.transform = ''; btn._prkDodge = 0; }, 1300);
  }, true);

  /* ============================================================
   *  Gag 3 — « c'est le café de Pô !!!! » à chaque café
   * ============================================================ */
  document.addEventListener('click', (e) => {
    const c = e.target.closest && e.target.closest('#tycCoffee');
    if (!c || c.disabled) return;
    showPo();
  }, true);

  function showPo() {
    if (document.querySelector('.prk-po')) return;
    const o = document.createElement('div');
    o.className = 'prk-po';
    o.innerHTML = `<img src="${PO_IMG}" alt=""><div class="prk-po-txt">c’est le café de Pô !!!!</div>`;
    document.body.appendChild(o);
    requestAnimationFrame(() => o.classList.add('prk-po-in'));
    const close = () => { o.classList.remove('prk-po-in'); setTimeout(() => o.remove(), 300); };
    o.addEventListener('click', close);
    setTimeout(close, 5000);
  }

  /* ---------------- bannière centrale ---------------- */
  function showBanner(text) {
    removeBanner();
    const b = document.createElement('div');
    b.className = 'prk-banner';
    b.innerHTML = `<div class="prk-banner-box">${text}</div>`;
    document.body.appendChild(b);
  }
  function removeBanner() {
    document.querySelector('.prk-banner')?.remove();
  }
})();
