// Labo Tycoon Helper
// Ajoute à droite de chaque prix (onglet Labo) le ratio prix ÷ production
// (prix du lot ÷ bits/s gagnés par ce lot). Plus c'est petit, mieux c'est.
// Puis la hausse de production (en %) qu'apporterait l'achat,
// puis un score combiné brut : hausse % ÷ ratio.
// Couleur : vert = meilleur achat du moment, rouge = le plus cher relativement.
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

  /** Petits nombres lisibles : 12,3 · 0,042 · 2,2×10⁻⁴ */
  const SUP = { '-': '⁻', 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
  function fmtSci(v) {
    if (!isFinite(v) || v <= 0) return '0';
    if (v >= 1000) return fmt(v);
    if (v >= 0.01) return v.toLocaleString('fr-FR', { maximumSignificantDigits: 3 });
    const [m, e] = v.toExponential(1).split('e');
    return `${m.replace('.', ',')}×10${String(parseInt(e, 10)).replace(/./g, (c) => SUP[c])}`;
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
    if (!list || !list.offsetParent) return; // onglet Labo fermé / non visible

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
    //   score = pct ÷ (prix ÷ production)          — valeur brute ; plus grand = mieux
    //           (multiplier prix÷prod par % donnerait prix ÷ prod totale :
    //            le gain du bâtiment s'annulerait et seul le prix compterait)
    for (const r of rows) {
      r.pct = isFinite(r.gain) && r.gain > 0 && base > 0 ? (r.gain / base) * 100 : NaN;
      r.score = isFinite(r.pct) && isFinite(r.ratio) ? r.pct * r.ratio : NaN;
    }
    const maxOf = (k) => Math.max(0, ...rows.map((r) => (isFinite(r[k]) ? r[k] : 0)));
    const best = maxOf('ratio'), bestPct = maxOf('pct'), bestScore = maxOf('score');

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

      // 3) Score combiné, valeur brute : hausse % ÷ (prix ÷ production) (plus grand = meilleur)
      let sText = '—', sCls = 'lte-na', sTitle = 'Indicateurs 1 ou 2 indisponibles';
      if (isFinite(r.score) && bestScore > 0) {
        sCls = tier(Math.log10(bestScore / r.score));
        sText = `${fmtSci(r.score)}${sCls === 'lte-best' ? ' ★' : ''}`;
        sTitle =
          `Score = hausse % ÷ (prix ÷ production) = ${fmtPct(r.pct)} ÷ ${fmt(1 / r.ratio)} = ${fmtSci(r.score)}\n` +
          `(plus c'est grand, mieux c'est : achat à la fois rentable et qui fait monter la prod)`;
      }
      setText(scoreEl, sText, sTitle);
      setTier(scoreEl, sCls);
    }
  }

  function setText(el, text, title) {
    if (el.textContent !== text) el.textContent = text;
    if (el.title !== title) el.title = title;
  }
  function setTier(el, cls) {
    if (!el.classList.contains(cls)) { el.classList.remove('lte-na', ...TIERS); el.classList.add(cls); }
  }

  // Le jeu réécrit la liste à chaque achat (innerHTML) : on réinjecte immédiatement,
  // dans la même frame (les callbacks de MutationObserver passent avant le rendu),
  // pour éviter que les nombres disparaissent puis réapparaissent.
  let scheduled = false;
  const observer = new MutationObserver((mutations) => {
    if (scheduled) return;
    const relevant = mutations.some((m) => {
      const el = m.target.nodeType === 1 ? m.target : m.target.parentElement;
      return el && !el.closest('.lte-side') && (el.id === 'tycBuildings' || el.closest('#tycBuildings'));
    });
    if (!relevant) return;
    scheduled = true;
    queueMicrotask(() => {
      scheduled = false;
      observer.disconnect();
      try { update(); } finally { observe(); }
    });
  });
  const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  observe();

  setInterval(update, 1000); // filet de sécurité
  update();
})();
