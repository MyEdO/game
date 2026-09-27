# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `<ABRÉV> NN l.X` dans `src/`, tous livres) absentes de l'Atlas. **Sens B1** = lignes de
> l'Atlas marquées « (non implémenté) », tous docs, ventilées par état de dette. **Sens B2** =
> chapitres que l'Atlas décrit hors du code, par livre de CŒUR (champ `coeur` de `books.json`),
> après crédit du folio d'une donnée et de la dette de fiche déclarée au manifest.
> Tolérance ligne = ±20.

**Sens A — code → Atlas (tous livres)** : 12 chapitre(s)-livre cités par le code & absents de l'Atlas · 11 chapitre(s)-livre couverts avec des lignes non pinées · 0 réf(s) sans chapitre (non réconciliables par cette mesure). Réfs folio (`ABBR NN p.X`, #606) côté Atlas : 2 ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre).
**Sens B — Atlas → code** : 19 marqueur(s) « (non implémenté) » (tous docs), dont 17 sous dette déclarée, 0 sans entrée et 2 hors champ Implémente · LDB (cœur 4e) : 1 chapitre(s) cité(s) par l'Atlas jamais référencé(s) dans le code (avant crédits : 12 · 11 crédité(s) par une source folio de `src/data` · 0 sous dette de fiche déclarée) · CRB (cœur 5e) : 0 chapitre(s) cité(s) par l'Atlas jamais référencé(s) dans le code (avant crédits : 47 · 0 crédité(s) par une source folio de `src/data` · 47 sous dette de fiche déclarée).

## A0 — Résumé Sens A par livre

| Livre | Cœur | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|---|
| ADE I | — | 1 | 1 | 0 |
| ADE II | — | 0 | 1 | 0 |
| EDO | — | 1 | 2 | 0 |
| EDOC | — | 2 | 2 | 0 |
| MCLB | — | 1 | 0 | 0 |
| MDG | — | 2 | 1 | 0 |
| MSRC | — | 1 | 2 | 0 |
| NADJ | — | 2 | 1 | 0 |
| PDT | — | 2 | 0 | 0 |
| VDM | — | 0 | 1 | 0 |

## A1 — Chapitres appelés par le CODE, ABSENTS de l'Atlas (trous durs)

### ADE I 2 — 2 réf(s) code, 0 dans l'Atlas
- `src/data/talents.json:3207` (l.267) — "note": "ADE I 02 l.267"
- `src/data/talents.json:4821` (l.276) — "note": "ADE I 02 l.276"

### EDO 10 — 1 réf(s) code, 0 dans l'Atlas
- `src/data/skills.json:1896` (l.736) — "note": "EDO 10 l.736"

### EDOC 9 — 5 réf(s) code, 0 dans l'Atlas
- `src/engine/disease.ts:587` (l.21) — *  voyage (EDOC 09 l.21) passent par ici. No-op sur une maladie déjà active. */
- `src/state/travel.test.ts:441` (l.21) — it('saison froide + Exposition RATÉE : le Rhume commun contracté en route se DÉCLARE à la Phase d’arrivée (EDOC 8 l.92, EDOC 9 l.21)', () => {
- `src/state/travelFlow.ts:189` (l.21) — *  (EDOC 09 l.21, `declareArrivalDiseases`). */
- `src/state/travelFlow.ts:444` (l.21) — // après interruption retrouve celle du départ). Lue par la Phase d'arrivée (EDOC 09 l.21).

### EDOC 10 — 2 réf(s) code, 0 dans l'Atlas
- `src/data/reseau-routier.json:173` (l.30) — "note": "EDOC 10 l.30 — section « Postes de péage » ; tarif l.32."
- `src/data/reseau-routier.json:192` (l.11) — "note": "EDOC 10 l.11 — section « Patrouilles routières » ; la phrase reprend l.17, l'encadré « LES JUSTICIERS » (l.13-15) la coupant."

### MCLB 2 — 5 réf(s) code, 0 dans l'Atlas
- `src/data/creatures.json:57902` (l.2420) — "note": "MCLB 02 l.2420"
- `src/data/skills.json:971` (l.1844) — "note": "MCLB 02 l.1844"
- `src/data/skills.json:1568` (l.1322) — "note": "MCLB 02 l.1322"
- `src/data/skills.json:1578` (l.2426) — "note": "MCLB 02 l.2426"

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:68` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:636` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:1082` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:232` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

### MDG 6 — 1 réf(s) code, 0 dans l'Atlas
- `src/data/species.json:2623` (l.50) — "note": "MDG 06 l.50"

### MSRC 10 — 5 réf(s) code, 0 dans l'Atlas
- `src/data/naval-traits.json:12` (l.90) — "maison": "MSRC 07 l.94 gate le Critique de Superstructure sur « si le bateau dispose d'une cale » sans imprimer de Trait naval ; la cale rejoint le catalogue d
- `src/data/regles-optionnelles-partition.test.ts:58` (l.90) — // 1 → 2 (#1657 B3-2b-a) : le Trait `cale` porte MSRC 10 l.90 (le livre DIT la cale du navire
- `src/data/schemas/grammaire/formes-partagees.test.ts:412` (l.90) — // de Superstructure sur « si le bateau dispose d'une cale », MSRC 10 l.90 la dit du navire marchand).
- `src/ui/compendium/registry-enveloppe.test.ts:166` (l.90) — // gate le Critique de Superstructure dessus ; MSRC 10 l.90 le dit du navire marchand).

### NADJ 4 — 9 réf(s) code, 0 dans l'Atlas
- `src/data/schemas/defs-scenes/scene.ts:155` (l.72) — /** JOUEUR de taverne (`NADJ 04 l.72`) : `gameId` de `tavernGames.json`, mise de DÉPART en sous. */
- `src/scenes/test-scenarios/taverne-profil-standard.ts:10` (l.72) — * `NADJ 04 l.72`). Son dialogue ouvre la table (`openTavernGames`, `state/combatEffects.ts`) sur SON offre :
- `src/state/scene.ts:154` (l.72) — *  Le patron est AUTHORÉ dans la source, pas inventé : `NADJ 04 l.72` — « Elle jouera une partie de
- `src/state/tavern-npc-a-fiche.test.ts:6` (l.72) — *  · `NADJ 04 l.72` — « Elle jouera une partie de L'Impératrice écarlate avec quiconque lui propose,

### NADJ 14 — 5 réf(s) code, 0 dans l'Atlas
- `src/data/index.ts:851` (l.5) — *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
- `src/data/reglesOptionnelles.json:542` (l.5) — "ref": "NADJ 14 l.5",
- `src/data/schemas/defs/species.ts:60` (l.5) — *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
- `src/engine/creation.test.ts:135` (l.5) — describe('Gnome jouable — règle optionnelle (NADJ 14 l.5)', () => {

### PDT 8 — 1 réf(s) code, 0 dans l'Atlas
- `src/ui/mono-stake-ratchet.test.ts:73` (l.370) — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

### PDT 9 — 1 réf(s) code, 0 dans l'Atlas
- `src/ui/mono-stake-ratchet.test.ts:73` (l.285) — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

## A2 — Lignes appelées par le CODE non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

### EDOC 6 — 13/13 ligne(s) code hors couverture (propriétaire : —)
- l.11 — `src/data/reseau-routier.json:12` — "note": "EDOC 06 l.11 — normes du décret de Wilhelm le Sage (2453)."
- l.15 — `src/data/reseau-routier.json:26` — "note": "EDOC 06 l.15 — section « Routes principales »."
- l.19 — `src/data/reseau-routier.json:38` — "note": "EDOC 06 l.19 — section « Routes secondaires »."
- l.28 — `src/data/reseau-routier.json:79` — "note": "EDOC 06 l.28 — liste des compagnies de diligences de l'Empire."
- l.29 — `src/data/reseau-routier.json:90` — "note": "EDOC 06 l.29 — liste des compagnies de diligences de l'Empire."
- l.31 — `src/data/reseau-routier.json:113` — "note": "EDOC 06 l.31 — liste des compagnies de diligences de l'Empire."
- l.32 — `src/data/reseau-routier.json:124` — "note": "EDOC 06 l.32 — liste des compagnies de diligences de l'Empire."
- l.33 — `src/data/reseau-routier.json:135` — "note": "EDOC 06 l.33 — liste des compagnies de diligences de l'Empire."
- l.34 — `src/data/reseau-routier.json:146` — "note": "EDOC 06 l.34 — liste des compagnies de diligences de l'Empire."
- l.41 — `src/data/reseau-routier.json:157` — "note": "EDOC 06 l.41 — section « Les Diligences des Quatre Saisons » (hors de la liste l.27-34)."
- l.47 — `src/data/reseau-routier.json:101` — "note": "EDOC 06 l.47 — section « Les Diligences de la Tour du Roc »."
- l.55 — `src/data/reseau-routier.json:67` — "note": "EDOC 06 l.55 — section « Les Lignes Rochet » ; la surcote de 10 % est l.57."
- … +1 autres

### EDO 1 — 6/7 ligne(s) code hors couverture (propriétaire : 4e/combat.md)
- l.5 — `src/data/schemas/defs-scenes/narratif.test.ts:26` — source: { book: 'ennemi-dans-l-ombre', page: 12, note: 'EDO 01 l.5' },
- l.13 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:14` — * Promesse tenue, `EDO 01 l.13` : « Deux jours de diligence, bien sûr. À pied, le trajet devrait durer
- l.17 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:15` — * environ une semaine. » Emplacement du relais, `EDO 01 l.17` : « Son emplacement exact importe peu, du
- l.200 — `src/scenes/test-scenarios/96-presets-edo.ts:146` — // CHEMIN JOUEUR de « il leur propose une partie » (`EDO 01 l.200`) : sans lui, le rôle
- l.202 — `src/scenes/test-scenarios/96-presets-edo.ts:194` — // comme une perte de temps de jouer pour moins de 2/- » (`EDO 01 l.202`), soit 24 sous.
- l.340 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:20` — * D'où vient le `km` : `EDO 01 l.340` — « Une borne sur le bas-côté indique : « Altdorf, 180 km ». »

### MSRC 12 — 6/12 ligne(s) code hors couverture (propriétaire : 4e/combat.md)
- l.85 — `src/data/index.ts:2597` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.107 — `src/engine/naval-traits.test.ts:301` — it('Plat-bord : palier de LONGUEUR (grande barge ~30 m, bande ouverte au-delà de 20 m) → 45 CO / 60 Enc (MSRC 12 l.107/109)', () => {
- l.111 — `src/data/index.ts:2597` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.117 — `src/engine/naval-traits.test.ts:304` — it('Allégement : ALLÈGE la coque — weightEnc NÉGATIF (grande barge → −80 Enc, MSRC 12 l.117)', () => {
- l.137 — `src/data/schemas/defs/sea-weather.ts:102` — /** Gréement de course (MSRC 12 l.137) : DELTA de % voiles ajouté au tableau standard par aspect de vent. */
- l.140 — `src/engine/naval-traits.test.ts:191` — it('Gréement de course → −10 au Test de Navigation (MSRC 12 l.140) ; converti −1 DR d’équipage', () => {

### ADE II 4 — 4/5 ligne(s) code hors couverture (propriétaire : 4e/combat.md)
- l.41 — `src/state/interlude-activities.test.ts:319` — it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE II 4 l.41)', () => {
- l.43 — `src/state/interlude-activities.test.ts:337` — // ADE II 4 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
- l.46 — `src/state/interlude-activities.test.ts:303` — // ── Identifier un artefact magique (ADE II 4 l.46-59) ─────────────────────────────────────
- l.50 — `src/state/interlude-activities.test.ts:362` — it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE II 4 l.50)', () => {

### EDOC 13 — 4/10 ligne(s) code hors couverture (propriétaire : 4e/talents.md)
- l.125 — `src/data/mutations.json:1640` — "note": "EDOC 12 l.84 ; table p. 66 : EDOC 13 l.125"
- l.137 — `src/data/index.ts:1101` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).
- l.522 — `src/data/index.ts:1709` — /** Tirage PLURIEL et ALTERNÉ de Mutations au spawn (Marque de Tzeentch, EDOC 13 l.522-524 : « gagne
- l.524 — `src/data/talents.json:4916` — "note": "EDOC 13 l.524"

### MDG 15 — 3/51 ligne(s) code hors couverture (propriétaire : 4e/deplacement.md)
- l.461 — `src/data/naval-ports.test.ts:47` — it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
- l.468 — `src/data/naval-ports.test.ts:67` — it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
- l.474 — `src/data/naval-ports.test.ts:74` — it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {

### VDM 14 — 3/7 ligne(s) code hors couverture (propriétaire : 4e/magie.md)
- l.353 — `src/data/arcanePhenomena.ts:77` — /** Modificateurs de NIVEAU D'INCANTATION apportés par le lieu (`VDM 14 l.353`, l.437, l.489) —
- l.437 — `src/engine/castingNumber.test.ts:28` — it('Caverne de l’Attache : moitié ARRONDIE À L’INFÉRIEUR, Sorts de la Bête (VDM 14 l.437)', () => {
- l.489 — `src/data/index.ts:2137` — *  deux natures (`VDM 12 l.646-647`, `VDM 14 l.489`). */

### NADJ 16 — 2/20 ligne(s) code hors couverture (propriétaire : 4e/tests.md)
- l.119 — `src/engine/combat.ts:903` — *  (Middenball NADJ 16 l.119 : « en utilisant les règles habituelles relatives à l'Avantage »).
- l.133 — `src/scenes/test-scenarios/96-presets-edo.ts:195` — // Jeu posé : `dominos` ; le jeu du RAW, l'Impératrice écarlate (`NADJ 16 l.133-139`), manque à

### ADE I 6 — 1/1 ligne(s) code hors couverture (propriétaire : —)
- l.185 — `src/data/index.ts:1101` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).

### EDO 7 — 1/1 ligne(s) code hors couverture (propriétaire : 4e/combat.md)
- l.184 — `src/ui/mono-stake-ratchet.test.ts:73` — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

### MSRC 5 — 1/1 ligne(s) code hors couverture (propriétaire : —)
- l.113 — `src/state/riverVoyageFlow.ts:876` — // Réparateur de SUBSTITUTION (`MSRC 5 l.113-117`) : le −10 est DÉJÀ fondu dans la valeur jetée,

## A3 — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

_Aucune._

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) »

17 sous dette déclarée · 0 sans entrée de `src/data/raw.manifest.json` · 2 hors champ `**Implémente :**`.

- **00-index.md** L41 — hors champ Implémente (prose) — - **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non
- **4e/00-index.md** L18 — hors champ Implémente (prose) — le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
- **4e/bestiaire.md** L382 — bloqué — **Implémente :** (non implémenté)
- **5e/tests.md** L168 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L297 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L485 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L576 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L700 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L790 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L933 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1042 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1099 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1166 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1296 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1375 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1471 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1538 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1610 — dette #1873 — **Implémente :** (non implémenté)
- **5e/tests.md** L1659 — dette #1873 — **Implémente :** (non implémenté)

### Dettes de FICHE — ce qu'elles couvrent ENCORE

- **5e/tests.md** (#1873) — couvre 16 topic(s) sur 16

## B2 LDB (cœur 4e) — Chapitres cités par l'Atlas, jamais référencés dans le code

_Avant crédits (12)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39

_Crédités par une source folio de `src/data/*.json` (11, donnée référencée sans réf de ligne)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 39

_Sous dette de fiche déclarée (0, toutes les fiches qui décrivent le chapitre sont ticketées)_ : —

**VRAIS hors-code (après crédits) :**
LDB 38

## B2 CRB (cœur 5e) — Chapitres cités par l'Atlas, jamais référencés dans le code

_Avant crédits (47)_ : CRB 4 · CRB 6 · CRB 7 · CRB 8 · CRB 9 · CRB 10 · CRB 11 · CRB 12 · CRB 16 · CRB 17 · CRB 20 · CRB 21 · CRB 22 · CRB 23 · CRB 24 · CRB 25 · CRB 26 · CRB 27 · CRB 28 · CRB 29 · CRB 30 · CRB 31 · CRB 32 · CRB 33 · CRB 34 · CRB 37 · CRB 38 · CRB 39 · CRB 41 · CRB 42 · CRB 47 · CRB 48 · CRB 65 · CRB 66 · CRB 67 · CRB 71 · CRB 72 · CRB 74 · CRB 75 · CRB 76 · CRB 86 · CRB 90 · CRB 97 · CRB 100 · CRB 114 · CRB 115 · CRB 116

_Crédités par une source folio de `src/data/*.json` (0, donnée référencée sans réf de ligne)_ : —

_Sous dette de fiche déclarée (47, toutes les fiches qui décrivent le chapitre sont ticketées)_ : CRB 4 (#1873 — 5e/tests) · CRB 6 (#1873 — 5e/tests) · CRB 7 (#1873 — 5e/tests) · CRB 8 (#1873 — 5e/tests) · CRB 9 (#1873 — 5e/tests) · CRB 10 (#1873 — 5e/tests) · CRB 11 (#1873 — 5e/tests) · CRB 12 (#1873 — 5e/tests) · CRB 16 (#1873 — 5e/tests) · CRB 17 (#1873 — 5e/tests) · CRB 20 (#1873 — 5e/tests) · CRB 21 (#1873 — 5e/tests) · CRB 22 (#1873 — 5e/tests) · CRB 23 (#1873 — 5e/tests) · CRB 24 (#1873 — 5e/tests) · CRB 25 (#1873 — 5e/tests) · CRB 26 (#1873 — 5e/tests) · CRB 27 (#1873 — 5e/tests) · CRB 28 (#1873 — 5e/tests) · CRB 29 (#1873 — 5e/tests) · CRB 30 (#1873 — 5e/tests) · CRB 31 (#1873 — 5e/tests) · CRB 32 (#1873 — 5e/tests) · CRB 33 (#1873 — 5e/tests) · CRB 34 (#1873 — 5e/tests) · CRB 37 (#1873 — 5e/tests) · CRB 38 (#1873 — 5e/tests) · CRB 39 (#1873 — 5e/tests) · CRB 41 (#1873 — 5e/tests) · CRB 42 (#1873 — 5e/tests) · CRB 47 (#1873 — 5e/tests) · CRB 48 (#1873 — 5e/tests) · CRB 65 (#1873 — 5e/tests) · CRB 66 (#1873 — 5e/tests) · CRB 67 (#1873 — 5e/tests) · CRB 71 (#1873 — 5e/tests) · CRB 72 (#1873 — 5e/tests) · CRB 74 (#1873 — 5e/tests) · CRB 75 (#1873 — 5e/tests) · CRB 76 (#1873 — 5e/tests) · CRB 86 (#1873 — 5e/tests) · CRB 90 (#1873 — 5e/tests) · CRB 97 (#1873 — 5e/tests) · CRB 100 (#1873 — 5e/tests) · CRB 114 (#1873 — 5e/tests) · CRB 115 (#1873 — 5e/tests) · CRB 116 (#1873 — 5e/tests)

**VRAIS hors-code (après crédits) :**
_Aucun._

## Livres vus par la mesure

Code : AA, ACE, ADE I, ADE II, EDO, EDOC, LDB, MCLB, MDG, MSRC, NADJ, PDT, VDM, ZI
Atlas : AA, ACE, ADE I, ADE II, AU1, CRB, EDO, EDOC, LDB, MCLB, MDG, MSR, MSRC, NADJ, PDT, VDM, ZI
<!-- sources-empreinte: 1c0e000fa78db4cfb08025bf793cf08f6fa44403 (4300 fichiers, 154 dossiers) corps: ef70a3e9b68a3b72839d22265e1083ef6d38cdf6 -->
