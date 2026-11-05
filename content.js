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
    if (sec < 59.5) return `${Math.round(sec)} s`;
    const totalS = Math.round(sec);                       // arrondi d'abord : jamais « 9 min 60 »
    if (totalS < 3600) { const m = Math.floor(totalS / 60), s = totalS % 60; return s ? `${m} min ${String(s).padStart(2, '0')}` : `${m} min`; }
    const totalM = Math.round(sec / 60);
    if (totalM < 24 * 60) { const h = Math.floor(totalM / 60), m = totalM % 60; return m ? `${h} h ${String(m).padStart(2, '0')}` : `${h} h`; }
    const totalH = Math.round(sec / 3600);
    if (totalH < 365 * 24) { const d = Math.floor(totalH / 24), h = totalH % 24; return h ? `${d} j ${h} h` : `${d} j`; }
    const y = sec / (365 * 86400);
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
    updateExtras();
    const list = document.getElementById('tycBuildings');
    if (!cfg.indicators || !list || document.hidden || !list.offsetParent) { updateRings(); updateEtas(); return; } // indicateurs masqués / Labo non affiché

    const rows = [];
    let base = 0; // production de base = somme des bits/s de chaque bâtiment (hors bonus temporaires)
    for (const row of list.querySelectorAll('.tyc-b[data-b]')) {
      const each = parseNum(row.querySelector('.tyc-each')?.textContent);
      const cost = parseNum(row.querySelector('.tyc-buyc')?.textContent);
      const qty = parseQty(row.querySelector('.tyc-buyl')?.textContent);
      const count = Number((row.querySelector('.tyc-cnt')?.textContent || '').trim()) || 0;
      const total = count ? parseNum(row.querySelector('.tyc-bt .muted.small')?.textContent) : 0;
      if (isFinite(total)) base += total;
      const name = (row.querySelector('.tyc-bt b')?.firstChild?.textContent || '').trim();
      const gain = each * qty; // bits/s ajoutés par cet achat
      const ratio = gain > 0 && cost > 0 ? gain / cost : NaN; // (bits/s) par bit dépensé
      const unit = isFinite(cost) ? (cost * (GROWTH - 1)) / (GROWTH ** qty - 1) : NaN; // prix du prochain bâtiment
      rows.push({ row, name, count, each, cost, qty, gain, ratio, unit });
    }

    // Indicateurs par ligne :
    //   pct   = hausse de production (%)           — plus grand = mieux
    //   score = (prix ÷ production) ÷ pct          — plus petit = mieux
    for (const r of rows) {
      r.pct = isFinite(r.gain) && r.gain > 0 && base > 0 ? (r.gain / base) * 100 : NaN;
      r.score = isFinite(r.pct) && r.pct > 0 && isFinite(r.ratio) ? 1 / r.ratio / r.pct : NaN;
    }
    //   pay   = rentabilisé dans (s) = attente pour réunir le prix + temps pour que l'achat se rembourse
    //           (au rythme actuel, café et événements compris) — plus petit = mieux
    const bits = readBits();
    const rate = parseNum(document.getElementById('tycRate')?.textContent);
    const boost = base > 0 && rate > 0 ? rate / base : 1;
    for (const r of rows) {
      if (!(r.gain > 0 && r.cost > 0 && isFinite(bits))) { r.pay = NaN; continue; }
      const missing = Math.max(0, r.cost - bits);
      const wait = missing === 0 ? 0 : rate > 0 ? missing / rate : Infinity;
      r.pay = wait + r.cost / (r.gain * boost);
    }
    const maxOf = (k) => Math.max(0, ...rows.map((r) => (isFinite(r[k]) ? r[k] : 0)));
    const minOf = (k) => Math.min(...rows.map((r) => (isFinite(r[k]) && r[k] > 0 ? r[k] : Infinity)));
    const best = maxOf('ratio'), bestPct = maxOf('pct');
    const bestScore = minOf('score'), bestPay = minOf('pay');
    const tiers = readTiers();

    // Titres des colonnes, au-dessus de la première ligne
    if (rows[0] && rows[0].row.querySelector(':scope > .lte-head')?.children.length !== 4) {
      list.querySelectorAll('.lte-head').forEach((el) => el.remove());
      const head = document.createElement('span');
      head.className = 'lte-head';
      head.innerHTML = '<span>Prix d’1 bit/s</span><span>Hausse de<br>la prod</span><span>Prix d’1 % de hausse</span><span>Rentabilisé<br>dans</span>';
      rows[0].row.appendChild(head);
    }

    for (const r of rows) {
      let side = r.row.querySelector(':scope > .lte-side');
      if (!side || side.children.length !== 4) {
        side?.remove();
        side = document.createElement('span');
        side.className = 'lte-side';
        side.innerHTML = '<span class="lte-badge"></span><span class="lte-pct"></span><span class="lte-score"></span><span class="lte-pay"></span>';
        r.row.appendChild(side);
        r.row.classList.add('lte-on');
      }
      const [badge, pctEl, scoreEl, payEl] = side.children;

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
      const blue = isFinite(r.pct) && bestPct > 0 ? blueScale(r.pct / bestPct) : '';
      if (pctEl.style.color !== blue) pctEl.style.color = blue;

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

      // 4) Rentabilisé dans : attente + remboursement (plus petit = meilleur)
      let yText = '—', yCls = 'lte-na', yTitle = 'Prix, production ou cagnotte illisible';
      if (isFinite(r.pay) && r.pay > 0 && isFinite(bestPay)) {
        yCls = tier(Math.log10(r.pay / bestPay));
        yText = `${fmtDuration(r.pay)}${yCls === 'lte-best' ? ' ★' : ''}`;
        const wait = Math.max(0, r.pay - r.cost / (r.gain * boost));
        yTitle =
          `Rentabilisé dans ${fmtDuration(r.pay)} = attente ${fmtDuration(wait)} + remboursement ${fmtDuration(r.pay - wait)}\n` +
          `(au rythme actuel de ${fmt(rate)} bits/s, café et événements compris)`;
      }
      setText(payEl, yText, yTitle);
      setTier(payEl, yCls);

      // Machines restantes avant la prochaine amélioration (après le nom)
      updateNextTier(r, tiers, bits, rate);
    }
    fitColumns(list, rows[0]);
    updateRings();
    updateEtas();
  }

  /* ---- Panneau de gauche : durée hors ligne max et café ----
   * Hors ligne : le serveur n'envoie pas le maximum. Base 12 h (message « Pendant ton absence » du jeu)
   * + bonus obtenus : améliorations installées, R&D terminées, composants trouvés (« Production hors ligne : +N h »).
   * Café : le jeu met multiplicateur et durée dans l'info-bulle du bouton café.
   * Réglage « stats » de la popup. */
  const OFFLINE_BASE_H = 12;
  let extrasAt = 0;
  function updateExtras() {
    if (!cfg.stats || document.hidden) return;
    const now = performance.now();
    if (now - extrasAt < 1000) return; // 1 fois par seconde suffit
    extrasAt = now;
    const mini = document.getElementById('tycMini');
    if (!mini) return;
    let box = mini.parentElement.querySelector(':scope > .lte-extra');
    if (!box) {
      box = document.createElement('div');
      box.className = 'tyc-mini lte-extra';
      box.innerHTML =
        '<div title=""><span class="muted small">Hors ligne max</span><b></b><span class="muted small"></span></div>' +
        '<div title=""><span class="muted small">Café</span><b></b><span class="muted small"></span></div>';
      mini.after(box);
    }
    const [off, cof] = box.children;

    // Hors ligne
    const bonus = [];
    const add = (label, text) => {
      const m = /Production hors ligne\s*:\s*\+\s*(\d+(?:[.,]\d+)?)\s*h/i.exec(text || '');
      if (m) bonus.push({ label, h: parseFloat(m[1].replace(',', '.')) });
    };
    for (const el of document.querySelectorAll('#tycUpgrades .tyc-owned [title]')) add(el.title.split(' — ')[0], el.title);
    for (const el of document.querySelectorAll('.tyc-rdn.owned')) add(el.querySelector('b')?.textContent || 'R&D', el.textContent);
    for (const el of document.querySelectorAll('.tyc-a.got')) add(el.querySelector('b')?.textContent || 'Composant', el.title);
    const extra = bonus.reduce((t, b) => t + b.h, 0);
    const hours = OFFLINE_BASE_H + extra;
    const fmtH = (h) => `${String(Math.round(h * 10) / 10).replace('.', ',')} h`;
    // Bits produits pendant ce temps : production de base (sans café ni événement, qui ne durent pas)
    let base = 0;
    for (const row of document.querySelectorAll('#tycBuildings .tyc-b[data-b]')) {
      if (!(row.querySelector('.tyc-cnt')?.textContent || '').trim()) continue;
      const tot = parseNum(row.querySelector('.tyc-bt .muted.small')?.textContent);
      if (isFinite(tot)) base += tot;
    }
    const offBits = base * hours * 3600;
    setText(off.querySelector('b'), fmtH(hours), '');
    setText(off.lastChild, base > 0 ? `≈ ${fmt(offBits)} bits` : `${fmtH(OFFLINE_BASE_H)} + ${fmtH(extra)} de bonus`, '');
    off.title =
      `Production hors ligne maximale (estimée) : ${fmtH(hours)}` +
      (base > 0 ? `\n≈ ${fmt(offBits)} bits à ${fmt(base)} bits/s (production de base, sans café ni événement)` : '') +
      `\n\n• Base : ${fmtH(OFFLINE_BASE_H)}\n` +
      bonus.map((b) => `• ${b.label} : +${fmtH(b.h)}`).join('\n') +
      '\n\nLa base de 12 h vient du message « Pendant ton absence » du jeu ; le serveur ne donne pas le total.';

    // Café
    const t = document.getElementById('tycCoffee')?.title || '';
    const m = /×\s*([\d.,]+)\s*pendant\s*([\d.,]+)\s*min/i.exec(t);
    setText(cof.querySelector('b'), m ? `×${m[1]} · ${m[2].replace('.', ',')} min` : '—', '');
    const next = /prochain café dans ([\d:]+)/i.exec(t);
    setText(cof.lastChild, next ? `prochain dans ${next[1]}` : 'production × durée', '');
    cof.title = t;
  }

  /** Si les colonnes dépassent de l'écran, rétrécit les cartes du Labo juste assez pour les faire tenir. */
  function fitColumns(list, first) {
    const side = first?.row.querySelector(':scope > .lte-side');
    if (!side) return;
    const current = parseFloat(list.style.getPropertyValue('--lte-shrink')) || 0;
    const naturalRight = first.row.getBoundingClientRect().right + current; // bord droit sans rétrécissement
    const need = 12 + side.offsetWidth + 16; // écart + colonnes + marge
    const shrink = Math.max(0, Math.ceil(naturalRight + need - document.documentElement.clientWidth));
    if (Math.abs(shrink - current) >= 1) list.style.setProperty('--lte-shrink', `${shrink}px`);
  }

  /* ---- Prochaine amélioration de machine ----
   * Paliers vérifiés dans le jeu : 1, 5, 25, 50, 100, 150 machines. Au-delà ils varient : on lit les paliers
   * exacts dans les améliorations « Bientôt » (« 🔒 150 Raspberry Pi ») et on les retient (chrome.storage). */
  const BASE_TIERS = [1, 5, 25, 50, 100, 150];
  let learnedTiers = {}; // { "Raspberry Pi": [150, 300], … }
  function readTiers() {
    let changed = false;
    for (const el of document.querySelectorAll('#tycUpgrades .tyc-u.locked .tyc-uc')) {
      const m = el.textContent.replace(/^[^\d]*/, '').match(/^(\d+)\s+(.+?)\s*$/);
      if (!m || m[2].includes('+')) continue; // seulement « N Machine » (pas les combinaisons « A + B »)
      const n = Number(m[1]), name = m[2];
      const list = (learnedTiers[name] ||= []);
      if (!list.includes(n)) { list.push(n); list.sort((x, y) => x - y); changed = true; }
    }
    if (changed) chrome.storage.local.set({ tiers: learnedTiers });
    return learnedTiers;
  }
  function updateNextTier(r, tiers, bits, rate) {
    const nameEl = r.row.querySelector('.tyc-bt b');
    if (!nameEl) return;
    let el = nameEl.querySelector(':scope > .lte-next');
    const learned = (tiers[r.name] || []).filter((n) => n > r.count);
    const guessed = BASE_TIERS.filter((n) => n > r.count);
    const target = Math.min(...learned, ...guessed);
    if (!isFinite(target) || !isFinite(r.unit)) { el?.remove(); return; }
    if (!el) {
      el = document.createElement('span');
      el.className = 'lte-next';
      nameEl.appendChild(el);
    }
    const n = target - r.count;
    const price = (r.unit * (GROWTH ** n - 1)) / (GROWTH - 1);
    // Couleur = temps pour pouvoir payer ces machines : vert = tout de suite … rouge = plus d'une heure
    const missing = isFinite(bits) ? Math.max(0, price - bits) : NaN;
    const wait = missing === 0 ? 0 : rate > 0 ? missing / rate : Infinity;
    const cls = !isFinite(wait) && isNaN(missing) ? 'lte-na'
      : wait === 0 ? 'lte-best' : wait < 60 ? 'lte-good' : wait < 600 ? 'lte-mid' : wait < 3600 ? 'lte-bad' : 'lte-awful';
    setTier(el, cls);
    setText(
      el,
      `(${n} restante${n > 1 ? 's' : ''} · ${fmt(price)})`,
      `Prochaine amélioration à ${target} ${r.name} : encore ${n} à acheter pour ${fmt(price)} bits\n` +
        (wait === 0 ? 'Payable tout de suite' : `Payable dans ${fmtDuration(wait)} au rythme actuel`) +
        (learned.includes(target) ? '' : '\n(palier habituel du jeu, non encore confirmé pour cette machine)')
    );
  }

  /** Échelle de bleu pour la hausse de prod : rel = hausse ÷ meilleure hausse (log, sur 4 ordres de grandeur). */
  function blueScale(rel) {
    const t = Math.max(0, Math.min(1, 1 + Math.log10(Math.max(rel, 1e-9)) / 4)); // 1 = la plus forte hausse
    const light = [150, 160, 220], dark = [30, 42, 150];
    const c = light.map((v, i) => Math.round(v + (dark[i] - v) * t));
    return `rgb(${c[0]}, ${c[1]}, ${c[2]})`;
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
    const prev = parseFloat(prog.getAttribute('stroke-dasharray'));
    if (!intro && isFinite(prev) && p * 100 < prev - 0.05) {
      // Le contour recule (unité suivante en mode Max, achat, prix qui monte) : il s'efface d'un coup,
      // sans animation à rebours. On coupe la transition, on applique, puis on la rétablit.
      svg.classList.add('lte-ring-snap');
      prog.setAttribute('stroke-dasharray', dash);
      getComputedStyle(prog).strokeDasharray;
      svg.classList.remove('lte-ring-snap');
      return;
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

  /* ---- Décompte avant de pouvoir acheter (onglet Labo) ----
   * À gauche du bouton des machines pas encore achetables : (prix − cagnotte) ÷ production actuelle,
   * mis à jour à chaque tick. Réglage « eta » de la popup. */
  function fmtClock(sec) {
    const s = Math.ceil(sec);
    if (s < 60) return `${s} s`;
    const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60;
    if (h >= 24) return fmtDuration(sec);
    const mm = String(m).padStart(2, '0'), rr = String(r).padStart(2, '0');
    return h ? `${h}:${mm}:${rr}` : `${m}:${rr}`;
  }
  function updateEtas() {
    if (!cfg.eta || document.hidden) return;
    const list = document.getElementById('tycBuildings');
    if (!list || !list.offsetParent) return;
    const bits = readBits();
    const rate = parseNum(document.getElementById('tycRate')?.textContent);
    for (const row of list.querySelectorAll('.tyc-b[data-b]')) {
      const btn = row.querySelector('.tyc-buy');
      if (!btn) continue;
      let el = btn.querySelector(':scope > .lte-eta');
      const cost = parseNum(row.querySelector('.tyc-buyc')?.textContent);
      const missing = cost - bits;
      if (btn.classList.contains('ok') || !(missing > 0) || !(rate > 0)) { if (el) el.hidden = true; continue; }
      if (!el) {
        el = document.createElement('span');
        el.className = 'lte-eta';
        // même fond que la carte (thème clair ou sombre) : masque proprement une description longue
        el.style.background = getComputedStyle(row).backgroundColor;
        btn.appendChild(el);
        btn.classList.add('lte-eta-on');
      }
      el.hidden = false;
      const eta = missing / rate;
      setText(el, `⏳ ${fmtClock(eta)}`, `Achetable dans ${fmtDuration(eta)} au rythme actuel (${fmt(rate)} bits/s)`);
    }
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
      if (!el || el.closest('.lte-side, .lte-ring, .lte-head, .lte-next')) continue;
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
      try { if (full) update(); else { updateRings(); updateEtas(); } } finally { if (running) observe(); }
    });
  });
  const observe = () => observer.observe(document.body, { childList: true, subtree: true, characterData: true });

  /* ------------------------- Réglages (popup) ------------------------- */
  // chrome.storage.local : { indicators, rings, stats, eta } (booléens, true par défaut).
  const DEFAULTS = { indicators: true, rings: true, stats: true, eta: true };
  let cfg = { indicators: false, rings: false };
  let running = false, timer = null;

  const removeIndicators = () => {
    document.querySelectorAll('.lte-side, .lte-head, .lte-next').forEach((el) => el.remove());
    document.getElementById('tycBuildings')?.style.removeProperty('--lte-shrink');
    document.querySelectorAll('.lte-on').forEach((el) => el.classList.remove('lte-on'));
  };
  const removeEtas = () => {
    document.querySelectorAll('.lte-eta').forEach((el) => el.remove());
    document.querySelectorAll('.lte-eta-on').forEach((el) => el.classList.remove('lte-eta-on'));
  };
  const removeStats = () => {
    document.querySelectorAll('.lte-extra').forEach((el) => el.remove());
    extrasAt = 0;
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
    if (!cfg.stats) removeStats();
    if (!cfg.eta) removeEtas();
    const active = cfg.indicators || cfg.rings || cfg.stats || cfg.eta;
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
      st.indicators = st.rings = st.stats = st.eta = st.enabled;
      chrome.storage.local.set({ indicators: st.enabled, rings: st.enabled, stats: st.enabled, eta: st.enabled });
      chrome.storage.local.remove('enabled');
    }
    learnedTiers = st.tiers || {};
    applyConfig({ ...DEFAULTS, ...st });
  });
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local') return;
    const next = {};
    for (const k of Object.keys(DEFAULTS)) if (changes[k]) next[k] = changes[k].newValue ?? DEFAULTS[k];
    if (Object.keys(next).length) applyConfig(next);
  });
})();
