# Labo Tycoon Helper — notes de dev (`main`)

Extension navigateur (Manifest V3) qui ajoute des aides au jeu **Labo Tycoon** du
site **SECtor** (`https://sector-production-b749.up.railway.app/`). Un `content_script`
s'injecte sur la page du jeu, **lit seulement ce que le jeu affiche** dans le DOM et
superpose ses propres éléments. Rien n'est envoyé au serveur ; aucune API interne du
jeu n'est appelée (le content script est dans un monde isolé et n'a pas accès aux
variables de la page).

## Fichiers

- `manifest.json` — MV3. Deux `content_scripts` : `game-bridge.js` (monde **MAIN**,
  `document_start`) puis `content.js` + `content.css` (monde isolé) sur l'URL du jeu.
  Permission `storage`. Icône microscope 🔬 (`icons/`). `version` doit rester
  **numérique** (Chrome refuse « 1.x-beta ») ; les libellés vont dans `version_name`
  (utilisé sur les branches `dev` / `feature/*`, pas sur `main`).
- `game-bridge.js` — petit pont dans le **monde principal** de la page. Enveloppe
  `WebSocket` (Proxy sur le constructeur) pour lire les trames entrantes du jeu,
  extraire l'état `view` et transmettre quelques champs (`stats`, `bits`, `rate`…) au
  content script via `postMessage`. **Lecture seule**, n'émet rien. Nécessaire car
  l'état `view` est enfermé dans une closure, inaccessible au content script isolé.
- `content.js` — toute la logique (IIFE). Sections : parsing/format, `update()` +
  sous-updaters (`updateRings`, `updateEtas`, `updateExtras`, `updateBuy`,
  `updateSablier`), achat rapide, réglages/popup, raccourci
  double-Ctrl. (`game-bridge.js` n'est plus utilisé par `content.js` depuis le retrait du compteur de missions.)
- `content.css` — styles, préfixe `.lte-`.
- `popup.html` / `popup.css` / `popup.js` — la popup de réglages.

## Faits du jeu découverts (importants pour la maintenance)

- **Croissance des prix : ×1,15 par machine** (constante `GROWTH`). **Mesurée**, pas
  supposée, en comparant les prix affichés en ×1 et ×10 sur plusieurs bâtiments.
  C'est la clé de plusieurs calculs (prix de l'unité suivante, prix d'un lot, achats
  rapides).
- **Le compteur de bits est arrondi** (« 3,1 Md »). On estime la vraie valeur
  (`readBits`) en l'interpolant au rythme courant et en la recalant à chaque
  changement du chiffre affiché.
- **Les clics automatiques ne sont pas comptés** dans les bits/s affichés par le jeu.
  On les lit sous la puce (`#tycClickVal`) et on les ajoute (`incomeRate`) partout où
  compte la vitesse de la cagnotte (ETA, « machines restantes », contours).
- **Paliers d'amélioration** : 1, 5, 25, 50, 100, 150 machines, puis ça **varie**
  au-delà de 150 (ex. 150 → 300). On lit les paliers exacts dans la section
  « Bientôt » (« 🔒 150 Raspberry Pi ») et on les **retient** (`chrome.storage`,
  clé `tiers`). `BASE_TIERS` sert de valeurs par défaut.
- **Plafond hors ligne** : base **12 h** (phrase en dur « seules les 12 premières
  heures comptent » du message « Pendant ton absence »). On y **ajoute** les bonus
  obtenus (améliorations, R&D, composants « Production hors ligne : +N h »).
- **Ancres DOM** : `#tycBits`, `#tycRate`, `#tycClickVal`, `#tycBuildings`,
  `.tyc-b[data-b]` (→ `.tyc-cnt`, `.tyc-each`, `.tyc-bt b`, `.tyc-buy` →
  `.tyc-buyc`/`.tyc-buyl`), `#tycBuyN [data-tyc-n]`, `#tycCoffee`,
  `#tycUpgrades .tyc-u[data-cost]`, `#tycChip` + `.tyc-pins`.
  Onglets : `[data-tyc-tab]` (`labo`, `upg`, `quest`, `dip`…).
- **Améliorations (onglet Améliorer, `[data-tyc-tab="upg"]`)** : cartes
  `button.tyc-u`. Classes : `ready` = débloquée (section « Disponibles »), `ok` =
  payable tout de suite, `locked` = bloquée par un **nombre de machines** (section
  « Bientôt », pas de temps). `data-cost` = coût **exact** en bits. Une carte
  « Disponibles » peut n'avoir **aucun** `data-cost` (ex. « Subvention ») → ignorée.
- **Compteur de missions caché** : le nombre de missions réussies **n'est nulle part
  dans le DOM** (ni l'onglet Missions, ni les cartes de succès). Il vit dans l'état
  `view` envoyé par **WebSocket** (socket.io) : `view.stats.missions`. Trame typique
  `4330[{…,"view":{…}}]` (préfixe engine.io/socket.io puis tableau JSON). On la lit via
  `game-bridge.js`. Succès visé : carte `.tyc-a` titre « Réussir 100 missions »
  (« Major de promo »), `.got` quand obtenu.

## Fonctionnalités (état actuel)

Chaque réglage est masquable dans la popup ; « Tout activer » et un **double-appui
sur Ctrl** basculent tout. Réglages dans `chrome.storage.local`, appliqués **en
direct** (sans recharger).

1. **Indicateurs (3 colonnes à droite des prix)** — réglage `indicators` :
   - **Prix d'1 bit/s** = prix ÷ production. C'est aussi le temps de remboursement en
     secondes. Échelle de couleurs (vert = meilleur) + ★.
   - **Hausse de la prod** = production ajoutée ÷ production totale, en %. Échelle de
     **bleu** (clair → foncé) + ★ sur la plus forte.
   - **Prix d'1 % de hausse** = prix d'1 bit/s ÷ hausse %. Échelle de couleurs + ★.
   - Titres de colonnes centrés ; valeurs centrées sous les titres ; les cartes se
     rétrécissent si les colonnes dépassent de l'écran.
2. **Machines restantes avant le prochain palier** — « (N restantes · prix) » après
   le nom, coloré selon le **temps pour pouvoir les payer**.
3. **Contours des boutons d'achat** (Labo + Améliorer) — réglage `rings` : se
   remplissent selon cagnotte ÷ prix, partent du milieu en haut, disparaissent quand
   c'est achetable, s'effacent d'un coup quand ça recule, animation de remplissage à
   l'ouverture d'un onglet. En mode **Max**, le contour montre la progression vers
   l'unité suivante.
4. **Stats du panneau de gauche** — réglage `stats` : « Hors ligne max » (12 h +
   bonus, ≈ bits produits) et « Café » (×mult · durée, prochain dans…). Les bits/s
   des **clics auto** sont affichés à côté des bits/s du jeu.
5. **Décompte avant achat (machines)** — réglage `eta` : « ⏳ m:ss » à gauche du
   bouton des machines pas encore achetables (onglet Labo).
6. **Achat rapide** — réglage `buy` : bouton **→ palier** dans la barre de quantité
   (achète jusqu'au prochain palier de la machine cliquée). Mode global comme
   ×1/×10/Max. En DOM pur : on force ×1 et on clique le vrai bouton d'achat N fois,
   puis on restaure le mode. *(Le bouton ×11 a existé puis a été retiré — voir plus
   bas.)*
7. **Sablier des améliorations** — réglage `sablier` : pastille « ⏳ h:mm:ss » en haut
   à droite de chaque amélioration **disponible** mais pas encore payable (onglet
   Améliorer). Temps = (coût `data-cost` − bits) ÷ rythme, comme l'ETA des machines.
   Les cartes payables (`ok`) et bloquées (`locked`, par nombre de machines) n'en ont
   pas.

## Points de doute / questionnements — **résolus**

- **Choisir un achat.** La 1ʳᵉ colonne seule classe en tête des achats « rentables »
  mais inutiles (un Arduino ne coûte rien mais n'ajoute presque rien). La 2ᵉ montre
  l'impact, la 3ᵉ combine les deux → c'est **la 3ᵉ** qui donne la meilleure décision.
  **Attention** : sa valeur dépend du lot sélectionné (×1/×10/Max) — comparer les
  machines **dans le même mode**.
- **Colonne « Rentabilisé dans »** (attente + remboursement) : ajoutée puis
  **retirée** car elle faisait doublon avec « Prix d'1 bit/s » pour tout ce qui est
  achetable.
- **Hausse en bleu, pas rouge/vert** : le rouge/vert veut dire « bon/mauvais achat »
  ailleurs ; une grosse hausse n'est pas forcément un bon achat → on évite la
  contradiction de couleurs.
- **Optimum ≈ 11 machines** : exploré sur la branche `feature/graphe-prix-1pct` (un
  graphe dans l'info-bulle de la 3ᵉ colonne). Le creux est **toujours ~11**, quelle
  que soit la machine : c'est une propriété mathématique de la croissance ×1,15 et de
  la formule de la 3ᵉ colonne, pas du jeu. Avait motivé un bouton **×11**, finalement
  **retiré** (demande de l'auteur) ; seul **→ palier** reste.
- **Trouver le compteur de missions.** Introuvable dans le DOM (onglet Missions, cartes
  de succès, globals de page, REST). **Résolu** en interceptant la **WebSocket** du
  jeu : on patche le constructeur `WebSocket` (Proxy) au plus tôt (`document_start`,
  monde MAIN) et on écoute `message`. L'état `view` y arrive en entier (`view.stats` =
  `{missions, clicks, coffees, bought, …}`). Parser validé en live : `missions` = 83.
  Le patch de `WebSocket.prototype.send` (pour attraper l'instance) marche aussi mais
  **rate le socket déjà ouvert** si injecté trop tard — d'où le `document_start`.
- **Achat de N** : le jeu n'expose pas d'API ; seul `S.buyN` (1/10/Max) pilote la
  quantité. On force ×1 et on clique N fois le vrai bouton (vérifié en live :
  interception d'un clic en phase capture + `stopImmediatePropagation`, puis clics
  programmés non interceptés via une garde `buying`).
- **Signatures Git** : commits signés → **Verified** sur GitHub ; l'auteur reste
  Claude via `Co-Authored-By`.

## Questions en cours / non faites

- **Production hors ligne = estimation.** Base 12 h issue d'un texte d'UI ; on suppose
  un plein régime hors ligne, **non confirmé serveur**. À vérifier via la popup
  « Pendant ton absence » au retour.
- **Achats rapides** : on envoie jusqu'à N achats même si la cagnotte ne suffit pas
  (le serveur rejette les excédentaires). On pourrait **plafonner** au nombre
  réellement payable.
- **Mobile** : Chrome Android ne supporte pas les extensions. Portage possible en
  **userscript** (Tampermonkey / Userscripts iOS) mais il faudrait **revoir la mise
  en page** (les indicateurs vivent dans la marge droite, absente sur petit écran).
- **Publication store** : possible — Chrome Web Store (5 $ une fois, visibilité
  « non répertoriée »), Firefox (gratuit, signé). **Prévenir l'auteur du jeu** (une
  maj du site casse l'extension). C'est une **aide, pas de la triche** (lecture de ce
  qui est affiché, aucun impact caché).

## Branches

- `main` — version stable décrite ici.
- `feature/graphe-prix-1pct` — graphe dans l'info-bulle « Prix d'1 % » (illustre
  surtout l'optimum ≈ 11, un artefact de formule). **Non fusionnée.**
- `dev` — farce visuelle à usage privé ; voir `docs/NOTES-dev.md` **sur `dev`**.
  **Pas destinée à être fusionnée** dans `main`.

## Installer (dev)

`chrome://extensions` → activer le mode développeur → « Charger l'extension non
empaquetée » → choisir le dossier. Recharger (↻) après un `git pull`, puis recharger
la page du jeu. Firefox : l'extension doit être signée par addons.mozilla.org.
