// Popup : réglages partagés avec content.js via chrome.storage.local.
//   indicators : afficher les indicateurs (onglet Labo)
//   rings      : afficher les contours des boutons d'achat (Labo + Améliorer)
//   stats      : afficher les stats supplémentaires (hors ligne max, café) dans le panneau de gauche
// content.js réagit immédiatement, sans recharger la page.
const DEFAULTS = { indicators: true, rings: true, stats: true };
const KEYS = Object.keys(DEFAULTS);

const all = document.getElementById('all');
const allHint = document.getElementById('allHint');
const toggles = Object.fromEntries(KEYS.map((k) => [k, document.getElementById(k)]));
let cfg = { ...DEFAULTS };

document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

function render() {
  for (const k of KEYS) toggles[k].checked = cfg[k];
  const on = KEYS.filter((k) => cfg[k]).length;
  all.checked = on === KEYS.length;
  all.indeterminate = on > 0 && on < KEYS.length;
  allHint.textContent = on === KEYS.length ? 'Tout est affiché' : on === 0 ? 'Le jeu est affiché tel quel' : 'Partiellement activé';
}

function save(next) {
  cfg = { ...cfg, ...next };
  render();
  chrome.storage.local.set(next);
}

chrome.storage.local.get(null, (st) => {
  // Ancienne version : un seul interrupteur « enabled »
  if (typeof st.enabled === 'boolean' && st.indicators === undefined && st.rings === undefined) {
    st.indicators = st.rings = st.stats = st.enabled;
  }
  for (const k of KEYS) if (typeof st[k] === 'boolean') cfg[k] = st[k];
  render();
});

// Interrupteur général : si tout est activé → tout désactiver, sinon → tout activer
all.addEventListener('change', () => {
  const allOn = KEYS.every((k) => cfg[k]);
  save(Object.fromEntries(KEYS.map((k) => [k, !allOn])));
});

for (const k of KEYS) {
  toggles[k].addEventListener('change', () => save({ [k]: toggles[k].checked }));
}
