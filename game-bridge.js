// game-bridge.js — s'exécute dans le MONDE PRINCIPAL de la page (world: MAIN), au plus tôt.
// Le jeu reçoit son état via WebSocket (socket.io). Le content script (monde isolé) ne peut ni
// accéder au socket ni lire l'état du jeu, qui est enfermé dans une closure. On enveloppe donc
// WebSocket pour lire les trames entrantes, extraire l'objet « view » (l'état du jeu idle) et
// transmettre les quelques champs utiles au content script via window.postMessage.
// Lecture seule : on n'émet rien, on ne modifie aucune donnée de jeu.
(() => {
  'use strict';
  const Native = window.WebSocket;
  if (!Native) return;

  function handle(data) {
    if (typeof data !== 'string' || data.indexOf('"view"') < 0) return;
    const i = data.indexOf('[');
    if (i < 0) return;
    let arr;
    try { arr = JSON.parse(data.slice(i)); } catch { return; }
    if (!Array.isArray(arr)) return;
    const entry = arr.find((x) => x && typeof x === 'object' && x.view);
    const view = entry && entry.view;
    if (!view) return;
    // On ne transmet qu'un sous-ensemble (pas tout l'état) : compteurs + quelques scalaires.
    const payload = {
      __lteGame: 1,
      stats: view.stats || null,
      produced: view.produced,
      rate: view.rate,
      ectsNext: view.ectsNext,
      ectsGain: view.ectsGain,
    };
    try { window.postMessage(payload, location.origin); } catch {}
  }

  function hook(ws) {
    try { ws.addEventListener('message', (ev) => handle(ev.data)); } catch {}
    return ws;
  }

  // Proxy : intercepte la création du socket tout en gardant le prototype et les statiques natifs.
  window.WebSocket = new Proxy(Native, {
    construct(target, args) {
      return hook(Reflect.construct(target, args));
    },
  });
})();
