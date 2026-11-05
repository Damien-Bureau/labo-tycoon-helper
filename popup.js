// Popup : active / désactive l'extension. L'état est partagé avec content.js via chrome.storage.local.
const toggle = document.getElementById('toggle');
const status = document.getElementById('status');

document.getElementById('version').textContent = `v${chrome.runtime.getManifest().version}`;

function render(enabled) {
  toggle.checked = enabled;
  status.textContent = enabled ? 'Indicateurs et contours affichés' : 'Le jeu est affiché tel quel';
}

chrome.storage.local.get({ enabled: true }, (st) => render(st.enabled));

toggle.addEventListener('change', () => {
  const enabled = toggle.checked;
  render(enabled);
  chrome.storage.local.set({ enabled }); // content.js réagit immédiatement, sans recharger la page
});
