# Notes de dev — branche `dev` (farce)

> Doc propre à la branche `dev`. Le devlog de la version normale est sur `main`
> (`docs/NOTES.md`). Cette branche **ne doit pas** être fusionnée telle quelle
> dans `main` sans décision explicite.

## But de la branche

Gags **purement visuels** (une farce) ajoutés par-dessus l'extension d'aide, pour
le jeu **Labo Tycoon** du site SECtor. Destinés à être partagés à **un seul pote**.

Principes, non négociables :
- **Tout est visible et évident** — c'est manifestement un gag, jamais un sabotage caché.
- **Entièrement réversible** : un simple **rechargement de la page** remet tout en place.
- **Aucun effet sur le jeu réel** : ni les vrais prix, ni la production, ni le
  classement partagé ne sont touchés. Rien n'est envoyé au serveur.

La branche part de `main`, donc elle contient **aussi** la vraie extension d'aide
(indicateurs, contours, stats). Les gags sont ajoutés dans des fichiers séparés.

## Fichiers

- `prank.js` — toute la logique des gags (IIFE autonome).
- `prank.css` — styles et animations des gags (préfixe `.prk-`).
- `assets/po.png` — l'image de Pô (128×128) utilisée par le gag du café et la fin.
- `manifest.json` — ajouts par rapport à `main` :
  - `content_scripts[0].js` = `["content.js", "prank.js"]`
  - `content_scripts[0].css` = `["content.css", "prank.css"]`
  - `web_accessible_resources` pour exposer `assets/po.png` à la page du jeu.
  - `version_name: "dev"` (affiché dans la popup ; `version` reste numérique pour Chrome).

## Les gags

### 1. La puce SEC perd ses broches puis s'envole

- **Une broche par clic.** Chaque clic sur `#tycChip` fait tomber une broche : un
  overlay doré (`.prk-pin`) qui chute et tournoie, et la vraie broche SVG est
  masquée (`.tyc-pins rect.prk-gone { fill: transparent }`). Il y a **20** broches.
  Le clic laisse le jeu produire ses bits normalement (pas de `preventDefault`).
- **Envol.** Quand les 20 sont tombées → bannière rouge centrée
  « Double-clic sur la puce avant qu'elle explose », et la puce se détache
  (`position: fixed`, reparentée dans `<body>`) et s'envole **~30 s** façon ballon
  qui se dégonfle : poussées aléatoires, rebonds sur les bords, rotation, elle
  rapetisse lentement. Elle reste **toujours au premier plan**.
- **Désamorçage (double-clic).** Un double-clic sur la puce avant la fin : elle
  s'arrête droite, devient **déplaçable au drag'n'drop**, et les **boutons d'achat
  des machines se mélangent** (ordre aléatoire). Recharger pour tout remettre.
- **Explosion.** Sans désamorçage, au bout de **30 s** : explosion **plein écran**
  et lente (**~2,4 s**, flash radial + 💥 géant, en CSS), puis l'interface du labo
  (`.tyc`) disparaît (rechargement nécessaire).
- **Séquence finale** (apparitions espacées, en fondu) :
  - **~4 s** : « Ton labo a explosé »
  - **~6,5 s** : « cheh » (en rouge, en dessous)
  - **~9 s** : la tête de Pô apparaît en dessous et **tourne lentement** sur elle-même.

### 2. Les boutons d'achat esquivent le curseur

Au survol d'un `.tyc-buy`, il saute à une position aléatoire. Jusqu'à **3 esquives**,
puis il se laisse cliquer ; réinitialisé après ~1,3 s d'inactivité. Délégation sur
`document`, donc ça résiste aux re-render de la liste.

### 3. Le café de Pô

À chaque café bu (clic sur `#tycCoffee` non désactivé) → plein écran
« c'est le café de Pô !!!! » avec `assets/po.png`, affiché **5 s**. Il **ne se
ferme pas au clic** (seulement après les 5 s).

## Décisions & points de doute (résolus)

- **Puce toujours au premier plan.** Elle est reparentée dans `<body>` pendant
  l'envol, sinon elle passait derrière certaines zones (contextes d'empilement des
  parents). **Effet de bord corrigé** : en quittant le sous-arbre thémé, elle
  perdait les variables CSS de couleur du jeu (cœur bleu `--tyc-core`, boîtier
  `--tyc-chip`) et devenait un carré noir. On lit donc les `fill` calculés de
  `.tyc-die` et `.tyc-core` **avant** de la déplacer, et on les fige en inline.
- **Mélange des machines.** Fait via la propriété flex `order` sur les lignes
  `.tyc-b` (le conteneur est forcé en `display:flex;flex-direction:column`). Ça
  survit aux mises à jour de texte de prix du jeu ; ça ne se réinitialise que si le
  jeu **reconstruit** structurellement la liste.
- **Vitesse de la puce** réduite d'environ **9 %** après retex (poussées et vitesse
  max abaissées).
- **Broches pendant l'envol.** Au moment de l'envol les 20 broches sont déjà
  tombées (toutes `.prk-gone`), donc seule la couleur du boîtier et du cœur compte.

## Questions en cours / non faites

- **Explosion = animation CSS/SVG, pas une vidéo.** Pas d'asset vidéo possédé, et on
  ne télécharge pas d'effet sous copyright. **Ouvert** : brancher une vidéo si
  l'utilisateur en fournit une qu'il possède (la déposer dans `assets/` et câbler
  dans `explode()`).
- **Pas encore testé en conditions réelles dans le jeu.** Le drag de la puce et la
  vraie explosion après 30 s n'ont été validés qu'en **banc d'essai local headless**
  (reproduction de la puce, des lignes de machines et du bouton café). À tester à la
  souris dans le vrai jeu.
- **Délais de la séquence finale** (4 / 6,5 / 9 s) : à ajuster selon le ressenti.
- **Distribution** : prévu pour **un seul pote**. Pas de publication sur un store.

## Note éthique

Gag **visible et réversible**, **aucun sabotage caché**, **aucun impact sur le
classement** partagé. C'est le critère qui a été retenu pour accepter de le
construire (une farce qui se dévoile, pas un cheval de Troie déguisé en outil d'aide).

## Comment lancer

1. `git checkout dev`
2. Charger l'extension non empaquetée dans `chrome://extensions` (ou cliquer ↻ si
   déjà chargée), puis recharger la page du jeu.
3. `git checkout main` pour revenir à la version normale.
