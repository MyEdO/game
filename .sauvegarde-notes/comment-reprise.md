## Pilotage du lot Combat, 2026-09-28 : travail non publié PERDU, reprise par reconstruction

### Constat (sondes)
Le pilote précédent s'est arrêté après la publication `c160fc3c3`. Son travail en cours, jamais poussé, n'existe plus nulle part :
- `git cat-file -t` sur les SHA cités dans ce ticket : 26 commits absents d'`origin` (dont `e979d92f0` infobulle R-M2, `03ddd90ce` console F8, `04ca29641`/`9e211b4af` portes git) ; l'API GitHub rend « No commit found for SHA » pour `e979d92f0`, `03ddd90ce`, `04ca29641`.
- `git ls-remote origin 'refs/wip/*'` : vide ; aucune branche `wt/*` sur `origin`.
- HUD en grille #1919 (G2-G5) : absent de `main` (`git grep -n "grid-template-areas\|\[flot\]\|\[pont\]\|subgrid" origin/main -- src/ui/styles/hud.css` : 0 ligne ; aucune `data-zone` côté HUD ; la phrase « La couche HUD… » absente de `docs/charte-ui.md`). La mention « lot B (modales #1920, HUD #1919) » du pilotage précédent ne vaut que pour #1920.
- La session du pilote (fil de projet claude.ai) n'est plus joignable (quota).

### Ce qui est perdu / ce qui reste
- Perdu : le CODE de l'infobulle R-M2 (A2-A7), du HUD en grille (G2-G5) et de la console (F5-F9).
- Intact dans les commentaires : le design v4 R-M2 (signé), le design « le pont se dimensionne seul » (#1919), la décision d'écran de la console Q1-Q4 (tranchée par l'état de l'art), et tous les verdicts.

### Séquence
1. Infobulle R-M2 lot A, reconstruit en une fois avec X1/X2/I1 intégrés (brief ci-dessous) → juge de diff → recette → **publication immédiate**.
2. HUD en grille #1919 (design « pont seul » + défauts G4 ; budget 561-700 = décision d'écran Q4.3 de ce ticket).
3. Console (décision Q1-Q4), puis planche.
En parallèle : retouches 1 à 5 de `gitPorte.mjs` (pilotage précédent).

Délégation utilisateur, 2026-09-28, verbatim : « Franchement ce n'est pas mon truc les interfaces, je te laisse decider » ; puis « Je compte sur toi ». Les choix d'écran de cette reprise sont donc des évaluations d'ingénierie révisables, sans cérémonie.

Règle de cette reprise : **tout lot vert est publié avant le suivant**. Plus aucun travail ne vit seulement dans un conteneur.

---

# Brief du codeur : R-M2 lot A reconstruit, la couche d'infobulle (#1806), 2026-09-28

Reprise après perte : le travail des lots A à A7 (instantané `e979d92f0`, worktree `wt/rm2a`) n'a jamais été poussé et n'existe plus (sonde : `git cat-file -t e979d92f0` → `fatal: Not a valid object name` ; l'API GitHub rend « No commit found for SHA: e979d92f0 »). Le DESIGN et TOUS les verdicts, eux, sont intacts dans les commentaires du ticket. Ce lot recode la couche en une fois, avec les corrections des juges A2 à A7 ET les trois bloquants restés ouverts (X1, X2, I1) intégrés dès le départ : on ne rejoue pas l'historique, on livre la cible.

Tu es orchestrateur de ton lot : tu peux déléguer une lecture de masse (`lecteur`) ou une vérification fermée (`verif-mecanique`), mais tu relis ce qu'un agent te rend, et le code est à toi.

## Worktree et interdits
- Arbre : `/home/user/game`, branche `chantier/1806`, HEAD `c160fc3c3` (= `origin/main`). Aucune autre session ne travaille sur cette machine. Ton travail est exactement `git diff` + fichiers neufs non suivis.
- Interdits : tout `git checkout/restore/reset/stash/add/commit/apply/write-tree/init`, toute suppression récursive, toute écriture dans `node_modules` (`npm install` compris). Je committe moi-même.
- Processus : un serveur de dev et un Chromium sans tête sont permis pour vérifier (Playwright est configuré, `PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers` ; jamais `playwright install`). Tout ce que tu lances est BORNÉ (`timeout`) et arrêté par PID avant ton rendu ; ton rendu liste chaque processus lancé et sa fin. Machine : 4 cœurs.
- Budget : **2 h 30 d'horloge**. Relève `date -u` au départ. Travaille dans l'ordre ; à l'échéance, rends ce qui est fait, le reste NOMMÉ point par point.

## Sources (lis-les AVANT de coder ; ce sont les commentaires du ticket, recopiés verbatim)
Dossier `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/comments/` :
- `29_…` : **Design v4 signé** (« Design : aucun mot tranché (R-M2), v4 du 2026-09-24 ») — P2 (la couche) est ton périmètre ; P1 (`Clamp`) et P3 sont le lot B, HORS de ce lot.
- `33_…` verdict A2, `34_…` verdict A3, `38_…` verdict A4, `42_…` brief A6, `45_…` brief A7, `47_…` **verdict A6+A7 (X1, X2, I1, F13, Q4i, Q5r)**. Chaque défaut qui y est LEVÉ décrit un comportement que ta couche doit avoir d'emblée ; chaque défaut OUVERT est à corriger ici.

## Invariant
- Spec HUD validée, `docs/plans/2026-08-16-spec-hud-combat.md:71-74`, verbatim : « **R-M2 Aucun mot tranché, nulle part** : un libellé se rend en entier, ou s'ellipse à la FRONTIÈRE DE MOT (une ligne + `title`), ou coupe entre mots (2 lignes max) — jamais `overflow-wrap:anywhere` sur du texte de libellé. […] ». Question à laquelle elle répond : comment un texte qui ne tient pas se rend-il, et comment lit-on son texte entier ? Ce lot pose la MOITIÉ « texte entier » : UNE couche d'infobulle, une par ancrage.
- Charte, `docs/charte-ui.md` (vérifie la ligne, ~`:646`), verbatim : « une seule infobulle par ancrage, jamais une 2ᵉ boîte concurrente ».
- Arbitrage de Clément (2026-08-24), fiche `.claude/memory/user-arbitrage-raison-de-refus-au-survol-jamais-inline.md`, verbatim : « Je n'ai jamais validé ces "textes" impossible a lire sous le nom des capacités, même Rogue Trader qui est notre interface de départ n'a pas un tel comportement. » ; commit `fc8d809a5`, verbatim : « la raison d'un refus vit au SURVOL (et s'ATTEINT au clavier, à la manette, au doigt) ».
- WAI-ARIA APG, Dialog (Modal) Pattern, verbatim (déjà cité par `src/ui/focus.ts`) : « When a dialog closes, focus returns to the element that invoked the dialog ». APG Tooltip Pattern, verbatim : « Escape: Dismisses the Tooltip ».
- Consigne de Clément (2026-09-20, #1806), verbatim : « L'application c'est un dépot de stock decroissant. Surtout que c'est toi qui a mis ces !important il y a quelques jours ». Conséquence : aucun registre neuf, aucune liste d'exceptions, aucun `!important` neuf.
- Credo, verbatim : « Règles GÉNÉRALES, jamais spécifiques. Corriger la classe entière du problème, pas le cas rencontré. »

## Cas canonique déjà couvert
- **L'emprunt de focus** : `useFocusEmprunte` (`src/ui/focus.ts`, sur `main` depuis le lot B `ce0880e57`) est la SEULE couture « le focus entre dans une surface, puis revient à qui l'avait ». Dialogues : `src/ui/Modal.tsx:103`. La bulle épinglée de `CodexRef` l'appelle déjà (`src/ui/compendium/CodexRef.tsx`, `useFocusEmprunte(popRef, pinned && wrap, porteDeLaBulle)`).
- Preuve d'instance à rendre (ou sa réfutation citée) : l'infobulle en est une INSTANCE dont l'INVOCATEUR est son ANCRAGE (verdict `47_…`, X1 : « l'origine d'une surface est son INVOCATEUR. Dialogue : `activeElement` à l'ouverture […]. Infobulle : son ANCRAGE »). La forme retenue par le juge : `useFocusEmprunte` reçoit l'origine en PARAMÈTRE (défaut : `activeElement` à l'ouverture), et l'emprunt de l'infobulle est actif tant que le focus est DANS la boîte (épinglée ou `focusin`), pas seulement épinglée. AUCUN second mécanisme de retour de focus (c'était I1).

## Design jugé :
- Design v4 (`29_…`), signé après trois passes de juge de design (v1/v2/v3 À AMENDER, v4 applique les neuf amendements de v3).
- Verdicts de diff A2 (`33_…`), A3 (`34_…`), A4 (`38_…`), A6+A7 (`47_…`) : leurs formes retenues (P10 `SURFACE` sur le patron `CONTENEUR_ROVING` ; `BoiteAncree` + `usePlacementAncre` ; placement né au commit d'ouverture ; table `VARIABLES satisfies Record<keyof PlacementAncre, …>` ; ancrage détaché → aucune boîte ; état `congediee` ; origine = ancrage) sont la cible.

## Travail, dans cet ordre
1. **Grounding (≤ 20 min)**, sorties collées : `git grep -n` des consommateurs de `CodexRef` et de ses booléens (`suppressPopover`, `wrap`, refus) ; `CodexRef.tsx` en entier ; `focus.ts`, `Modal.tsx` ; ce qui sur `main` porte déjà une partie du lot (ex. la frontière `Suspense` propre de la surcouche du Codex dans `App.tsx`, D7 du verdict A2 : présente ou non ?). Dis ce qui est déjà là ; ne le refais pas.
2. **La couche `Infobulle`** (`src/ui/Infobulle.tsx` + sa feuille de primitive), extraite de `CodexRef` à comportement CONSTANT (design v4, P2) : position, pont de survol, épinglage, sourdine, Échap, clic hors boîte, `aria-describedby`, portail, toucher, ↓. Restent au contenu : la fiche, le refus, `CodexTitre`, la porte « Ouvrir la fiche », le rôle, l'activation, le nom accessible. La couche ne connaît que des booléens dérivés du contenu (atteignable, épinglable, sourdine, au toucher — verdict A2 : `auToucher` confirmé nécessaire), aucune branche par consommateur. Ancrage déclaré au balisage ; délégation au document ; marqueur d'arrêt à la racine de la boîte. Les termes : `sourdine`, `bascule`, `--ancre-*` ; « popover » ne désigne plus la boîte de la couche (R2).
   - **X2 d'emblée** : un état `congediee`, posé par l'Échap/`unpin`, qui fait ignorer le survol/focus de l'ancrage jusqu'à son prochain `quitte`. Jamais un invariant tenu par l'ordre des effets passifs.
   - **X1 d'emblée** : origine = ancrage (son contrôle focalisable : lui-même s'il l'est, sinon son 1ᵉʳ descendant), via le paramètre d'origine de `useFocusEmprunte`.
3. **`BoiteAncree` + `usePlacementAncre`** (`src/ui/BoiteAncree.tsx`) : UNE mesure/placement d'ancrage pour la couche, `src/ui/editor/AddMenu.tsx` (`placeMenu` meurt) et `src/ui/PanneauParametre.tsx` (F4, R4). Placement né AU COMMIT d'ouverture (B2 du verdict A4 : sinon ↓ épingle une boîte qui n'existe pas encore et le focus n'y entre pas). Table unique `VARIABLES … satisfies Record<keyof PlacementAncre, …>` d'où dérivent style et égalité (F10). Ancrage détaché du document → aucune boîte (F11). Pas de warning `useLayoutEffect does nothing on the server` sous `renderToStaticMarkup` (E2 : corrige au bon étage, sans filtre de console). En-tête qui dit ce que fait le code (F9).
4. **Propriété des touches** (`src/ui/useGameKeyboard.ts`) : `SURFACE = '[role="dialog"],[role="tooltip"]'`, sur le patron `CONTENEUR_ROVING` (P10) ; commentaire juste pour un dialogue (F2).
5. **Un terme pour l'élection d'un raccourci** (`src/state/keybindings.ts`, F3 + F12) : mesure d'abord (`git grep -c` des termes en concurrence, sortie collée), puis UNE élection exportée consommée par `src/state/resoudreEchap.ts` et les tests qui la recopient (`push-keyboard-commit.test.ts`, `wrap-keyboard-vs-cursor.test.tsx`, `keybindings.test.ts`, `echap-desarme-mode-arme.test.tsx`, `raccourcis-modificateurs.test.tsx` — vérifie les chemins). Garde d'unicité des ids du registre. N'exporte rien qui n'a pas d'appelant de production (Q5r).
6. **Tests promus depuis les sondes des juges** (cas décrits en toutes lettres dans `47_…`, Q2/Q3 et « Sondes ») : X1 (après fiche, focus = ancrage, pour les entrées depuis l'ancrage, depuis un autre contrôle, depuis `body`) ; X2 (`refocusApres` → 0 boîte) ; Q2DIAL (dialogue A fermé sous B : focus reste dans B ; B fermé : focus au déclencheur de A, pas `body`) ; Q2BULLE. Plus `CodexRef.hooks.test.tsx` « Échap ne rouvre pas » et « ↓ épingle ET focus entre » (B2). Test d'`App` sans `vi.doMock`/`resetModules` (B1, garde `src/vi-mock-isolate-guard.test.ts`), qui échoue sur une assertion nommée et pas par délai (F1).
7. **Charte et catalogue** : `docs/charte-ui.md` (catalogue des modules de primitive, R1, garde `scripts/docs/check-doc-refs.mjs`) ; `docs/primitives.md` si la primitive y a sa place (vérifie ce que le fichier exige). Spécimen de galerie (`src/ui/gallery/registry.tsx`) sans emprunter de classe de contenu de `CodexRef` (R3).

Dans chaque zone touchée : un concept, un terme ; morts purgés ; commentaires à réf nue (règle 6, garde `src/comment-poison-guard.test.ts`) ; aucun élément nu (charte, `docs/primitives.md`).

## Questions à rendre en SORTIE (citation ou sortie de commande exigée)
- F13 (`47_…`, Q7) : une infobulle visible AVEC la fiche, le 1ᵉʳ Échap la fermant, 2 cycles sur 9 au navigateur. Reproduis-le sur ta couche (pointeur laissé dans l'aire de la boîte après un clic sur « Ouvrir la fiche »), puis pointeur hors écran. Tient ou pas, avec la sortie.
- Q4i : pour les panneaux ancrés de `CombatConsole.tsx` (dispersion, recharge… vérifie les lignes), `--ancre-left/top` au 1ᵉʳ rendu contre après placement. Écart ou pas.

## Preuves (obligatoires)
- Preuve par mutation pour chaque test neuf ou réécrit : fichier muté, `git hash-object` avant/après, rouge constaté sur l'assertion nommée, remise identique, sortie verte en fichier. Mutations jouées sur le blob FINAL.
- Navigateur, en joueur (clavier et souris réels ; `__wfrp` seulement pour poser la situation), console à 0 erreur, 3 passes : en combat, focus sur une case, ↓ (le focus entre dans la boîte), Entrée ouvre la fiche, Échap la ferme et le focus revient à la case ; puis le même cycle ENTRÉ À LA SOURIS (clic sur « Ouvrir la fiche ») : après la fiche, le focus revient à la case (X1). `document.activeElement` collé après chaque geste. Skill de référence : `docs/recette-navigateur.md`.

## Portes (sortie BRUTE collée, code de sortie capturé sans pipe)
- `npm run typecheck:fast`.
- `npx vitest run --no-cache` sur les fichiers de ton périmètre nommés un par un (tes tests, `CodexRef*.test.tsx`, `App.surcouche-codex.test.tsx` ou son successeur, `PanneauParametre.test.tsx`, `editor/AddMenu.test.tsx`, les tests clavier cités au point 5, les importeurs de test de `Modal.tsx` et de `focus.ts` par `git grep -l`, liste collée), plus `src/vi-mock-isolate-guard.test.ts`, `src/comment-poison-guard.test.ts`, `src/ui/primitive-owners-guard.test.ts`, `src/ui/ui-ratchets.test.ts`.
- `node scripts/docs/check-doc-refs.mjs`.
- `npx tsx scripts/ui/regen-css-couches-stock.mts --check` (vérifie d'abord le nom actuel du régénérateur : la fusion `8f7fae1de` l'a déplacé ; `git log --stat -1 8f7fae1de` et `package.json`).
- eslint sur les fichiers que tu touches.
Les suites entières et `docs:check` appartiennent au run CI de la branche.

## Livrable
UN fichier : `/tmp/claude-0/-home-user-game/365ab83c-b2bf-5700-91e2-3605a34e86da/scratchpad/rendu-rm2-a-reprise.md` (sondes et sorties dans `scratchpad/rm2-a/`) :
- `git diff --stat` et la liste des fichiers neufs ;
- pour chaque point 1 à 7, fait ou reste, avec sa preuve ; les deux questions de sortie ;
- la table des mutations ;
- les sorties des portes ;
- les processus lancés et leur fin.

---
_Generated by [Claude Code](https://claude.ai/code)_
