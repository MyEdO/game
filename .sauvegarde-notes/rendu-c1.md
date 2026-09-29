# Rendu C1 (#1806, #1856) : géométrie de la décision d'écran du 2026-09-24, 2026-09-28

- Worktree `/home/user/game/.wt-1919-H2`, branche `wt/1919-H2`, HEAD `fc2388866`. Rien n'est commité. Le lot H1b est resté intact dans l'arbre ; ce diff se lit en cumul avec lui.
- Arbre principal : `git -C /home/user/game status --short` est vide, aucune fuite.
- Aucune écriture dans `node_modules`.
- Horloge : 22:25 → 23:48 UTC, soit environ 1 h 25 sur 2 h 30.
- Porte d'entrée : le brief porte `## Invariant`, le cas canonique et `## Design jugé :`. Il est accepté.

## Diff (`git diff --stat HEAD`, cumul H1b + C1)
28 fichiers, +909 / −802. Fichiers touchés par C1 :
- `src/ui/styles/combat-console.css`
- `src/ui/CombatConsole.tsx`
- `src/ui/CombatConsole.test.tsx`
- `src/ui/gallery/registry.tsx`
- `src/state/hotbarBridge.ts`
- `src/ui/styles/hud.css`
- `src/ui/styles/initiative-strip.css`
- `src/ui/styles/combat-banner.css`
- `src/ui/CampaignView.tsx` (`rowBelow`)
- `scripts/recette/hud-clickables.mjs` et `hud-clickables.test.mjs`
- `scripts/guards/lib/cssCouchesStock.mjs` (régénéré)
- `docs/charte-ui.md`, `docs/plans/2026-08-16-spec-hud-combat.md`
- 6 docs générés, empreinte seule : `codex-relations`, `systemes`, `vocabulaire-mecanique`, et les trois déjà touchés par H1b

## Coutures relocalisées : instantané `03ddd90ce` → arbre `fc2388866`+H1b (avant) → après
| Couture de la décision | Sur l'arbre avant C1 | Après C1 |
|---|---|---|
| `css:21-35`, deux variables de case | `combat-console.css:21-33` : `--cc-cell-w` / `--cc-cell-h`, et le commentaire « jamais un carré (arbitrage utilisateur 2026-08-17) » | `:60` `--cc-cell-haut`, `:73` `--cc-cell` : côté unique, carré. Le commentaire est supprimé. |
| `css:42` `--cc-end-h: 106px` | littéral `min-height: 106px` sur `.cc-end` (≈ `:1017`) | `:1008` `height: calc(var(--cc-cell) * 2 + var(--cc-gap))` |
| `css:47` fronton | `:58` `--cc-fronton: 52px` | `:28` `min(52px, 4.8vh)` |
| `css:52` portrait | `:63` `calc(var(--cc-cell-h) * 2.4)` | `:65` : clamp à partir de la fenêtre (voir Q2) |
| `css:653-656` icône | `:34` `--cc-ico: calc(var(--cc-cell-h) * 0.5)` | `:75` `calc(var(--cc-cell) * 0.6)` |
| `css:1086-1131` deux rangées | bloc `@media (max-width: 900px)` et son commentaire « rangée à QUATRE régions infaisable » (≈ `:1106-1123`) | bloc supprimé |
| `css:1141` 561-700 empilé | `@media (max-width: 700px)`, `.cc-dock { flex-direction: column }` | `:1074` : arche en ligne et deux travées côte à côte |
| `css:181` extinction ≥701 | déjà inconditionnelle sur cet arbre (grep `min-width: 701` négatif dans le module) ; la boîte de la bande, elle, différait à 700 (575 contre 189) | `:236` le plancher tient la boîte ; `:1118` l'arche se pose au pied |
| `css:616-622` `.cc-set-n` | `:661-669` | supprimé, avec `.cc-set .cc-key` |
| `css:1243-1246`, commentaire « excuse » renvoyant à #1806 | **introuvable** sur cet arbre (grep `1806` négatif dans le module) | voir « Hors périmètre » (`:529` « Dette nommée ») |
| `tsx:1316`, `:1335` `cc-set-n` | `CombatConsole.tsx:1310`, `:1331` | supprimé |
| `tsx:1342` X sur la vignette | `:1337` | plaque en en-tête, `:1264` |
| `tsx:1121` / `:1430` endNote | `:1124`, `:1420` | `:1119` `etatDuTour`, `:1415` ESPACE en dur |
| `cc-lbl` des cases | `:216` | supprimé des cases |
| `hud-clickables.mjs:727`, `:1333-1336` | `:800` `BUDGET_PONT = { large: { des: 1280, part: 0.21 } … }`, `:866` `part = r.h / hauteur` | `:803` et `:866-880` |
| `hotbarBridge.ts:11-12` | commentaire « console en lecture » : faux, la forme spectatrice ne publie aucun rang (`CombatConsole.tsx:1078`) | corrigé |

## Points du brief, un par un

### 1. Q1 : une rangée de 701 à 1279 → FAIT
- **Côté unique** (`css:73`) : `min(--cc-cell-haut, (100vw − --cc-arch-w − --cc-rangee-fixe) / --cc-colonnes)`.
  - `--cc-cell-haut` = (bande − liseré − socle − écart) / 2.
  - Les constantes 37 et 194 de la décision sont relocalisées sur les vraies variables :
    - socle `--cc-bay-socle: 41px` (le 37 de la décision oubliait l'écart de 8 entre conduit et grille), plus le liseré 3 ;
    - `--cc-rangee-fixe` = 2 marges + coin + 9 écarts de case + 4 flancs de travée + 4 écarts de région (192 à `bay-gap` 10) ;
    - `--cc-colonnes` = 11 + `--cc-sets-part` (0,62).
- **Réserve miroir** (`css:241`) : `clamp(0, 100vw − --cc-rangee, coin + écart)`. Les voies sont `minmax(min-content, 1fr)` : la rangée tient par construction.
- **Libellé** : les cases ne portent plus `cc-lbl`.
  - `ConsoleCell` s'enveloppe TOUJOURS d'un `CodexRef` (`fallback={{}}` pour une case sans fiche).
  - `instance={cell.label}` met le nom de la capacité en tête de l'infobulle et la fiche dessous.
  - `aria-label` est conservé. `data-hotkey` et sa réserve de pied sont supprimés.
- **Icône** : 60 % du côté.
- **Case vide** : vitre nue ; sa touche imprimée reste (spec zone 8 — interprétation, à juger).

### 2. Q2 : fronton compté, coin, portrait → FAIT
- `--cc-bande: 17vh`, `--cc-fronton: min(52px, 4.8vh)`.
- `--cc-arch-h` = bande + fronton − liseré : l'arche tient exactement le budget.
- **Portrait** (`css:65`) : `clamp(30px, 100vw − rangée − flancs − colonnes × cell-haut, arch-h − chrome)`. C'est une donnée de fenêtre, sans boucle sur le pont.
  - Il cède aux cases sur fenêtre étroite, jusqu'au portrait de vignette de la ligne compacte (30).
  - **Écart déclaré** : ce plafond de LARGEUR n'est pas écrit dans la décision. Sans lui, à 701×780, les cases tombaient à 21 px (portrait 108), contre la cote de la décision « ≥ 28 px ». Avec lui, elles font 28,1 px.
- **Corps de l'arche** = arch-h − habillage (`css:758`). Les gouttières le remplissent : le rail passe à `flex: 1 1 0`, et `--cc-rail` est supprimé.
- **Habillage mesuré** : `--cc-arch-chrome: 59px` (rembourrages 14, écarts 8, Blessures 15, nom 19, liseré 3). Relevé `console-pont-formes --mesures` : arche 184,3 = 125,3 + 59.
- **Débord de 3 px corrigé** : la tuile du portrait était débordée par son visage, posé à la taille de la tuile. Le visage et le dessin sont désormais à `100%`.
- **Plancher de bande** : `min-height: var(--cc-deck-h)`. La boîte est `border-box` (`base.css:290`) : l'ancien `deck − liseré` laissait la forme spectatrice 3 px plus courte à 700 (mesuré 233,6 contre 236,6).

### 3. Q4.3 : 561-700 → FAIT, avec un écart chiffré
- **Console** (`css:1074`) : arche en ligne et coin en bout de ligne, puis `left right right`.
  - Même formule de côté. `--cc-arch-w: 0` et une rangée fixe à deux travées.
  - `--cc-deck-h` = ligne d'arche + écart + travée + liseré.
  - `--cc-arch-ligne: 100px` est un relevé : la ligne d'arche compacte, gouttières comprises, mesure 100 px (le socle et la place réservée au geste font 64).
- **Écart à la décision** : elle vise « cases ≈ 40, pont ≈ 19 % ». Mesuré : cases 42,3, pont 30,3 % à 700×780 et 640×780. Les deux cotes sont incompatibles avec la ligne d'arche existante : 100 px, soit 12,8 % à 780 à elle seule.
- **Couche HUD** :
  - le bloc d'aires de combat et le rail en rangée passent de ≤700 à ≤560 (`hud.css:238`) ;
  - `initiative-strip.css` : la forme en bande passe à ≤560 ;
  - `combat-banner.css:67` passe à ≤560 ;
  - `CampaignView.tsx:371` passe à `rowBelow={560}` ;
  - la seule variante d'exploration reste à ≤700 (`hud.css:225`).
- **Mesure à 700×780, tour de héros** (`c1/apres/mesures.json`) :
  - flot jusqu'à 543,4 ;
  - frise y 58..443,8 (colonne) ;
  - fil 451,8..499,8 ;
  - rail 8..68.
  - Rien n'est rogné par la couche. Avant (H1b) : fil rogné de 26,5, rail de 90,5, journal inatteignable.
  - Sonde : tour de héros à 700×{780, 740, 650}, 24/27, 22/27 et 23/27 commandes atteintes. Les restantes sont exemptées, en défilement de frise.

### 4. Q4.2 : extinction à toute largeur → FAIT
- La matière était déjà éteinte sans borne sur cet arbre. La BOÎTE est désormais identique dans les trois formes à toute largeur (`console-pont-formes.mjs` : 170 / 141,7 / 236,6 / 313 px, identiques dans les trois formes).
- Sous 701, l'arche se pose au pied de la bande.
- Le clic à côté de l'arche tombe sur `svg.iso-stage` aux 8 vues (état C).

### 5. Q3 : sets → FAIT
- `.cc-set-n` est supprimé, vignettes vides comprises.
- X devient une plaque unique `<span class="cc-key">` avec l'icône `ui/rotate-right`, dans l'en-tête de l'arsenal (`tsx:1264`, `css:629`). Elle n'ajoute aucune hauteur (8 px dans une ligne de titre de 15 px).
- Le clic sur la vignette est conservé.
- **Reste** : à ≤560, la plaque ne se replie pas « avec le commutateur ». Le commutateur n'a plus de repli sur cet arbre : `css` ≤560 « le repli du commutateur v7 est mort avec la rangée sous la travée ». La plaque reste donc visible à 360.

### 6. Q4.7 : Fin du tour → FAIT
- La touche vaut ESPACE à tout état.
- L'état « Action non dépensée » / « Tour fini » se lit :
  - dans l'infobulle (`fallback.sub`, `tsx:1399`) ;
  - en `aria-describedby` (`#cc-etat-du-tour`).
- L'armement garde « Finir quand même ».
- Le nom du coin garde la classe `.cc-lbl` (`.cc-end .cc-lbl`, `css:1029`). C'est le seul nom gravé du pont. La classe est réutilisée pour ne créer aucun site d'identité neuf (ventilation APPARU 0). Écart de nommage à juger.

### 7. Sonde → FAIT
- `BUDGET_PONT = { des: 701, bande: 0.17, empreinte: 0.22, compact }` (`:803`).
- Saillie = `bande.y − arche.y`, mesurée à part. `part` = (bande + saillie) / hauteur.
- Verdict aveugle si la bande ou l'arche est absente.
- La frise est en colonne à >560. Le verdict « bande sous le groupe à 561–700 » est supprimé : il est sans objet.
- Le libellé d'une case est lu dans son `aria-label`.
- En-tête du fichier mis à jour.

### 8. Docs et commentaires → FAIT
- `docs/charte-ui.md` : ancienne `:682`, aujourd'hui `:714` ; la table `:346` ; la section de la couche (≤560 au lieu de ≤700) ; le paragraphe du budget.
- Spec : `:24-32` (budget, cases carrées), `:215` (grille), coin F.
- `hotbarBridge.ts:11-13`.
- Le commentaire « jamais un carré » est supprimé.

## Tests réécrits ou neufs (`CombatConsole.test.tsx`, `hud-clickables.test.mjs`)
- Réécrits :
  - C-1 (portrait et visage) ;
  - C-4 (aucun mot, nom dans l'infobulle, case sans fiche) ;
  - P-4 (réserve miroir et rangée dans la fenêtre) ;
  - plancher de bande (`border-box`) ;
  - (a) (touche X en en-tête, aucun rang) ;
  - D-2 (titre = capacité, sous-titre = fiche) ;
  - D-3 (ESPACE, état en infobulle) ;
  - D-4 ;
  - R-7 ;
  - R-7bis (touche dans le coin, sans réserve) ;
  - E-3 ;
  - E-4 ;
  - F-1 à F-5 (17 % et 22 %, carré, continuité 900|901, ≥ 28 à 701, fenêtre, 60 %) ;
  - G-1 ;
  - G-3 (portrait tiré de la fenêtre, qui remplit l'arche).
- Lecture du nom : `nomCase` = `aria-label` (tests Recharger, (b), (c), (c-bis), R-1, R-5, Dissiper).
- `evalLen` lit aussi les jetons de `base.css`.
- Sonde, tests neufs : bande > 17 % dès 701 ; fronton compris > 22 % ; aveugle. Tests adaptés : frise en colonne à 561 et en bande à ≤560.

## Mutations
- Script : `scratchpad/c1/muter.py`. Journaux `scratchpad/c1/mut/<nom>-{rouge,vert}.txt`, résultats dans `mut/resultats.jsonl`.
- Chaque mutation est un remplacement unique puis son inverse ; empreinte avant = après dans tous les cas.
- Contrôle d'ensemble : `git hash-object` des 3 fichiers après le lot = avant (« IDENTIQUES »).

| # | Fichier | Mutation | Test rouge (motif) | avant → muté → après | rc rouge / vert |
|---|---|---|---|---|---|
| M01 | CombatConsole.tsx | `cc-lbl` rendu dans la case | C-4 « « Arme simple » grave son libellé » | 5563b4d3da → e9233acaf4 → 5563b4d3da | 1 / 0 |
| M02 | CombatConsole.tsx | sans `fallback={{}}` | C-4 « aucune infobulle ouverte au survol de « q-objet-i-fiole » » | 5563b4d3da → 6b8a6b12a0 → 5563b4d3da | 1 / 0 |
| M17 | CombatConsole.tsx | sans `instance={cell.label}` | C-4 « « Charger » : son infobulle ne la nomme pas » | 5563b4d3da → d73679fcc0 → 5563b4d3da | 1 / 0 |
| M03 | CombatConsole.tsx | X de retour sur la vignette | (a) « la touche X est gravée plus d'une fois » | c0736c5f56 → 605ea8203d → c0736c5f56 | 1 / 0 |
| M04 | CombatConsole.tsx | touche = état du tour | D-3 « expected 'Action non dépensée' to be 'ESPACE' » | c0736c5f56 → 8c73267c63 → c0736c5f56 | 1 / 0 |
| M05 | combat-console.css | `--cc-bande: 18vh` | F-1 « bande 18.0 % » | 04f02fae7c → 21ec2a93bc → 04f02fae7c | 1 / 0 |
| M06 | combat-console.css | fronton 52px fixe | F-1 « empreinte 23.7 % » | → e96acc46b5 → | 1 / 0 |
| M07 | combat-console.css | `--cc-cell: 40px` à ≤700 | F-2 | → 96f08e9d6f → | 1 / 0 |
| M08 | combat-console.css | côté sans plafond de largeur | F-3 | → 01e9ce520f → | 1 / 0 |
| M09 | combat-console.css | icône 0,5 | F-4 | → 9a493cb33d → | 1 / 0 |
| M10 | combat-console.css | portrait = arch-h | G-3 | → fb75830b52 → | 1 / 0 |
| M11 | combat-console.css | plancher deck − liseré | plancher « 180.6 to be 183.6 » | → 0032e3bf5e → | 1 / 0 |
| M12 | combat-console.css | miroir fixe | P-4 « 701×780 : la rangée et sa réserve débordent » | → d609d0360d → | 1 / 0 |
| M13 | combat-console.css | `.cc-cell[data-hotkey]` de retour | R-7bis | → f8446bc088 → | 1 / 0 |
| M14 | combat-console.css | `.cc-set-n` de retour | E-4 | → 42cdd5bc77 → | 1 / 0 |
| M15 | combat-console.css | visage = `var(--cc-portrait)` | C-1 | → 404c6f424c → | 1 / 0 |
| M16 | combat-console.css | portrait + 10px | E-3 « portrait trop grand pour l'arche » | → 093c2b861b → | 1 / 0 |
| S1 | hud-clickables.mjs | `bande: 0.18` | « bande du pont au-delà de 17 % » | 2428628782 → 2e9bd31674 → 2428628782 | 1 / 0 |
| S2 | hud-clickables.mjs | `part` sans saillie | « FRONTON compris … » | → 676d233dfa → | 1 / 0 |
| S3 | hud-clickables.mjs | colonne ≥701 seulement | « mesures saines aux quatre tranches » | → 12ebf050f6 → | 1 / 0 |
| S4 | hud-clickables.mjs | verdict aveugle muet | « bande ou arche non mesurée » | → 5efd5b936b → | 1 / 0 |

- Première passe de M02 restée VERTE (le fixture n'avait aucune case sans fiche) : le test a été renforcé par une fiole custom, puis M02 et M01 ont été rejoués.
- M01, M02 et M17 portent le hash 5563b4d3da, parce que `instance` a été ajouté après la première passe.

## Recette navigateur (`scratchpad/c1/recette.mjs`, joueur réel pour les gestes)
- **Setup par `__wfrp`** : scénario, `fight`, `turn` au héros. Barre posée : `capacites: { 1: null }`, soit une case vide intercalée (grille « Course, ·, Mouvement… »). « Commencer le combat » est cliqué réellement.
- **État A** : 2 sets sur 3 vignettes (`["tenu","set","vide"]`), action non dépensée : touche ESPACE, état « Action non dépensée » en description.
- **État B** : case refusée « Immunité Psychologie (0) ».
  - Survol par souris CDP réelle : l'infobulle s'ouvre avec la raison, le nom de la capacité, puis la fiche.
  - Focus : **Tab n'est pas un chemin de focus en combat.** Il est lié à `target-next` (`src/state/keybindings.ts:333`, mesuré : Tab ne déplace pas le focus). Le focus est donc posé par `el.focus()`, qui est le chemin de la manette (`useGamepad`) : `actif: true`, infobulle ouverte, même texte.
- **État C** : tour adverse, forme spectatrice, clic à côté de l'arche → `svg.iso-stage`.
- **Captures** : 32 PNG sous `scratchpad/c1/apres/`, empreintes dans `scratchpad/c1/apres.sha256` (préfixe de 12 caractères) :
  - A-1707x780 f8e9cbeda6fe · A-1366x650 dfd370dc9e24 · A-901x780 6ee128b89abf · A-900x780 ebdf91af74ca ;
  - A-701x780 a868ae0e779f · A-700x780 6833ca73eade · A-640x780 544613ccc3ae · A-360x740 5dd390fa5e74 ;
  - B-*-survol / B-*-focus : 1707 c33eb44b5f12 / 2f4b3c26cee0, 1366 be5e5d14d5db / ba7b4cce6c79, 901 8d63395a76e7 / b482e42c58fa, 900 f9337ea8a280 / 78f869fc905c, 701 db0b0c29d719 / dfc9440daa57, 700 5ef1bde6ab55 / 51d7af49fc1a, 640 8ac5c2841d4a / 7085daee30f4, 360 6293246972f8 / 309e6968b5ae ;
  - C : 1707 bf900352b928, 1366 9517d06b6bb8, 901 76d0c8e7223b, 900 ea3f16500f7e, 701 91e8e272e687, 700 1164ae57c1b7, 640 ff3bb1e482e3, 360 20b6ca028915.
- **Console** : 1 erreur, préexistante et hors périmètre : `TypeError: Cannot assign to read only property 'loaded'` dans `unloadWeapon` (`src/engine/items.ts:708`), à l'attaque d'IA.
- **Limite** : je n'ai aucun outil de lecture d'image. Les verdicts viennent du DOM ; les captures restent à lire par le juge.

### Chiffres par vue (sonde de recette, état A ; C identique en bande et total)
| Vue | Bande % | Total % | Case px | Icône px | Portrait px | Rangées | Δ centre arche |
|---|---|---|---|---|---|---|---|
| 1707×780 | 17,0 | 21,8 | 42,3 | 25,4 | 108 | 1 (2 tops : fronton + régions) | 0 |
| 1366×650 | 17,0 | 21,8 | 31,3 | 18,8 | 79,7 | 1 | 0 |
| 901×780 | 17,0 | 21,8 | 42,3 | 25,4 | 49,4 | 1 | −42 |
| 900×780 | 17,0 | 21,8 | 42,3 | 25,4 | 48,5 | 1 | −42 |
| 701×780 | 17,0 | 21,8 | 28,1 | 16,9 | 30 | 1 | −29,7 |
| 700×780 | 30,3 | 30,3 | 42,3 | 25,4 | 30 | 2 (ligne d'arche + travées) | — |
| 640×780 | 30,3 | 30,3 | 42,3 | 25,4 | 30 | 2 | — |
| 360×740 | 42,3 | 42,3 | 36 | 21,6 | 30 | 3 | — |

- « Rangées » compte les rangées de régions de la console. À ≥701, la sonde relève 2 `y` distincts, parce que le fronton s'élève au-dessus des régions ; c'est une seule rangée.
- Aucune case hors écran et aucun débord de région, aux 8 vues.
- Δ centre ≠ 0 de 701 à ~1000 : la réserve miroir y est payée par les cases (clamp), le fronton se décale de (coin + écart) / 2 au plus.

## Sonde étendue (`scratchpad/c1/sonde-finale.txt`, exit 1, 32 défauts ; H1b : 67)
- **Couche** : 84 vues, 75 OK.
- **Disparus contre H1b** : 47 lignes (`scratchpad/c1/defauts-h1b.txt` contre `defauts-c1.txt`) :
  - tout 700 en tour de héros (rail, journal, dossier, frise, groupe, fil rognés ou recouverts) ;
  - 900 (« Dague », « Mains nues » à x = −36,6, case recouverte par un `svg`) ;
  - le pont à 24 % à 1707.
- **Apparus : 9, une seule classe** : le fil d'événements déborde de sa zone `temps` à 700, dans les états ouverture, héros et spectateur, de 1,6 à 53,6 px dans la rangée `reserve`.
  - Cause : la frise est désormais en colonne à 561–700. Sa piste se borne à `100cqh` de la zone (`initiative-strip.css`, `--is-avail`) sans réserver le fil, qui partage la zone.
  - Au-dessus de 700, le flanc est large et le fil se pose à côté de la frise ; à 700, le flanc fait 135 px et le fil passe dessous.
  - Le fil n'est ni rogné ni recouvert, et reste visible. Je n'ai pas trouvé de correctif qui garde l'arrondi au pas d'entrée (R-M3) : c'est le contrat de zone de H1 (frise et fil dans `temps`), à trancher.
- **Préexistants inchangés** :
  - « au trait en bas » à 1707, 1100, 900 et 700 ;
  - §12 « vie non superposée » à 700 ;
  - compacité à 900 et 700.

## Portes (sortie brute sous `scratchpad/c1/`, code lu sans pipe)
| Porte | Code | Résultat |
|---|---|---|
| `npm run typecheck:fast` (`tc3.txt`) | 0 | 0 erreur |
| `npx vitest run --no-cache`, 56 fichiers (importeurs par `git grep` de CombatConsole, CampaignView, hotbarBridge, registry, hud, initiative-strip, combat-banner, CodexRef, plus comment-poison-guard, css-modules-guard, primitive-owners-guard, InitiativeStrip, PartyDock, Layout, camera-sans-plaque) (`vitest.txt`) | 0 | 893 réussis, 2 todo |
| `node --test scripts/recette/hud-clickables.test.mjs` (`nodetest.txt`) | 0 | 93 / 93 |
| `console-pont-formes.mjs` (réel) (`pont-formes.txt`) | 0 | aucune amputation, bande stable dans les 3 formes à 9 vues |
| stock `--check` (`stock.txt`) | 0 | « Stock à jour » (régénéré : identité 1751, espacement 696) |
| ventilation contre `fc2388866` (`ventil.txt`) | 0 | identité 1770 → 1751, DISPARU 19, **APPARU 0** ; espacement 702 → 696, DISPARU 6, **APPARU 0** |
| eslint, 8 fichiers (`eslint.txt`, `eslint2.txt`) | 0 | 0 erreur ; l'avertissement `g` inutilisé est corrigé |
| `npm run docs:build` / `docs:check` (`docsbuild.txt`, `docscheck.txt`) | 0 / 0 | OK |

## Écarts à juger
1. **Plafond de largeur du portrait** : il n'est pas dans la décision ; il est nécessaire à la cote de 28 px à 701.
2. **561-700** : pont à 30,3 % contre ≈ 19 % visé. La ligne d'arche mesure 100 px.
3. **Le coin garde `.cc-lbl`** (seul nom gravé) : la réutilisation de la classe évite tout site d'identité neuf.
4. **La case vide garde sa touche** imprimée : lecture de « vitre nue » à trancher.
5. **La plaque X ne se replie pas à ≤560** : le commutateur n'a plus de repli sur l'arbre.
6. **État B, focus** : il passe par `el.focus()`, parce que Tab est lié au ciblage en combat.
7. **`--cc-bay-pad: 8px`** reprend la valeur littérale de `.cc-bay { padding: 8px 8px 10px }`. Remplacer ce littéral aurait créé un site d'espacement APPARU. C'est une duplication nommée au commentaire.

## Hors périmètre (constaté)
- `src/engine/items.ts:708` : l'erreur console ci-dessus.
- `combat-console.css:529` : « Dette nommée : `ItemIcon` devrait accepter une longueur CSS », une excuse sans ticket. Le commentaire « excuse #1806 » de F8 est introuvable sur cet arbre.
- À 360, le nom de l'arche (`.cc-arch-name`, ellipse) déborde de 1 px : « Klein Bürger » dans 55,8 px, tranché dans un mot (R-M2). Préexistant.
- À 701×780, la couche HUD mesure 710,6 px de large (> 701) : le rail déborde de 1,6 px à droite. C'est une largeur minimale de la grille de couche (H1), hors console.

## Processus
- **Serveur de dev** : `setsid timeout 5400 npm run dev`, PGID 14921, port 5236. Tué par `kill -TERM -14921`.
  - Incident : un premier `kill` par `pgrep -f` a visé le groupe de mon propre shell (PGID 3837, sortie 144), sans autre effet.
  - Vérifié : `ps` ne montre ni `vite`, ni `esbuild`, ni `timeout`, ni chrome ; `curl` rend 000.
- **Chromium** : chaque `openApp` (recette ×4, sonde ×2, `console-pont-formes` ×2, probe ×3, focus-probe) est fermé dans son `finally`.
- **Mutations** : `muter.py` a été lancé en premier plan borné (`timeout 3000`), puis basculé en arrière-plan par le harnais au bout de 600 s (tâche b9jrlz3lu). Terminé, exit 0.
- Aucune tâche ne survit.
