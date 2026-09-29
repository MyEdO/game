# Rendu H1b #1919 : corrections des juges de diff et d'écran (2026-09-28)

- Worktree `/home/user/game/.wt-1919-H2`, branche `wt/1919-H2`, HEAD `fc2388866`. Rien n'est committé.
- Arbre principal : `git -C /home/user/game status --short` est vide, aucune fuite.
- Aucune écriture dans `node_modules`. `src/data/primitives.manifest.json` n'est pas touché.
- Horloge : 21:42 → 22:25 UTC, soit environ 45 min sur 1 h 45.
- Porte d'entrée : invariant, cas canonique et design jugé sont ceux du brief H1 (`brief-h1-1919.md`), présents. Ce lot ne touche aucun socle d'état.

## Diff stat (`git diff --stat`, contre HEAD)
```
 docs/charte-ui.md                       | 56 +++++-----
 docs/{consommateurs-de-champs,orphelines-donnees,raw/reconciliation,registre-jets,usages-jets}.md | 1 ligne chacun (empreinte, docs:build)
 scripts/recette/hud-clickables.mjs      | 42 +++-
 scripts/recette/hud-clickables.test.mjs | 39 +++-
 src/ui/CampaignView.tsx                 | 40 +++---
 src/ui/CombatConsole.test.tsx           |  9 +
 src/ui/CombatConsole.tsx                |  6 +-
 src/ui/ExplorationDock.test.tsx         | 53 +++-
 src/ui/camera-sans-plaque.test.ts       |  3 +-
 src/ui/styles/combat-banner.css         | 10 +-
 src/ui/styles/components.css            | 12 +-
 src/ui/styles/hud.css                   | 65 +++---
 src/ui/styles/log-drawer.css            |  4 +-
 src/ui/styles/objective-banner.css      |  5 +-
 src/ui/styles/spectator-chip.css        | 15 +-
 19 files changed, 262 insertions(+), 107 deletions(-)
```

## Défauts, un par un

### A1 / A2 : lieu tranché à 360 et 700 (« Du S… », « Du Sang sur l… ») → CORRIGÉ
- **Aires par mode à ≤700** (`hud.css:241`, `.stage > .stage-flot[data-pont='exploration']`) :
  - `'contexte contexte contexte' / 'groupe groupe groupe' / 'temps temps temps' / '. . .'` ;
  - hors combat, le lieu prend toute la rangée `haut`, et le groupe descend dans la bande ;
  - en combat, `contexte` ne porte que ☰ : les aires de combat restent `'contexte groupe .'`.
  - C'est l'alternative « aires par mode » du juge de diff (R3).
- **Le lieu s'enroule au mot à toute largeur (R-M2)** :
  - `text-overflow: ellipsis`, `white-space: nowrap` et `overflow: hidden` sont supprimés de `.hud-topbar [data-hud='place']` (`hud.css:174`).
- Mesures réelles (`h1b/apres/mesures.json`) :
  - 360×740 : lieu entier « Du Sang sur la Route — scène de test », boîte 210,8 × 23, sur une ligne ;
  - 700×780 : idem ;
  - 900×780 : 187 × 46, soit deux lignes coupées au mot ;
  - 1366 et 1707 : une ligne.

### A3 : journal ouvert sur la frise et le fil à 360 → CORRIGÉ à 360 ; le coût à 700 est mesuré plus bas
- **Montage** : le rail devient la surface d'une zone `outils` qui l'enveloppe (`CampaignView.tsx:370`, `<Stack data-zone="outils" align="end">`).
- **Zone conteneur** : la zone est un conteneur de taille (`hud.css:95`, `container-type: size`).
- **Place du rail à ≤700** : il passe au coin haut du CHAMP, par les lignes de la couche (`hud.css:248`, `grid-row: champ; grid-column: flanc-d`).
- **Hauteur du panneau** : il pend sous le rail (`.hud-rail .log-drawer { position: static }`, `hud.css:158`). Il est borné à la place que la zone lui laisse :
  - `--ld-place: calc(100cqh - 100% - var(--sp-sm))` sur `.hud-rail` (`hud.css:156`) ;
  - la primitive lit `max-height: min(38vh, var(--ld-place, 38vh))` (`log-drawer.css:43`) ;
  - le pont d'exploration ne déclare rien, il garde donc 38vh.
- **Mesures, 360×740, journal de combat ouvert au clic réel** :
  - panneau y 208,8..373,8 ; frise y 50..113,8 ; fil y 121,8..139,8 ;
  - recouvrement du panneau sur la frise, le fil, le groupe et le pont : aucun (`journalSur` à `null` partout) ;
  - « inatteignables » : 3 (Johann, Grunni, Frère Anselm). Ce sont les entrées de frise en défilement, exemptées, identiques en tour de héros sans journal. Le lot H1 en comptait 9.
- **Journal long** (30 entrées, posées par `__wfrp`, ouvert au clic réel), 360×740 : panneau 309,6 × 199,2, borné. Il ne recouvre ni la frise, ni le fil, ni le pont.
- « Le journal ouvert ne déplace rien » reste vrai : le panneau est hors flux, le rail et le groupe gardent leurs boîtes.
- **COÛT, à arbitrer par l'orchestrateur** : en tour de héros à 700×{780, 740, 650}, le pont fait 575 px et le champ vaut 0 px. Le rail, désormais dans le champ, est rogné comme l'étaient déjà la frise et le fil (A5). La sonde voit 11 défauts de plus que H1, tous à 700 en tour de héros (`h1b/defauts-h1.txt` contre `h1b/defauts-h1b.txt`, 0 disparu, 11 apparus) :
  - « Ouvrir le journal » inatteignable ;
  - « Dossier du navire » recouvert par `cc-dock` ;
  - le tiroir ne s'ouvre pas, faute de place ;
  - le rail est rogné et déborde de sa zone de 0 px de haut.
- Ce coût est de la même classe que B3 (budget du pont 561-700, lot console Q4.3). Il disparaît dès que le champ existe : en tour adverse à 700×780, avec un pont de 189 px, le rail est à y 235,4 et atteint.
- Je n'ai trouvé aucune place, à 700×780 sous un pont de 575 px, où le panneau ne recouvre ni la frise ni le fil. Le couple haut + bande vaut déjà 223 px, pour une couche de 205 px.

### A4 : l'objectif sort de sa zone à 900 → CORRIGÉ
- `.objective-text` s'enroule au mot (`objective-banner.css`, `min-width: 0`, sans `nowrap` ni ellipse, R-M2).
- 900×780 : objectif x 8..243, pour une zone `temps` x 8..243. Boîte 235 × 45 (deux lignes) : aucun débord, aucun recouvrement du groupe.
- **Même classe trouvée par le nouveau verdict** : le fil d'événements débordait de la zone `temps` à 900 de 122,4 à 170,8 px (fil 317,7 px dans une zone de 235 px, `white-space: nowrap`, `max-width: 42vw`). Corrigé dans `combat-banner.css` :
  - `.cb-ev` s'enroule au mot à toute largeur ;
  - `max-width: 42vw` et `94vw` sont supprimés, la zone borne ;
  - à 900, le fil mesure 146,8 × 48 dans sa zone.
- **Sonde étendue** (`scripts/recette/hud-clickables.mjs`) :
  - mesure : chaque surface (enfant de zone) relève `zoneRect` et `debord` (ce qu'elle peint hors de la boîte de sa zone) ;
  - `recouvrementsEntreZones(c)` (`:715`, PUR) : paires de surfaces de zones différentes dont les boîtes PEINTES, rognées par la couche, se recouvrent de plus de 0,5 px sur les deux axes ;
  - verdicts dans `defautsCouche` (`:746` et suivantes) ;
  - le nom d'une surface est sa première classe propre, jamais `stack`/`row`/`grid`/`split` ;
  - l'en-tête du fichier est mis à jour.
- Tests unitaires ajoutés (`hud-clickables.test.mjs`) : débord rouge chiffré, débord sous 0,5 px muet, recouvrement entre deux zones rouge, deux surfaces de la même zone muettes, recouvrement dans les seules parts rognées muet. Le fixture sain porte deux zones.

### A5 : fil perdu à 700 → NON CORRIGÉ dans la couche (consigne B3), mesuré
Sonde finale, tour de héros à 700, pont de 575 px, champ de 0 px :

| Vue | Fil | Frise | Groupe | Rail (nouveau, cf. A3) | Commandes inatteignables |
|---|---|---|---|---|---|
| 700×780 | rogné de 26,5 px | — | — | rogné de 90,5 px | 1 (journal) |
| 700×740 | rogné de 66,5 px | rognée de 40,5 px | — | rogné de 130,5 px | 10 (9 entrées de frise sous `cc-dock`, et le journal) |
| 700×650 | rogné de 156,5 px | rognée de 130,5 px | rogné de 52,6 px | rogné de 220,5 px | 10 |

Ce tableau est l'entrée du lot console : budget du pont 561-700.

### B1 : conversation et puce hors zone, charte fausse → CORRIGÉ (zone donnée, critère N+1)
- **Zone PAROLE** (`CampaignView.tsx:395`) : `<Stack data-zone="parole" align="center">` enveloppe `DialogueBox` et `ActiveModal`, dont les modales restent des voiles fixes.
- Placement par les lignes (`hud.css:135`) : `grid-row: champ; grid-column: flanc-g / -1; align-self: end`.
- **Ancrages absolus supprimés** :
  - `.dialogue-box` (`components.css`) : `position: absolute`, `bottom: 18px`, `left: 50%` et `transform` ; le reset `position: static; transform: none` de `.dlg-boniment` devient mort et est supprimé ;
  - `.spectator-chip[data-pose='ecran']` (`spectator-chip.css`) : `position`, `bottom`, `left`, `transform`, `z-index`, `align-self`. Il ne reste que `margin-top: 0`.
- Le commentaire périmé « trois hôtes » est corrigé : il n'existe qu'un poseur de `pose="ecran"`, `ActiveModal.tsx:76`.
- **Mesure navigateur, conversation ouverte** (état posé par `__wfrp`, `h1b/dialogue.json`, console à 0) :
  - 360×740 : boîte à y 395..683, zone `parole`, `position: static`, flot jusqu'à 691 ;
  - 900×780 : 680 × 213,6, centrée x 110..790 ;
  - 1366×650 : x 343..1023, y 371,4..585, flot jusqu'à 601.
- **Garde de CLASSE** (`ExplorationDock.test.tsx:383-420`) : elle rend `CampaignView`, collecte les surfaces (chaque zone et chaque enfant de zone), lit TOUTES les feuilles de `src/ui/styles` et échoue si une règle `position: absolute|fixed` vise une surface (`el.matches`). Tout enfant de la couche doit porter `data-zone`. Deux états : exploration avec conversation, objectif et caméra ; combat coop avec la puce `data-pose='ecran'` par le vrai arbitre (`pendingCascade` d'un héros du siège distant).
- **Écart au brief, déclaré** : le brief place cette garde dans `ui-ratchets.test.ts`. Elle vit dans `ExplorationDock.test.tsx`, qui porte déjà le montage jsdom de `CampaignView` du bloc #1919. `ui-ratchets` ne rend rien, et les feuilles ne se lisent au DOM rendu qu'avec un rendu (sans cela, il faudrait une liste de feuilles, c'est-à-dire une garde de synchronisation). La garde `ui-ratchets` sur `hud.css` (volet seul hors flux) reste vraie et est inchangée.
- **Charte** (`docs/charte-ui.md:386` et suivantes) :
  - la zone `parole` est ajoutée à la liste ;
  - trois zones sont posées par lignes, avec la raison : `camera`, `parole`, et `outils` à ≤700 ;
  - la garde de classe est nommée ;
  - hors flux, il reste deux PANNEAUX nés de leur commande : le volet et le panneau du journal ;
  - lignes de tableau corrigées : `.dialogue-box` (`:306`) et `spectator-chip.css` (`:348`).

### B2 → CORRIGÉ
`combat-banner.css:6` : la zone est `temps`.

### R1 → CORRIGÉ
La phrase fausse est remplacée. Elle dit désormais : `contexte` et `temps` (`contain: inline-size`) et `outils` (conteneur de taille) ne pèsent sur aucune colonne ; seul le groupe dimensionne la colonne centrale ; les flancs sont égaux, avec le minimum de contenu de leurs zones (`minmax(min-content, 1fr)`, plancher ☰). La phrase « le texte s'enroule au mot » est ajoutée, avec sa référence R-M2.

### R2 → CORRIGÉ
- `estOuverture` porte `over` (`CombatConsole.tsx:509`) : `!!b.battle && !b.battle.over && …`.
- `BandeauDOuverture` lit `useGame(estOuverture)` (`:516`). La console garde son `if (!battle || battle.over) return null` (`:593`).
- Nouveau test `CombatConsole.test.tsx:3636` : « combat CLOS pendant l'ouverture : ni bandeau d'ouverture ni pont ».

### R4 → CORRIGÉ
La charte attribue les 152 px à l'ordre du DOM (« le panneau précède le bouton dans le DOM du tiroir (`src/ui/LogDrawer.tsx:25-45`) »), et non plus au « flux » en soi.

### R5 → CORRIGÉ
- `.hud-topbar { pointer-events: none }` et `.hud-topbar > * { pointer-events: auto }` sont supprimés.
- Une seule règle subsiste : `:where(.stage-flot > [data-zone] > *) { pointer-events: auto }`. Sa branche `:not([data-zone])` est morte, puisque tout enfant de la couche est une zone (garde ci-dessus).

### Test réécrit hors liste
`src/ui/camera-sans-plaque.test.ts:27` verrouillait par texte la forme `mode === 'battle' && ( <Stack … className="hud-rail skin-bois"`. Il exige maintenant l'enveloppe de zone `outils`.

## Mutations
- Script : `scratchpad/h1b/muter.py`. Remplacement unique, puis remplacement inverse (retour à l'identique).
- Journaux : `scratchpad/h1b/mut/<nom>-{rouge,vert}.txt` ; résultats dans `mut/resultats.jsonl`.
- Dans chaque ligne, les empreintes avant et après sont identiques (`identique: true`).

| # | Fichier muté | Mutation | Rouge | Avant → muté → après | rc rouge / vert |
|---|---|---|---|---|---|
| M1 | hud-clickables.mjs | verdict de débord muet | « surface qui DÉBORDE de sa zone » | a35ff65cc6 → 3f92cf3a61 → a35ff65cc6 | 1 / 0 |
| M2 | hud-clickables.mjs | recouvrement muet | « surfaces de DEUX ZONES qui se recouvrent » | a35ff65cc6 → 32af750c36 → a35ff65cc6 | 1 / 0 |
| M3 | components.css | `.dialogue-box { position: absolute }` | « aucune SURFACE … hors flux » : `['components.css « .dialogue-box »']` | 302c8253d2 → 0a183626ed → 302c8253d2 | 1 / 0 |
| M4 | spectator-chip.css | `[data-pose='ecran'] { position: absolute }` | « COMBAT COOP : la puce … » | 5095e916ad → e1edec6fc3 → 5095e916ad | 1 / 0 |
| M5 | CombatConsole.tsx | `estOuverture` sans `over` | « combat CLOS » : « un bandeau d'ouverture sur un combat clos : expected 1 to be +0 » | 498ce736c8 → bd89e1a826 → 498ce736c8 | 1 / 0 |
| M6b | CampaignView.tsx | `DialogueBox` sortie de la zone | « un enfant de la couche sans zone se pose lui-même : expected ['dialogue-box'] » | 29bc410b08 → 98059040a8 → 29bc410b08 | 1 / 0 |
| M7 | objective-banner.css | `.objective-text { white-space: nowrap }` (A4 réintroduit), **sonde réelle** `--widths 900` | exploration 900×{780, 650, 740} : « objective-banner … déborde de sa zone « temps » … de 125.7px » et « party-dock (zone groupe) … recouvre objective-banner (zone temps) » ; vert : exploration 900 → OK | 85536b94e1 → b8eaab3fb5 → 85536b94e1 | 1 / 1 |
| M8 | CampaignView.tsx | rail sorti du gabarit combat | « le rail d'outils est monté EN COMBAT » | 29bc410b08 → 5b2f5333e7 → 29bc410b08 | 1 / 0 |

- **M7, vert à rc = 1** : la passe verte sort en 1 à cause des défauts de console à 900 en tour de héros, préexistants et identiques à H1 (« Dague », « Mains nues » à x = −36,6 ; case recouverte par un `svg`). Les lignes d'exploration 900 y sont toutes OK (`mut/M7-vert.txt`).
- **M6** (première passe, `mut/M6-*.txt`) : ROUGE sur l'assertion `zoneDe`. Les assertions ont été réordonnées pour que M6b prouve la garde « sans zone ».

## Recette navigateur (`scratchpad/h1b/capture.mjs`, joueur réel pour les gestes)
- **Setup et clics** : setup par `__wfrp` (`scenario('embuscade', 7)`, objectif, `fight`, `turn`, journal long). « Commencer le combat », les ouvertures et fermetures du journal et du volet se font par clics réels.
- **Captures** : 34 PNG et `mesures.json` sous `scratchpad/h1b/apres/`. Empreintes : `scratchpad/h1b/apres.sha256`. Défauts A1-A4 :
  - `exploration-360x740` bfcd8b14… ; `exploration-700x780` b1d9b85d… ; `exploration-900x780` 6c82bc64… ;
  - `exploration-journal-{360,700,900}` 72184cea… / 755d80f7… / f6b97821… ;
  - `combat-journal-360x740` 007ee4b0… ; `combat-journal-long-360x740` 4c918efb… ; `combat-journal-900x780` 48c348f1… ;
  - `combat-heros-900x780` 9a6991ac… ;
  - `combat-heros-700x780`, `combat-journal-700x780` et `combat-journal-long-700x780` ont la même empreinte, c4da230c… : le rail et le panneau y sont rognés (cf. A3, coût) ;
  - conversation : `exploration-dialogue-{360x740,900x780,1366x650}` 9e8e0ae0… / b48ae278… / 5728c7eb….
- **Clic dans une zone vide** : `svg.iso-stage` reçu, en exploration (846,9 ; 292,5) comme en combat (846,9 ; 260). La zone `parole`, qui couvre le champ, ne prend aucun clic.
- **Volet à 360** : tuiles 44 × 62, chiffres 12/12, 16/16, 14/14 et 10/10 visibles, inchangé.
- **Console** : 1 erreur, préexistante et hors périmètre. `TypeError: Cannot assign to read only property 'loaded'` dans `unloadWeapon` (`src/engine/items.ts:708`), via `combatFlow.ts:1719` et `:1481`, sur l'attaque d'IA ennemie. Recette de la conversation : 0 erreur.
- **Limite** : je n'ai aucun outil de lecture d'image. Toutes les affirmations viennent des mesures DOM, et les captures restent à lire par le juge.

## Sonde étendue (sortie brute : `scratchpad/h1b/sonde-finale.txt`, exit=1, 67 défauts)
- **Couche** : 84 vues, **78 OK**, 0 débord et 0 recouvrement hors des vues de 700 en tour de héros. Les 6 vues en défaut :
  - 900 × 3 hauteurs, tour de héros : console, préexistant, identique à H1 ;
  - 700 × 3 hauteurs, tour de héros : pont de 575 px, voir A5 et le coût de A3.
- **Contre H1** (`scratchpad/h1/sonde-finale.txt`, 56 défauts) : 0 disparu, 11 apparus, tous à 700 en tour de héros (rail, journal et dossier).
- **Préexistants inchangés** :
  - pont à 24 % à 1707 ;
  - « au trait en bas » à 1707, 1100 et 900 ;
  - §12 à 700 (vie non superposée) ;
  - compacité à 700 et 900.

## Portes (sortie brute sous `scratchpad/h1b/`, code lu sans pipe)
| Porte | Code | Résultat |
|---|---|---|
| `npm run typecheck:fast` (`tc2.txt`) | 0 | 0 erreur |
| `npx vitest run --no-cache` sur 37 fichiers (`vitest.txt`) : importeurs par `git grep -l`, plus `ui-ratchets`, `comment-poison-guard`, `css-modules-guard`, `primitive-owners-guard`, `stock-primitive`, `in-battle-find-guard`, PartyDock et InitiativeStrip | 0 | 632 réussis, 2 todo |
| `node --test` sur hud-clickables, lib, cssCouches et cssConservation (`nodetest.txt`) | 0 | 212 / 212 |
| stock `--check` (`stock.txt`) | 0 | « Stock à jour » |
| ventilation contre `fc2388866` (`ventil.txt`) | 0 | identité 1770 → 1770, espacement 702 → 702, APPARU 0 |
| `!important` ajoutés sous `src/ui/styles` | — | 0 |
| eslint sur les 7 fichiers `.ts`, `.tsx` et `.mjs` touchés (`eslint.txt`) | 0 | sortie vide |
| `npm run docs:build` (`docsbuild.txt`) | 0 | 5 docs générés, empreinte seule |
| `npm run docs:check` (`docscheck.txt`) | 0 | OK |

## Hors périmètre (constaté)
- `src/engine/items.ts:708`, `unloadWeapon` : l'erreur console ci-dessus.
- C5 : au-dessus de 700 (900), le journal de combat ouvert recouvre encore le groupe (panneau x 561..891, y 73..219 ; groupe recouvert sur 88 × 58,6). Le brief exigeait « au moins ≤700 ».
- Zone `outils`, conteneur de taille : sa colonne ne se dimensionne plus sur le rail. Les flancs, égaux, font toujours ≥ 92 px mesurés, pour un rail de 60 px. Le verdict de débord de la sonde garde ce point.

## Processus
- **Serveur de dev** : `setsid timeout 3600 npm run dev`, PGID 3760, port 5236. **Tué** par `kill -TERM -3760`. Vérifié : aucun `vite`, `esbuild` ni `timeout` restant, et `curl` rend 000.
- **Chromium** : chaque session `openApp` (capture, conversation, sonde ×2, mutation M7) est fermée dans son `finally`. `ps` ne montre aucun chrome restant.
- Aucune tâche en arrière-plan ne survit.
