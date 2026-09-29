# Rendu C1b — console + HUD (#1806 #1856 #1919), 2026-09-29, reprise après le codeur tué

Worktree `/home/user/game/.wt-1919-H2`, HEAD `b0f2f1499`. Le travail vit dans `git diff HEAD` plus
`src/ui/TeamSegments.test.tsx` (non suivi). Aucune commande git d'écriture. L'arbre principal est
propre (`git status --short` : 0 ligne).
Preuves brutes : `scratchpad/c1b/`. Blobs finaux : `c1b/blobs-finaux.txt`.

## État trouvé, puis ce que j'ai fait (point par point)

| Point | Trouvé dans le partiel | Fait dans cette reprise |
|---|---|---|
| Rouge de gate `css-valeur-en-test` | déjà fait : G-3 lit une relation évaluée (corps + habillage = arche) | vérifié vert |
| B1 fil hors de `temps` | fait : `Stack data-piste="frise"` (`CampaignView.tsx:329`), piste `container-type: size` (`hud.css:112`), état « pause de Round » ajouté à la sonde (`hud-clickables.mjs:524`, `:755`) | vérifié en navigateur : fil × bandeau = aucun, à 9 vues × 4 états |
| B2 coarse | fait : `--cc-cible` sert de plancher dans la formule (`combat-console.css:38`, `:77`, `:97`). Compositions compactes déclenchées au doigt (`:1114`, `:1255`). F-1 et F-3 jouées souris ET doigt ; la sonde du juge est promue dans F-3 | vérifié |
| B3 ≤560 | à moitié : case 36×36, F-5 réécrite mais `deck` inutilisé (lint) | F-5 passe par `deck`/`saillie` (tranches résolues). Écart 36×36 contre 36×32 écrit (`combat-console.css:1258-1260`). Plafond 25 % à 561-700 en test (F-5) et dans la sonde (`BUDGET_PONT.ligne`, `:807`). Matrice jouée aux 3 hauteurs. Test « à 700, rien » réécrit |
| B4 nom tranché | fait : aucune ellipse, enroulement au mot | vérifié avec « Knud Cratinx Klein Bürger-de-Fer » à 7 vues : débord 0, aucune coupe. **Reste** ci-dessous |
| B5 pose `ecran` | fait (`spectator-chip.css:24`) ; test jsdom qui monte `ActiveModal` seul, sans couche (le cas des hôtes `PartyScreen`, `MassBattleView` et `InterludeScreen`) | message du test mis au présent |
| A1 arche qui saute | fait : même grille dans les deux formes, `grid-column: 2`, coin compté à `--cc-corner` | `console-pont-formes.mjs` jugeait « arche centrée », ce qui contredit A1 : j'ai remplacé ce verdict par « arche immobile d'une forme à l'autre » et « bande stable » à toute largeur (`:20`, `:462-475`). Doc `recette-navigateur.md:207-213` mis à jour |
| A3 pont 561-700 | à moitié : `--cc-arch-ligne: 48px` / `68px` (cotes à la main) | la ligne est DÉRIVÉE de ses pièces : `--cc-arch-corps-h`, `--cc-niche-ecart` consommé par la niche (`:61`, `:846`, `:1123-1124`, `:1270`). G-1 refuse une cote px. Mesuré : 23,5 % à 640 et 700×780 |
| A4 portrait | fait : plancher `--cc-visage: 48px`, c'est la case qui cède (`:84-88`) | mesuré : 48 px à 701 et à 900 |
| A5 « Pierre- / de-Fer » | fait : un mot = une boîte `nowrap` (`TeamSegments.tsx`, `team-segments.css`) | ce correctif faisait déborder le fil de sa zone à 640 (127 px dans 105). Le fil est maintenant une `Row` (`CombatBanner.tsx:46`) : l'icône passe au-dessus. `flex-wrap` écrit à la main était refusé par le cliquet (vii) |
| A6 dalle de frise | fait en tour de héros et en tour adverse (frise 80,2 px dans sa piste) | **Reste** en pause de Round, ci-dessous |
| A7 cotes | — | `--cc-bay-ecart` ramené à 4 px, comme la décision (« 37 = conduit 15 + marges 8/10 + écart 4 ») : socle 37. L'écart restant est décrit ci-dessous |
| A8 | coin à 10 px du bord, plaque X avec rembourrage et laiton vif, icône de set à 0,45 × case | mesuré : coin à 10 px à toute vue ; plaque X 17,6×8 ; icône de set 12 px à 701 |
| `!important` | déjà fait : 7 → 3 (le socle `fc2388866` en avait 5), aucun neuf ; `PortraitTile` pose `--ptile-px` (vérifié `PortraitTile.tsx:73`) | vérifié |
| Constantes à la main | fait pour `--cc-bay-socle`, `--cc-arch-chrome`, `--cc-arch-flancs` | ajouté `--cc-arch-ligne` et la niche |
| JSDoc de `defautsCouche` | faite | S1-S4 rejouées sur le blob final |
| Fil 700/701 | fait : une seule composition (fil sous la frise, pleine largeur de zone, des deux côtés du seuil) | mesuré |
| Commentaires au passé | faits | message de test corrigé |
| Lint `deck` | présent | corrigé : F-1 et F-5 passent par `deck`/`saillie` |
| `.at(-1)` (TS2550, typecheck rouge) | présent (`CombatConsole.test.tsx:1132`) | remplacé par `.slice(-1)[0]` |

## Mesures navigateur (`c1b/final/geo.json`, `resume.txt`)

Pont (part de la hauteur), sous la souris :
- 360×740 : 37,8 % ;
- 360×650 et 560×650 : 43,1 % ;
- 640×780 et 700×780 : 23,5 % ;
- 701 à 1707 : 21,8 %.

Au doigt (émulation CDP) :
- 768×1024 : 20 % ;
- 1366×650 : 25,1 %.

Boîte de l'arche identique en A, pause et C à toute vue, sauf 900×780 : Δx = 1,0 px (316,5 contre 317,5).

Cases :
- 36 px de 360 à 560 ;
- 44,3 px à 640 et 700 ;
- 26,7 px à 701 ;
- 42,4 px à 900 ;
- 33,3 px à 1366×650 ;
- 44,3 px à 1707 ;
- 55 px au doigt à 768×1024 ; 44 px au doigt à 1366×650.

Portrait : 30 (ligne), 48 (701, 900), 79,7 (1366×650), 108 (1707).

Aucun recouvrement fil × bandeau de phase ni fil × frise, aucune case hors écran, aucun défilement de page. Console du navigateur : une seule exception, `items.ts:708 unloadWeapon` (lecture seule, #2141, hors lot).

## Restes nommés (mesurés, non corrigés)

1. **Nom long sur deux lignes, fronton ≥701** : « Knud Cratinx Klein Bürger-de-Fer » fait monter l'arche de 167 à 186 px (y 613 → 594). L'empreinte passe à 23,8 % à 701×780 et 900×780 (`c1b/nom-long-final.txt`). Aucun nom du scénario de recette n'y arrive. La correction est de design : soit réserver deux lignes au nom (19 px de portrait en moins), soit un autre arbitrage. Je ne l'ai pas tranchée.
2. **Pause de Round à 640** : la frise mesure 113,7 px dans une piste de 105 px, soit 8,7 px de débord (`geo.json` P-pause). En tour de héros et en tour adverse, elle mesure 80,2 px. La sonde ne mesure pas 640 (largeurs 1707…360, sans 640), donc elle ne le voit pas. Cause non isolée (piste `is-tiles` à 98 px en pause).
3. **A7, écart à la table Q1** : la case vaut 33,3 px à 1366×650, contre ≈ 37 dans la table. Deux causes :
   - La formule de la décision `(0,17h − 37)/2` n'enlève ni le liseré (3 px) ni l'écart entre les deux rangées (4 px). La tenir telle quelle mettrait la bande à 17 % + 7 px. Écart restant : 3,5 px par case.
   - Le 194 de la décision suppose des écarts de région fixes. `--cc-bay-gap` vaut `clamp(10px, 2vw, 26px)`, donc la part fixe de la rangée vaut 152 + 4 × écart : 224 à 900, 256 à 1366. Cela ne coûte qu'au plafond de largeur, soit ≈ 2,6 px de case à 900.
4. **Budget au doigt** : 25,1 % à 1366×650, et 48,0 % à 360×650 en composition empilée (calculé : 67 + 6 + 2 × 118 + 3 = 312 px). La cible de 44 px (WCAG 2.5.5) ne tient pas dans le budget. F-1 l'écrit (« case à sa cible, le budget lui cède ») ; F-5 ne juge ≤45 % que sous la souris.
5. **A8** : la plaque X fait toujours 8 px de haut (17,6×8). L'icône de set fait 12 px à 701 (la case y vaut 26,7, le visage garde 48). Je n'ai rien changé de plus.
6. **Δx 1 px à 900** entre les formes : les deux voies `minmax(min-content, 1fr)` n'ont pas le même min-content en forme complète (travées de largeurs différentes). La sonde tolère 1 px.
7. Hors lot, sans changement : touches « X » / « ESPACE » en dur (ticket à ouvrir par l'orchestrateur) ; exception `items.ts` (#2141).

## Mutations (`c1b/mut3/resultats.jsonl`, 32 lignes, toutes rouge rc=1 → vert rc=0, blob identique après)

Blobs finaux mutés :
- `combat-console.css` 5db0775e73 ;
- `spectator-chip.css` 722325e5de ;
- `TeamSegments.tsx` 1c05667b47 ;
- `hud-clickables.mjs` 240fa2f823.

Neuves ou réécrites :

| Id | Mutation | Test ou sonde |
|---|---|---|
| N01 | coarse retiré de la tranche ≤700 | F-3 « la bande déborde la fenêtre » |
| N02 | case ≤560 = 36px sec | F-2 « 360×740 au doigt : case sous la cible » |
| N03 | ligne +52px | F-5 « 561×650 : 32,8 % » |
| N04 | ligne compacte +40px | F-5 « 360×650 : 49,2 % » |
| N16 | ligne = `47px` | G-1 « cote relevée à la main » |
| N05 | plancher de visage retiré | G-3 « visage cédé 30 » |
| N06 | chrome = 59px | G-1 |
| N07 | `!important` remis | C-1 |
| N08 | corps −3px | G-3 relation |
| N09 | spectatrice centrée (jsdom) | test « RÉSERVE de bande » |
| N17 | spectatrice centrée, **sonde réelle** `console-pont-formes.mjs --widths 900` | « l'arche passe de x 316,5 à 358,5 » (le Δ42 du juge), rc 1 → 0 |
| N10 | coin `auto` | test « RÉSERVE de bande » |
| N11 | pose `ecran` sans `position` | ExplorationDock « HORS de la couche » |
| N12 | mot sans boîte | TeamSegments |
| N13 | verdict fil × phase muet | node test 81 |
| N14 | plafond ligne 35 % | node test 69 |
| N15 | coarse `--cc-bande: 20vh` | F-1 « 1100×780 (pointeur grossier) 20 % » |

Rejouées sur les blobs finaux : M05-M09, M11-M16, S1-S4 (même fichier, toutes rouge puis vert).

## Sondes navigateur (serveur de dev de l'arbre, port 5236)

- `hud-clickables.mjs` (`c1b/sonde-finale.txt`, rc=1) :
  - **couche : 105 vues, 105 OK** (7 largeurs × 3 hauteurs × 5 états, dont « pause de Round ») ;
  - 28 défauts, tous de classes préexistantes. Contre `c1/defauts-c1.txt` (normalisés) : **9 disparus** (le fil qui débordait de `temps` à 700 : ouverture, héros, spectateur × 3 hauteurs), **0 apparu** (`c1b/defauts-diff.txt`).
- `console-pont-formes.mjs` (`c1b/pont-formes-final.txt`) : rc=0, bande stable et arche immobile à 7 largeurs × 3 formes.
- Recette joueur (`c1b/recette.mjs`) : états A (tour du héros), pause de Round, journal ouvert (clic réel sur la poignée), C (« Fin du tour » cliqué deux fois), plus le tactile émulé (A et C) à 768×1024 et 1366×650. Les 9 vues du brief. **40 captures** `c1b/final/*.png`, empreintes dans `c1b/final/captures.sha256`.

## Portes (sortie brute, code lu sans pipe)

| Porte | Fichier | Code | Résultat |
|---|---|---|---|
| `npm run typecheck:fast` | `c1b/tc.txt` | 0 | 0 erreur |
| vitest, 12 fichiers : CombatConsole, CombatBanner, ExplorationDock, RecapLine, TeamSegments, InitiativeStrip, css-valeur-en-test, comment-poison-guard, css-definitions-guard, css-modules-guard, ui-ratchets, coupe-au-caractere-guard | `c1b/vitest-final.txt` | 0 | 373/373 |
| `node --test` hud-clickables.test, detecteurs-pont.test | `c1b/nt.txt` | 0 | 102/102 |
| stock `--check` | `c1b/stock-check-final.txt` | 0 | « Stock à jour » (régénéré : espacement 686 → 685) |
| ventilation contre `fc2388866` | `c1b/ventil.txt` | 0 | espacement 702 → 685 (APPARU 0) ; identité 1770 → 1751 (APPARU 0) ; inline 93 → 93 |
| eslint `--max-warnings 0`, 12 fichiers modifiés (JS/TS) | `c1b/eslint.txt` | 0 | vide |
| `npm run docs:build` / `docs:check` | `c1b/docsbuild.txt`, `docscheck.txt` | 0 / 0 | OK ; 7 docs générés ne changent que par l'empreinte des sources |

## Tâches lancées

- Serveur vite hérité du codeur tué (PID 32582/32583/32590/32598, `.wt-1919-H2`). Je l'ai utilisé, puis **tué** ; `pgrep` est vide.
- Chaque session Chromium des scripts se ferme dans son `finally` ; `pgrep chrom` est vide.
- Aucune tâche en arrière-plan.
