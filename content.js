// Labo Tycoon — Rentabilité
// Ajoute à droite de chaque prix (onglet Labo) le temps de rentabilisation :
//   prix ÷ (bits/s gagnés)  — c'est l'inverse du ratio bits/s ÷ prix, plus lisible.
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

  function fmtSci(x) {
    if (!isFinite(x) || x <= 0) return '0';
    return x.toExponential(2).replace('.', ',').replace('e', ' × 10^').replace('^+', '^');
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
    for (const row of list.querySelectorAll('.tyc-b[data-b]')) {
      const each = parseNum(row.querySelector('.tyc-each')?.textContent);
      const cost = parseNum(row.querySelector('.tyc-buyc')?.textContent);
      const qty = parseQty(row.querySelector('.tyc-buyl')?.textContent);
      const gain = each * qty; // bits/s ajoutés par cet achat
      const ratio = gain > 0 && cost > 0 ? gain / cost : NaN; // (bits/s) par bit dépensé
      rows.push({ row, each, cost, qty, gain, ratio });
    }

    const best = Math.max(...rows.map((r) => (isFinite(r.ratio) ? r.ratio : 0)));

    for (const r of rows) {
      let badge = r.row.querySelector(':scope > .lte-badge');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'lte-badge';
        badge.innerHTML = '<b class="lte-time"></b><span class="lte-sub"></span>';
        r.row.appendChild(badge);
        r.row.classList.add('lte-on');
      }

      let time = '—', sub = '', cls = 'lte-na', title = 'Impossible de lire le prix ou la production';
      if (isFinite(r.ratio) && best > 0) {
        const payback = 1 / r.ratio; // secondes pour rembourser l'achat
        const gap = Math.log10(best / r.ratio);
        const rel = (r.ratio / best) * 100;
        time = fmtDuration(payback);
        sub = gap < 0.05 ? '★ meilleur'
          : rel < 0.01 ? '< 0,01 % du top'
          : `${rel >= 1 ? Math.round(rel) : rel.toFixed(rel >= 0.1 ? 1 : 2).replace('.', ',')} % du top`;
        cls = tier(gap);
        title =
          `Rentabilisé en ${fmtDuration(payback)}\n` +
          `Gain : +${fmtSci(r.gain)} bits/s (${r.qty} × ${fmtSci(r.each)})\n` +
          `Prix : ${fmtSci(r.cost)} bits\n` +
          `Ratio bits/s ÷ prix : ${fmtSci(r.ratio)}`;
      }

      const t = badge.firstChild, s = badge.lastChild;
      if (t.textContent !== time) t.textContent = time;
      if (s.textContent !== sub) s.textContent = sub;
      if (!badge.classList.contains(cls)) { badge.classList.remove('lte-na', ...TIERS); badge.classList.add(cls); }
      if (badge.title !== title) badge.title = title;
    }
  }

  setInterval(update, 400);
  update();
})();
