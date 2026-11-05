// Labo Tycoon Helper
// Ajoute à droite de chaque prix (onglet Labo) le ratio prix ÷ production
// (prix du lot ÷ bits/s gagnés par ce lot). Plus c'est petit, mieux c'est.
// Puis la hausse de production (en %) qu'apporterait l'achat,
// puis un 3e indicateur : prix d'un bit/s ÷ hausse %.
// Couleur : vert = meilleur achat du moment, rouge = le plus cher relativement.
// Le contour de chaque bouton d'achat (onglets Labo et Améliorer) se remplit selon cagnotte ÷ prix.
(() => {
  'use strict';

  // Mêmes unités que le jeu (tycoon.js → UNITS), par paliers de 1000.
  const UNITS = { '': 1, k: 1e3, M: 1e6, Md: 1e9, Bn: 1e12, Bd: 1e15, Tn: 1e18, Td: 1e21, Qn: 1e24, Qd: 1e27, Sx: 1e30, Sp: 1e33 };

  /** "19,4 Bn" → 1.94e13 ; "+2,8 k/s chacun" → 2800 ; "12 345" → 12345 */
  function parseNum(text) {
    if (!text) return NaN;
    const m = String(text)
      .replace(/[\s  ]+(?=\d)/g, '') // espaces de milliers (toLocaleString fr)
      .match(/(-?\d+(?:[.,]\d+)?)\s*([A-Za-z]*)/);
    if (!m) return NaN;
    const mult = UNITS[m[2]];
    if (mult === undefined) return NaN;
    return parseFloat(m[1].replace(',', '.')) * mult;
  }

  /** "×1" → 1, "×10" → 10, "Max (37)" → 37, "Max" → 1 */
  function parseQty(label) {
    const m = String(label || '').match(/(\d+)/);
    return m ? Math.max(1, parseInt(m[1], 10)) : 1;
  }

  function fmtDuration(sec) {
    if (!isFinite(sec) || sec < 0) return '—';
    if (sec < 1) return '< 1 s';
    if (sec < 60) return `${Math.round(sec)} s`;
    const min = sec / 60;
    if (min < 60) { const m = Math.floor(min), s = Math.round(sec - m * 60); return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`; }
    const h = sec / 3600;
    if (h < 24) { const hh = Math.floor(h), mm = Math.round((h - hh) * 60); return mm ? `${hh} h ${String(mm).padStart(2, '0')}` : `${hh} h`; }
    const d = h / 24;
    if (d < 365) { const dd = Math.floor(d), hh = Math.round((d - dd) * 24); return hh ? `${dd} j ${hh} h` : `${dd} j`; }
    const y = d / 365;
    if (y < 10) return `${y.toFixed(1).replace('.', ',')} ans`;
    if (y < 1e6) return `${Math.round(y).toLocaleString('fr-FR')} ans`;
    return '∞';
  }

  /** Même format que le jeu : 344, 1,2 k, 6,9 Md… */
  const UNIT_NAMES = Object.keys(UNITS);
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (Math.abs(n) < 1000) return Math.abs(n) < 10 && n % 1 ? n.toFixed(1).replace('.', ',') : String(Math.floor(n));
    let i = 0;
    while (Math.abs(n) >= 1000 && i < UNIT_NAMES.length - 1) { n /= 1000; i++; }
    const s = n >= 100 ? Math.floor(n).toString() : (Math.floor(n * 10) / 10).toFixed(1).replace('.', ',').replace(/,0$/, '');
    return `${s} ${UNIT_NAMES[i]}`;
  }

  /** 0,0004 → "<0,001" ; 0,00264 → "0,0026" ; 0,973 → "0,97" ; 3,45 → "3,5" ; 27,8 → "28" */
  function fmtPct(p) {
    if (p < 0.001) return '<0,001';
    if (p < 1) return p.toLocaleString('fr-FR', { maximumSignificantDigits: 2 });
    if (p < 10) return p.toFixed(1).replace('.', ',');
    return Math.round(p).toLocaleString('fr-FR');
  }

  /** Écart à l'optimum en ordres de grandeur → classe de couleur. */
  function tier(gapLog10) {
    if (gapLog10 < 0.05) return 'lte-best';
    if (gapLog10 < 0.3) return 'lte-good';
    if (gapLog10 < 1) return 'lte-mid';
    if (gapLog10 < 2) return 'lte-bad';
    return 'lte-awful';
  }

  const TIERS = ['lte-best', 'lte-good', 'lte-mid', 'lte-bad', 'lte-awful'];

  function update() {
    const list = document.getElementById('tycBuildings');
    if (!cfg.indicators || !list || document.hidden || !list.offsetParent) { updateRings(); return; } // indicateurs masqués / Labo non affiché

    const rows = [];
    let base = 0; // production de base = somme des bits/s de chaque bâtiment (hors bonus temporaires)
    for (const row of list.querySelectorAll('.tyc-b[data-b]')) {
      const each = parseNum(row.querySelector('.tyc-each')?.textContent);
      const cost = parseNum(row.querySelector('.tyc-buyc')?.textContent);
      const qty = parseQty(row.querySelector('.tyc-buyl')?.textContent);
      const owned = (row.querySelector('.tyc-cnt')?.textContent || '').trim() !== '';
      const total = owned ? parseNum(row.querySelector('.tyc-bt .muted.small')?.textContent) : 0;
      if (isFinite(total)) base += total;
      const gain = each * qty; // bits/s ajoutés par cet achat
      const ratio = gain > 0 && cost > 0 ? gain / cost : NaN; // (bits/s) par bit dépensé
      rows.push({ row, each, cost, qty, gain, ratio });
    }

    // Indicateurs par ligne :
    //   pct   = hausse de production (%)           — plus grand = mieux
    //   score = (prix ÷ production) ÷ pct          — plus petit = mieux
    for (const r of rows) {
      r.pct = isFinite(r.gain) && r.gain > 0 && base > 0 ? (r.gain / base) * 100 : NaN;
      r.score = isFinite(r.pct) && r.pct > 0 && isFinite(r.ratio) ? 1 / r.ratio / r.pct : NaN;
    }
    const maxOf = (k) => Math.max(0, ...rows.map((r) => (isFinite(r[k]) ? r[k] : 0)));
    const best = maxOf('ratio'), bestPct = maxOf('pct');
    const bestScore = Math.min(...rows.map((r) => (isFinite(r.score) && r.score > 0 ? r.score : Infinity)));

    // Titres des colonnes, au-dessus de la première ligne
    if (rows[0] && !rows[0].row.querySelector(':scope > .lte-head')) {
      list.querySelectorAll('.lte-head').forEach((el) => el.remove());
      const head = document.createElement('span');
      head.className = 'lte-head';
      head.innerHTML = '<span>Prix d’1 bit/s</span><span>Hausse de<br>la prod</span><span>Prix d’1 % de hausse</span>';
      rows[0].row.appendChild(head);
    }

    for (const r of rows) {
      let side = r.row.querySelector(':scope > .lte-side');
      if (!side || side.children.length !== 3) {
        side?.remove();
        side = document.createElement('span');
        side.className = 'lte-side';
        side.innerHTML = '<span class="lte-badge"></span><span class="lte-pct"></span><span class="lte-score"></span>';
        r.row.appendChild(side);
        r.row.classList.add('lte-on');
      }
      const [badge, pctEl, scoreEl] = side.children;

      // 1) Ratio prix ÷ production (plus petit = meilleur)
      let text = '—', cls = 'lte-na', title = 'Impossible de lire le prix ou la production';
      if (isFinite(r.ratio) && best > 0) {
        const pp = 1 / r.ratio;
        cls = tier(Math.log10(best / r.ratio));
        text = cls === 'lte-best' ? `${fmt(pp)} ★` : fmt(pp); // ★ = à moins de ~12 % du meilleur
        title =
          `Prix ÷ production = ${fmt(r.cost)} ÷ ${fmt(r.gain)}/s = ${fmt(pp)}\n` +
          `(plus c'est petit, plus c'est rentable — ≈ ${fmtDuration(pp)} pour rembourser l'achat)`;
      }
      setText(badge, text, title);
      setTier(badge, cls);

      // 2) Hausse de production apportée par l'achat (plus grand = meilleur)
      let pText = '—', pTitle = 'Production actuelle inconnue';
      if (isFinite(r.pct)) {
        pText = `+${fmtPct(r.pct)} %${r.pct >= bestPct ? ' ★' : ''}`;
        pTitle = `Hausse de production = ${fmt(r.gain)}/s ÷ ${fmt(base)}/s = +${fmtPct(r.pct)} %\n(production de base, hors café / événements temporaires)`;
      }
      setText(pctEl, pText, pTitle);

      // 3) Prix d'un bit/s ÷ hausse % (plus petit = meilleur)
      let sText = '—', sCls = 'lte-na', sTitle = 'Indicateurs 1 ou 2 indisponibles';
      if (isFinite(r.score) && r.score > 0 && isFinite(bestScore)) {
        sCls = tier(Math.log10(r.score / bestScore));
        sText = `${fmt(r.score)}${sCls === 'lte-best' ? ' ★' : ''}`;
        sTitle =
          `Prix d'un bit/s ÷ hausse % = ${fmt(1 / r.ratio)} ÷ ${fmtPct(r.pct)} = ${fmt(r.score)}\n` +
          `(plus c'est petit, mieux c'est)`;
      }
      setText(scoreEl, sText, sTitle);
      setTier(scoreEl, sCls);
    }
    updateRings();
  }

  const SVG_NS = 'http://www.w3.org/2000/svg';

  /** Contour arrondi qui part du milieu en haut et tourne dans le sens horaire. */
  function ringPath(w, h, r) {
    const i = 1; // trait centré à 1 px du bord ; r = rayon du bouton − 1
    const L = i, T = i, R = w - i, B = h - i, cx = w / 2;
    return `M${cx},${T} H${R - r} A${r},${r} 0 0 1 ${R},${T + r} V${B - r} A${r},${r} 0 0 1 ${R - r},${B} ` +
      `H${L + r} A${r},${r} 0 0 1 ${L},${B - r} V${T + r} A${r},${r} 0 0 1 ${L + r},${T} Z`;
  }

  /** Contour de progression autour d'un bouton d'achat : cagnotte ÷ prix.
   *  p = progression 0…1 ; full = achat possible → contour masqué (style d'origine du site).
   *  intro = true : le contour repart de 0 et se remplit jusqu'à sa valeur (ouverture de l'onglet). */
  const INTRO_MS = 900;
  function updateRing(btn, p, full, intro = false) {
    if (!btn) return;
    let svg = btn.querySelector(':scope > svg.lte-ring');
    if (!svg) {
      svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'lte-ring');
      svg.setAttribute('aria-hidden', 'true');
      for (const cls of ['lte-ring-track', 'lte-ring-prog']) {
        const path = document.createElementNS(SVG_NS, 'path');
        path.setAttribute('class', cls);
        path.setAttribute('pathLength', '100');
        svg.appendChild(path);
      }
      btn.appendChild(svg);
      btn.classList.add('lte-ring-on');
    }
    p = isFinite(p) ? Math.max(0, Math.min(1, p)) : 0;
    if (svg.classList.contains('lte-ring-hidden') !== full) svg.classList.toggle('lte-ring-hidden', full);
    if (full) return; // achat possible : on laisse le bouton tel que le site l'affiche

    // (Re)calcule le tracé si la taille du bouton a changé
    const w = btn.offsetWidth, h = btn.offsetHeight, size = `${w}x${h}`;
    if (svg.dataset.size !== size && w && h) {
      svg.dataset.size = size;
      svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
      const radius = Math.max(0, (parseFloat(getComputedStyle(btn).borderTopLeftRadius) || 11) - 1);
      const d = ringPath(w, h, Math.min(radius, w / 2 - 1, h / 2 - 1));
      for (const path of svg.children) path.setAttribute('d', d);
    }
    const dash = `${(p * 100).toFixed(1)} 100`;
    const prog = svg.lastChild;
    if (intro) {
      // Animation d'ouverture : on part de 0, on force le rendu de ce point de départ, puis on vise la valeur
      svg.classList.add('lte-ring-intro');
      prog.setAttribute('stroke-dasharray', '0 100');
      getComputedStyle(prog).strokeDasharray; // applique « 0 » avant la transition
      clearTimeout(svg._lteIntro);
      svg._lteIntro = setTimeout(() => svg.classList.remove('lte-ring-intro'), INTRO_MS);
    }
    if (prog.getAttribute('stroke-dasharray') !== dash) prog.setAttribute('stroke-dasharray', dash);
  }

  /** Remet les contours d'une zone à 0, sans animation (quand l'onglet se ferme), pour la prochaine ouverture. */
  function resetRings(container) {
    for (const prog of container.querySelectorAll('.lte-ring-prog')) prog.setAttribute('stroke-dasharray', '0 100');
  }

  /* ---- Cagnotte précise ----
   * Le compteur du jeu est arrondi (« 1 Md » = entre 1,0 et 1,1 Md). On estime la vraie valeur :
   * elle avance au rythme affiché (bits/s) et reste dans l'intervalle compatible avec l'affichage ;
   * à chaque changement du chiffre affiché, l'estimation se recale exactement sur la nouvelle borne. */
  const bitsTracker = { est: NaN, t: 0 };
  /** Pas du dernier chiffre affiché : "1 Md" → 0,1 Md ; "4,9 Md" → 0,1 Md ; "368 M" → 1 M ; "12 345" → 1 */
  function displayStep(text) {
    const m = String(text).replace(/[\s\u00a0\u202f]+(?=\d)/g, '').match(/(\d+)(?:[.,](\d+))?\s*([A-Za-z]*)/);
    if (!m || UNITS[m[3]] === undefined) return 0;
    const unit = UNITS[m[3]];
    if (m[2]) return unit * 10 ** -m[2].length;
    if (!m[3]) return 1;
    return (Number(m[1]) >= 100 ? 1 : 0.1) * unit;
  }
  function readBits() {
    const text = document.getElementById('tycBits')?.textContent;
    const low = parseNum(text);
    if (!isFinite(low)) return NaN;
    const step = displayStep(text), high = low + step;
    const rate = parseNum(document.getElementById('tycRate')?.textContent) || 0;
    const now = performance.now(), T = bitsTracker;
    if (isFinite(T.est) && now - T.t < 5000) T.est += (rate * (now - T.t)) / 1000;
    else T.est = low;
    if (T.est < low) T.est = low;                       // le chiffre affiché vient de monter : recalage
    if (step > 0 && T.est >= high) T.est = high - step * 1e-3; // jamais au-delà de ce que l'affichage permet
    T.t = now;
    return T.est;
  }

  // Prix du bâtiment n°c = base × GROWTH^c (S.view.growth du jeu, mesuré à 1,15 via les prix ×1 / ×10).
  const GROWTH = 1.15;

  /** Mise à jour légère des seuls contours, onglets Labo et Améliorer (à chaque changement de la cagnotte).
   *  Quand un onglet devient visible, ses contours se remplissent depuis 0 (animation d'ouverture). */
  const shown = { tycBuildings: false, tycUpgrades: false };
  function updateRings() {
    if (!cfg.rings || document.hidden) return;
    const bits = readBits();
    const zone = (id, eachButton) => {
      const el = document.getElementById(id);
      const visible = !!(el && el.offsetParent);
      const intro = visible && !shown[id];
      if (!visible && shown[id] && el) resetRings(el);
      shown[id] = visible;
      if (visible) eachButton(el, intro);
    };
    // Labo : prix affiché dans le bouton (suit ×1 / ×10 / Max)
    zone('tycBuildings', (list, intro) => {
      for (const row of list.querySelectorAll('.tyc-b[data-b]')) {
        const btn = row.querySelector('.tyc-buy');
        const cost = parseNum(row.querySelector('.tyc-buyc')?.textContent);
        const label = row.querySelector('.tyc-buyl')?.textContent || '';
        const k = /^\s*Max/.test(label) ? Number((label.match(/\d+/) || [0])[0]) : 0;
        if (k >= 1 && isFinite(cost) && isFinite(bits)) {
          // Mode Max avec au moins 1 achetable : contour toujours affiché = progression vers le (k+1)e
          const next = (cost * (GROWTH - 1) * GROWTH ** k) / (GROWTH ** k - 1); // prix de l'unité suivante
          updateRing(btn, Math.min(0.999, (bits - cost) / next), false, intro);
        } else {
          const p = bits / cost;
          updateRing(btn, p, p >= 1 || !!btn?.classList.contains('ok'), intro);
        }
      }
    });
    // Améliorer : prix exact fourni par le jeu dans data-cost (améliorations disponibles uniquement)
    zone('tycUpgrades', (ups, intro) => {
      for (const tile of ups.querySelectorAll('.tyc-u[data-tyc-up][data-cost]')) {
        const p = bits / Number(tile.dataset.cost);
        updateRing(tile, p, p >= 1 || tile.classList.contains('ok'), intro);
      }
    });
  }

  function setText(el, text, title) {
    if (el.textContent !== text) el.textContent = text;
    if (el.title !== title) el.title = title;
  }
  function setTier(el, cls) {
    if (!el.classList.contains(cls)) { el.classList.remove('lte-na', ...TIERS); el.classList.add(cls); }
  }

  // Le jeu (tick toutes les 125 ms) réécrit la cagnotte et la liste. On regroupe toutes les
  // mutations d'un même tick en une seule mise à jour (microtâche, avant le rendu) :
  //   - la liste a changé (achat, prix…) → mise à jour complète ;
  //   - seule la cagnotte a changé       → mise à jour légère des contours.
  let pendingFull = false, pendingRings = false, scheduled = false;
  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      if (!el || el.closest('.lte-side, .lte-ring, .lte-head')) continue;
      if (el.id === 'tycBuildings' || el.closest('#tycBuildings')) pendingFull = true;
      else if (el.closest('#tycBits') || el.closest('#tycUpgrades')) pendingRings = true;
    }
    if (scheduled || !(pendingFull || pendingRings)) return;
    scheduled = true;
    queueMicrotask(() => {
      const full = pendingFull;
      scheduled = pendingFull = pendingRings = false;
      if (!running) return;
      observer.disconnect();
      try { full ? update() : updateRings(); } finally { if (running) observe(); }
    });
  });
  const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ------------------------- Réglages (popup) ------------------------- */
  // chrome.storage.local : { indicators: bool, rings: bool } (tous deux true par défaut).
  const DEFAULTS = { indicators: true, rings: true };
  let cfg = { indicators: false, rings: false };
  let running = false, timer = null;

  const removeIndicators = () => {
    document.querySelectorAll('.lte-side, .lte-head').forEach((el) => el.remove());
    document.querySelectorAll('.lte-on').forEach((el) => el.classList.remove('lte-on'));
  };
  const removeRings = () => {
    shown.tycBuildings = shown.tycUpgrades = false; // la prochaine activation rejoue l'animation
    document.querySelectorAll('.lte-ring').forEach((el) => el.remove());
    document.querySelectorAll('.lte-ring-on').forEach((el) => el.classList.remove('lte-ring-on'));
  };

  /** Applique les réglages : retire ce qui est désactivé, démarre / arrête la surveillance de la page. */
  function applyConfig(next) {
    cfg = { ...cfg, ...next };
    if (!cfg.indicators) removeIndicators();
    if (!cfg.rings) removeRings();
    const active = cfg.indicators || cfg.rings;
    if (active && !running) {
      running = true;
      observe();
      timer = setInterval(update, 1000); // filet de sécurité
    } else if (!active && running) {
      running = false;
      observer.disconnect();
      clearInterval(timer);
    }
    if (running) update();
  }

  chrome.storage.local.get(null, (st) => {
    // Ancienne version : un seul interrupteur « enabled »
    if (typeof st.enabled === 'boolean' && st.indicators === undefined && st.rings === undefined) {
      st.indicators = st.rings = st.enabled;
      chrome.storage.local.set({ indicators: st.enabled, rings: st.enabled });
      chrome.storage.local.remove('enabled');
    }
    applyConfig({ ...DEFAULTS, ...st });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = {};
    for (const k of Object.keys(DEFAULTS)) if (changes[k]) next[k] = changes[k].newValue ?? DEFAULTS[k];
    if (Object.keys(next).length) applyConfig(next);
  });
})();
