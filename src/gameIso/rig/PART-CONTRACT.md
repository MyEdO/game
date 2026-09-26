# Contrat de part du rig — repère et gabarit par slot

Spec à respecter pour dessiner une **part** SVG du rig (cosmétique, tenue, armure, arme).
Le placement des OS (pivots/longueurs, canon d'emboîtement art⇄squelette) vit dans
`SKELETON-CONTRACT.md` (#633 P3) — les étendues par slot ci-dessous en sont le pendant côté art.
Le § FORMAT ci-dessous ne couvre pas tous ces registres : il dit son périmètre exact.
Toute part est un fragment SVG (sans `<svg>` wrapper) attaché à un **os** ; le rendu la place
via la matrice monde de l'os puis l'échelonne par `(sx, sy) = thickness/réf, length/réf`.

## FORMAT — `ViewSet` TOTAL par slot de corps (contrat cible)

Un slot de **corps** (`tete` / `torse` / `jambes` / `bras` / `avantBras`) se résout, au runtime, en un
**`ViewSet` TOTAL** (`parts/types.ts`) : `{ front, back, profile }` — les trois vues sont
**GARANTIES**. L'accès se fait par `pickBodyView(art, view)` = `art[view]`, **sans repli** : une vue
manquante est une **erreur de compile**, plus jamais un `?? art.front` silencieux. (La forme
`PartArt` = `string | { front, back?, profile? }` survit pour les registres à **repli DÉCLARÉ** —
armes, boucliers, appendices, têtes de race, injections monstrueuses — servis par `pickView` ;
elle n'est **plus** la porte de sortie des slots de corps.)

Les **defs** de tenues/armures déclarent un `PartArt` partiel (`string` front-only, ou objet à vues
partielles) ; `resolveParts` (`parts/resolve.ts`) les totalise en `ViewSet` **au point d'ingestion**,
par `toViewSet(slot, art, opts)` (`parts/derive.ts`) :

| Vue du slot | Source |
|---|---|
| `front` | l'art fourni (string, ou `art.front`) |
| `profile` / `back` | la vue **DÉCLARÉE** du def si présente ; **sinon DÉRIVÉE** du front (`deriveViews`) |

La **dérivation** (`parts/derive.ts`, décision **D3** : ces helpers sont destinés à être
**matérialisés dans les defs** — un def porte à terme ses 3 vraies vues, plus de dérivation runtime) :

| Slot dérivé | Helper | Sortie |
|---|---|---|
| `torse` / `jambes` / `tete` | `deriveViews` (`PROFILE_TORSE`/`BACK_JAMBE`…) | silhouette générique en TOKENS du tissu dominant (`dominantCloth`) — **le front n'est jamais plaqué** |
| `bras` / `avantBras` | `derive{Profile,Back}Bras` / `derive{Profile,Back}AvantBras` (**neufs**) | vraie silhouette de profil/dos, scindée au coude (#633 D1) — fin du **front plaqué** (défaut historique du slot `bras`) |

> Les helpers peignent en **tokens existants** (`@vet1`/`@cuir`/`@peau`…) — jamais un hex neuf.

### Décisions cadrant les phases suivantes

- **D1** — le bras est **scindé au coude** (bras + avant-bras) : **livré (P0, #633)**. `bras` =
  épaule→coude (os `epauleG/D`, y −2..+18) ; `avantBras` = coude→poignet (os `avantBrasG/D`,
  y 0..+16, ré-origine au pivot du coude). La vraie main (`HAND`, `resolve.ts`) s'emboîte au
  poignet réel (`main.pivot.y = avantBras.length = 18`) — le moignon `WRIST` est mort. Les
  tenues/armures non recoupées gardent leur art de bras ENTIER sur l'os épaule + une silhouette
  d'avant-bras dérivée (pas de trou) : leur recoupe est P4.
- **D2** — les **armes** porteront **3 vraies vues** : *à venir* (P4) ; aujourd'hui `arme`/`bouclier`
  sont front-only, plaqués verbatim de profil/dos (hors périmètre P1, cf. ci-dessous).
- **D3** — les helpers `derive*` sont **matérialisés dans les defs** : le shim P1 est l'étape de
  transition ; en P3 les defs portent leurs vues et `toViewSet` disparaît.
- **D4** — **pas de visage de dos** : **livré P2** (#633) — `cosmeticPart` sert `{ front: visage,
  back: BACK_CRANE (crâne plein, même empreinte que le disque visage front, surchargeable par
  `HeadDef.crane`), profile: PROFILE_FACE }`. Le **corps de base garanti crâne+cou** est également
  livré P2 : le slot `cou` (os `cou`, `NECK` de `resolve.ts`) est TOUJOURS résolu, indépendant de la
  tenue/coiffure ; `cou.z` (skeletons.ts) est sous le torse — un col de tenue le couvre par le tri
  du peintre, sans patch par tenue (l'ancien cas spécial `composeRig.tsx` visage/back est retiré).

### Des 3 vues aux 8 directions

Une part n'est dessinée qu'en **3 vues** (`front` / `profile` / `back`) ; le **profil est tourné vers
la droite**, le profil gauche s'obtient par **MIROIR** dans la machinerie de rendu (jamais dans l'art).
La sélection vue+miroir pour une orientation monde `Dir8` et un cran caméra vient de l'unique
résolveur `project(dir8, camRot)` (`facing.ts`, **inchangé**) → 8 directions couvertes par 3 vues + un
flip horizontal.

### Périmètre GARDÉ (et ce qui ne l'est pas)

Le **cliquet de format** (`parts/tenues/part-view-format.test.ts`) mesure, sur les **defs bruts**,
lesquels ne portent **pas encore** leurs 3 vraies vues (dette à solder en dessinant) :

| Registre | Clé de stock | Gardé |
|---|---|---|
| **Tenues** (`parts/tenues/defs/`) | `<tenueId>:<slot>` | oui |
| **Armures** (`parts/armour/defs/`) | `armure:<materiau>:<slot>` | oui — elles **priment** sur la tenue (`resolve.ts`, `armed ?? tenuePart`) |

Registres **hors** garde :

- **Armes** (`parts/weapons/defs/`) et **boucliers** (`parts/shields/defs/`) — slots `arme`/`bouclier`,
  qu'aucun `ViewSet` ne couvre en P1 : un art front-only y est **plaqué verbatim** de profil et de dos
  (via `pickView`). Mesuré 2026-07-17 : **89 des 90** formes d'arme et **4 des 4** boucliers sont
  front-only — c'est la **décision D2** (P4), pas une propriété du format.
- **Visages** (`parts/heads/`) — `cosmeticPart` (`parts/cosmetic.ts`) enveloppe TOUJOURS le visage en
  `{ front, back: BACK_CRANE, profile: PROFILE_FACE }` avant `resolveParts` (D4, #633 P2). Les
  chevelures portent leurs 3 vues par type (`HairArt`).

Une vue **recopiée** sur le front satisfait la lettre du format mais produit le défaut qu'il vise à
tuer : refusée au même titre (**anti-alias**). La garde compare des **géométries**, donc l'espace
ajouté, le commentaire, le `<g>` enveloppant et le simple **recoloriage** du front sont refusés eux
aussi. Deux stocks gelés dans `scripts/guards/lib/rigPartViewStock.mjs` (`PART_VIEW_RATCHET` =
slots front-only, `PART_VIEW_ALIAS_RATCHET` = vues recopiées), en entrées `{ fichier, ref,
occurrence }` régénérées par `npx tsx scripts/rig/regen-part-view-stock.mts` (`--check`). Le
mécanisme est l'**ÉCART NOMINATIF** (`ecartDuVolet`, `scripts/guards/lib/stock.mjs`), **aucun
plafond** : un site hors stock échoue (*neuves*), une entrée que plus aucun site ne porte échoue
(*périmées*) — une dette ne peut pas croître **sans se déclarer**, et c'est l'entrée qui NOMME son
fichier que la porte de plage (`croissanceDesStocks`) voit à l'append. La garde exerce le chemin RÉEL
(`resolveParts` + le discriminant de format `hasProfileView`/`hasBackView`, `parts/types.ts`), jamais
une réplique, et ses évasions connues sont testées (`describe('morsure')`). **Se solde en DESSINANT
la vue, jamais en allongeant la liste.**

## Règles générales

- **Boîte figure** : 120×150, pieds en (60,150), tête en haut. Mais une part se dessine dans
  le **repère LOCAL de son os** : **origine (0,0) au pivot (l'articulation)**.
- **Sens des axes** : +x = droite, **+y = vers le bas de l'écran** (SVG standard). Pour les
  membres, +y va du joint vers l'**extrémité distale** (épaule→main, hanche→pied).
- **Gradients partagés** (définis une fois dans `defsGlobaux()`, cf. sprites.ts) : `g_steel`, `g_steelD`,
  `g_cloak`, `g_robe`, `g_coat`, `g_axe`, `g_glow`, `g_eye`, `g_crest`, `g_hVest`. Leur couleur est
  FIXE : ils ne suivent pas la palette (#1903).
  Un dégradé qui suit la palette est un **dégradé DÉRIVÉ** `url(#dg-<forme>-<arrêt>-<arrêt>…)` : un
  arrêt est un jeton `@clé` (`@vet1H`, `@cuirO`…) ou un littéral `#rrggbb`, et `applyTokenMap` le
  résout en `<linearGradient>` dont l'id est le contenu. La table des formes (axe, arrêts) est
  `FORMES_DE_DEGRADE` de `palette.ts`. Un arrêt littéral reste de la DETTE de littéral, comptée par le
  cliquet `palette-literal.test.ts` comme un `stop-color`. L'art du rig ne définit aucun
  `<linearGradient>`/`<radialGradient>` local (gardé, `parts/references-degrade.test.ts`).
  Sinon couleurs hex — MAIS **jamais pour la CHAIR** (voir ci-dessous). Matériaux d'armure : cuir
  `#6a4a2a`, maille `url(#g_steelD)`, plaque `url(#g_steel)`, rembourré `#9a8a6a`.
- **MATIÈRE vs PORTEUR — distinction obligatoire (#583 chair, #599 flanc jumeau cheveux).** Une
  couleur en dur est légitime pour la **matière propre à la tenue** (le cuir de CETTE veste, son
  acier — une couleur qui lui appartient, à elle, pas au porteur). Elle est **INTERDITE pour les
  jetons du PORTEUR** — chair (`@peau`/`@peauO`/`@peauH`) ET chevelure
  (`@cheveux`/`@cheveuxO`/`@cheveuxH`) — qui appartiennent au PERSONNAGE et doivent TOUJOURS
  suivre les jetons résolus par `raceAppearance.json` au moment du rendu, jamais un littéral hex.
  Un dégradé de chair est le dégradé DÉRIVÉ `url(#dg-v-@peauH-@peauO)`, résolu par `applyTokenMap`
  (`palette.ts`) à la passe du porteur (#1903 D2). Plus largement : tout littéral hex qui vaudrait EXACTEMENT une valeur déjà
  déclarée dans la `palette` du def (chair, cheveux, cuir, tissu, plume…) est une faute — c'était
  le jeton `@<clé>` qu'il fallait peindre (gardé, `parts/tenues/palette-literal.test.ts`,
  cliquet). Piège symétrique côté cheveux : un jeton `@cheveux*` DANS l'art d'une tenue n'est
  légitime que s'il peint RÉELLEMENT la chevelure du porteur (dans ce cas, la `palette` ne le
  déclare PAS, cf. règle suivante — l'art suit l'espèce). S'il peint une AUTRE matière (guimpe,
  capuche, coiffe) qui ressemble à s'y méprendre à des cheveux, c'est le jeton qui est FAUX :
  renommer l'usage vers un jeton de vêtement dédié (ex. `Nonne.ts`, guimpe → `@voile*`), jamais
  laisser `@cheveux*` peindre du tissu.
- **La `palette` d'une tenue, d'une arme ou d'une armure n'a PAS le droit de déclarer une clé porteur
  (`PORTEUR` : `peau`, `cheveux`, `yeux` et leur gamme)** — seule l'espèce les donne (gardé,
  `parts/no-porteur-in-palette.test.ts`, #583, #599). Le piège vécu : l'ART peignait
  correctement `@peau`/`@peauO` (règle ci-dessus respectée), mais la `palette` du def déclarait
  AUSSI ces clés avec une teinte figée — `tenuePaletteFor` prime sur l'espèce dans l'empilage
  (`couchesDuRig`), donc ce jeton se résolvait à la couleur de la TENUE, pas à celle du
  porteur (17 tenues sur 117 pour la chair, 5 sur 117 pour les cheveux — la palette
  merge étant UNIQUE pour tout le rig, la fuite recolorait aussi le bone `cheveux` cosmétique
  SÉPARÉ, layer 1 sous la tenue, cf. `bones.ts::SLOT_LAYER`). Une tenue déclare cuir/tissu/métal ;
  jamais chair ni chevelure.
- **Échelle** : NE PAS compenser la morphologie — dessiner au gabarit de référence (humain M).
  Le moteur scale la part par l'os. Les armes/boucliers sont scalés **uniformément**.
- **Miroir** : les slots `bras`/`jambes` sont dessinés UNE fois (côté gauche) ; le côté droit
  est rendu en miroir automatiquement. Dessiner pour le côté gauche/neutre.

## Gabarit par slot (repère local de l'os, échelle de référence)

| Slot | Os porteur | Origine (0,0) | Étendue attendue | Notes |
|---|---|---|---|---|
| `visage` | tete | base/centre tête | x −9..9, y −2..16 | cercle ~r9 cy7 + yeux ; toujours présent |
| `cheveux` | tete | idem | x −10..10, y −8..22 | F peut descendre plus bas ; masqué sous heaume fermé |
| `tete` (coiffe/casque) | tete | idem | x −10..10, y −16..6 | bandeau/heaume ; vide = tête nue |
| `cou` | cou | pivot (base du cou) | x −4..4, **y −16.5..+4.5** | cylindre chair `@peau` (art SYSTÈME `NECK`, redessiné avec le squelette) ; y=0 = base (sommet du torse), y≈−16.5 = bas du crâne (attache `tete` à −16), +4.5 plonge dans le col qui le recouvre ; toujours présent |
| `torse` | torse | taille de l'ART (col −32, ceinture +15..20 = hanches, ourlet +34 = mi-cuisse) | x −16..16, **y −32..+50** | robe jusqu'à +50 ; l'ourlet ne doit pas descendre sous le genou (cf. SKELETON-CONTRACT) |
| `bras` | epauleG/D | épaule | x −4..4, **y −2..+18** | épaule → coude (#633 D1) |
| `avantBras` | avantBrasG/D | coude | x −4..4, **y 0..+16** | coude → poignet (#633 D1) ; ré-origine au pivot du coude, la main l'emboîte au poignet |
| `jambes` | cuisseG/D | **hanche** | x −5..5, **y 0..+50** | **y=0 = hanche**, +y descend vers la cheville (cuisse+tibia ≈ 50) |
| `pied` | piedG/D | **cheville** | x −4..4, **y −1..+10** | cheville → sol ; de **profil**, la pointe (orteils) va vers **+x** ; repli Nu de l'ESPÈCE lisse (`PLAINFOOT`) ou griffu (`CLAWFOOT`, `bodies/extremites.ts`) — une botte est TOUJOURS un HABIT de tenue (`tenues/botte-gabarit.ts`), jamais un repli |
| `main` | mainG/D | **poignet** | x −3..3.5, **y −2..+7.7** | poignet → doigts refermés ; repli Nu de l'ESPÈCE lisse (`HAND`) ou griffu (`MAIN_GRIFFUE`, `bodies/extremites.ts`) ; agrippe arme/bouclier, peinte sous l'arme par z |
| `arme` | arme (main D) | poignée dans la main | x ±15, **y −50..+10** | lame/tête vers −y (haut), pommeau vers +y ; échelle uniforme |
| `bouclier` | bouclier (main G) | centre dans la main | x −12..12, y −10..+22 | échelle uniforme |

> Attention : le slot `jambes` se dessine **du haut (hanche, y=0) vers le bas (cheville, y≈50)** —
> c'est la convention réelle du code (cf. generic/career/armour jambes : `<rect y="0" height="50">`).

### Précédence d'équipement

Chaîne UNIQUE, la même pour **tout** slot de corps (`tete`/`torse`/`jambes`/`bras` ET les
extrémités `pied`/`main`/`cou`) :

```
override éditeur (appearance.parts[slot]) → armure équipée (zone) → tenue de carrière (zone) → Nu de l'ESPÈCE (zone)
```

- `tete`/`torse`/`jambes` : la table inline de `resolveParts` (`parts/resolve.ts`) — `armed ??
  tenuePart ?? générique`, l'override forçant `tenuePart ?? générique` en amont.
- `bras`/`avantBras` : même chaîne mais résolue en UNITÉ par `resolveUpperLimb` (le membre se
  découpe au coude après avoir choisi le gagnant, #633 D1).
- `pied`/`main`/`cou` : `equipWinner(slot, overridden, equip, tenueArt)` (`parts/resolve.ts`) —
  override → `armourPart` (armure équipée) → art de tenue ; `undefined` (aucune source ne pilote
  la zone) laisse l'appelant appliquer le repli `PIED_NU`/`MAIN_NUE` (Nu de l'ESPÈCE, lisse ou
  griffu selon `extremites`, `bodies/extremites.ts`). Le `cou` est en plus une **SURCOUCHE** : `NECK`
  (chair d'espèce) est TOUJOURS peint en sous-couche garantie, le gagnant de la chaîne (col,
  gorgerin) est peint PAR-DESSUS — le cou nu reste garanti même sans tenue/armure au cou.

**Armure PRIME sur la tenue** (`resolve.ts`, `armed ?? tenuePart`) sur les 4 slots de corps de base
ET sur les extrémités. Une **armure SYNTHÉTISÉE depuis les PA d'un statblock sans inventaire**
(`synthArmour`, `enemyProfile.ts`) ne produit **par défaut AUCUN item** — les PA restent une
mécanique PURE (dégâts/zoneBadges/enc), sans impact sur l'apparence — sauf si l'entrée bestiaire
coche `appearance.armurePortee` (`src/data/creatures.json`) : optée, l'armure synthétisée rend
alors son art **PLEINEMENT**, zones dérivées `pied`/`main`/`cou` comprises (gantelets/solerets/
gorgerin) [entériné 2026-07-22, #774 : « Les PA ne devrait pas impacté l'apparence, sauf si on le
décide » — ni troll bardé de plaques ni garde nu]. Curation par créature : soldats/chevaliers
optés, démons/trolls/peaux-dures naturels.

## Ordre de calque

- **Inter-os** : `bone.z` (jambes 3..6 < cou 4.5 < torse 5 < bras 4..8 < tête 7 < arme 9).
  L'asymétrie D>G (membre proche) ne vaut qu'en `profile` : de face/dos, `composeRig` symétrise
  le z des jambes sur la gauche (3) — la jambe droite ne s'imprime jamais sur l'ourlet du torse.
- **Intra-os** (`SLOT_LAYER`) : sur la tête `visage(0) < cheveux(1) < coiffe(2)` ;
  sur le torse `jambes(0) < torse(1) < bras(2)`.

## Slots pilotés par quoi

- `arme`/`bouclier` ← équipement porté (famille d'arme / bouclier).
- `tete`/`bras`/`torse`/`jambes` ← **armure équipée couvrant l'emplacement** (matériau) →
  sinon **tenue de la classe de carrière** → sinon générique.
- `visage`/`cheveux`/`cou` ← toujours, par espèce × sexe (le `cou` est système, aucune tenue ne le porte).
- Override éditeur (`appearance.parts[slot]`) prime sur tout.

## Contrat de sortie pour un agent-artiste

Renvoyer, par part demandée : `{ slot, svg }` où `svg` est le fragment respectant le repère
ci-dessus (origine au pivot, +y distal, étendue dans le gabarit, gradients partagés). Pas de
`<svg>`, pas de `transform` racine (le moteur s'en charge). Tester par rendu dans la galerie QC
(`scripts/gen-rig-gallery.mts`) avant d'intégrer.
