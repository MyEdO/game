# Atlas RAW — Réconciliation CODE ↔ ATLAS

> Déterministe (`node scripts/raw/reconcile.mjs`). **Sens A** = règles que l'app applique
> (réfs `LDB NN l.X` dans `src/`, et pour les 14 autres livres `<ABRÉV> NN l.X`) absentes de
> l'Atlas. **Sens B** = règles que l'Atlas décrit hors du code (borné au LDB).
> Tolérance ligne = ±20.

**Sens A — code → Atlas (LDB)** : 0 chapitre(s) cités par le code & absents de l'Atlas · 0 chapitre(s) couverts avec des lignes non pinées. Réfs folio (`ABBR NN p.X`, #606) côté Atlas : 3 ignorée(s) proprement (ancre absente/ambiguë/hors-chapitre).
**Sens A — code → Atlas (14 autres livres)** : 12 chapitre(s)-livre cités par le code & absents de l'Atlas · 11 chapitre(s)-livre couverts avec des lignes non pinées · 0 réf(s) sans chapitre (non réconciliables par cette mesure).
**Sens B — Atlas → code (LDB)** : 3 marqueur(s) « (non implémenté) » · 1 chapitre(s) LDB cités par l'Atlas jamais référencés dans le code (avant crédit folio : 12 · 11 crédités par une source folio de `src/data`).

## A1 — Chapitres appelés par le CODE (LDB), ABSENTS de l'Atlas (trous durs)

_Aucun. Tout chapitre LDB référencé dans le code est cité par au moins une fiche._

## A2 — Lignes appelées par le CODE (LDB) non pinées par l'Atlas (chapitre couvert, règle peut-être survolée)

_Aucune._

## A-AUTRES 0 — Résumé Sens A par livre (14 livres hors LDB)

| Livre | Trous durs (chapitres) | Chapitres à lignes non pinées | Réfs sans chapitre |
|---|---|---|---|
| ADE I | 1 | 1 | 0 |
| ADE II | 0 | 1 | 0 |
| EDO | 1 | 2 | 0 |
| EDOC | 2 | 2 | 0 |
| MCLB | 1 | 0 | 0 |
| MDG | 2 | 1 | 0 |
| MSRC | 1 | 2 | 0 |
| NADJ | 2 | 1 | 0 |
| PDT | 2 | 0 | 0 |
| VDM | 0 | 1 | 0 |

## A1-AUTRES — Chapitres appelés par le CODE (autres livres), ABSENTS de l'Atlas (trous durs)

### ADE I 2 — 2 réf(s) code, 0 dans l'Atlas
- `src/data/talents.json:3194` (l.267) — "note": "ADE I 02 l.267"
- `src/data/talents.json:4808` (l.276) — "note": "ADE I 02 l.276"

### EDO 10 — 1 réf(s) code, 0 dans l'Atlas
- `src/data/skills.json:1878` (l.736) — "note": "EDO 10 l.736"

### EDOC 9 — 5 réf(s) code, 0 dans l'Atlas
- `src/engine/disease.ts:587` (l.21) — *  voyage (EDOC 09 l.21) passent par ici. No-op sur une maladie déjà active. */
- `src/state/travel.test.ts:441` (l.21) — it('saison froide + Exposition RATÉE : le Rhume commun contracté en route se DÉCLARE à la Phase d’arrivée (EDOC 8 l.92, EDOC 9 l.21)', () => {
- `src/state/travelFlow.ts:187` (l.21) — *  (EDOC 09 l.21, `declareArrivalDiseases`). */
- `src/state/travelFlow.ts:442` (l.21) — // après interruption retrouve celle du départ). Lue par la Phase d'arrivée (EDOC 09 l.21).

### EDOC 10 — 2 réf(s) code, 0 dans l'Atlas
- `src/data/reseau-routier.json:173` (l.30) — "note": "EDOC 10 l.30 — section « Postes de péage » ; tarif l.32."
- `src/data/reseau-routier.json:192` (l.11) — "note": "EDOC 10 l.11 — section « Patrouilles routières » ; la phrase reprend l.17, l'encadré « LES JUSTICIERS » (l.13-15) la coupant."

### MCLB 2 — 5 réf(s) code, 0 dans l'Atlas
- `src/data/creatures.json:59046` (l.2420) — "note": "MCLB 02 l.2420"
- `src/data/skills.json:962` (l.1844) — "note": "MCLB 02 l.1844"
- `src/data/skills.json:1559` (l.1322) — "note": "MCLB 02 l.1322"
- `src/data/skills.json:1569` (l.2426) — "note": "MCLB 02 l.2426"

### MDG 3 — 5 réf(s) code, 0 dans l'Atlas
- `src/state/restFlow.ts:68` (l.71) — /** À bord du navire de campagne (hamacs/quartiers, MDG 03 l.71 · 09 l.87) — couchage ABRITÉ (pas
- `src/state/restFlow.ts:636` (l.71) — if (places.bord) out.push('bord'); // à bord = hamacs (MDG 03 l.71) ; par défaut si offert
- `src/state/riverVoyageFlow.ts:1082` (l.71) — // Sur la rivière on peut mouiller le long de la berge : coucher À BORD (hamacs, MDG 03 l.71) offert
- `src/state/seaActivities.ts:239` (l.71) — // dort à bord (hamacs, MDG 03 l.71) : couchage unique et abrité.

### MDG 6 — 1 réf(s) code, 0 dans l'Atlas
- `src/data/species.json:2557` (l.50) — "note": "MDG 06 l.50"

### MSRC 10 — 4 réf(s) code, 0 dans l'Atlas
- `src/data/naval-traits.json:12` (l.90) — "maison": "MSRC 07 l.94 gate le Critique de Superstructure sur « si le bateau dispose d'une cale » sans imprimer de Trait naval ; la cale rejoint le catalogue d
- `src/data/schemas/grammaire/formes-partagees.test.ts:400` (l.90) — // de Superstructure sur « si le bateau dispose d'une cale », MSRC 10 l.90 la dit du navire marchand).
- `src/ui/compendium/registry-enveloppe.test.ts:119` (l.90) — // gate le Critique de Superstructure dessus ; MSRC 10 l.90 le dit du navire marchand).
- `src/ui/ship-stations-panel.test.tsx:120` (l.90) — it('5. « Cale » sur la BARGE commerciale (MSRC 10 l.90) : ouverte, épinglable', () => {

### NADJ 4 — 7 réf(s) code, 0 dans l'Atlas
- `src/data/schemas/defs-scenes/scene.ts:113` (l.72) — /** JOUEUR de taverne (`NADJ 04 l.72`) : `gameId` de `tavernGames.json`, mise de DÉPART en sous. */
- `src/state/scene.ts:130` (l.72) — *  Le patron est AUTHORÉ dans la source, pas inventé : `NADJ 04 l.72` — « Elle jouera une partie de
- `src/state/tavern-npc-a-fiche.test.ts:6` (l.72) — *  · `NADJ 04 l.72` — « Elle jouera une partie de L'Impératrice écarlate avec quiconque lui propose,
- `src/state/tavern-npc-a-fiche.test.ts:98` (l.72) — it('la SCÈNE décide : `tavernGame` sur l’entité déclare le jeu et la mise de départ (patron `NADJ 04 l.72`)', () => {

### NADJ 14 — 5 réf(s) code, 0 dans l'Atlas
- `src/data/index.ts:828` (l.5) — *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
- `src/data/reglesOptionnelles.json:472` (l.5) — "ref": "NADJ 14 l.5",
- `src/data/schemas/defs/species.ts:57` (l.5) — *  Portée sur `gnomes` (`NADJ 14 l.5`, règle `creation-gnome-jouable`). */
- `src/engine/creation.test.ts:127` (l.5) — describe('Gnome jouable — règle optionnelle (NADJ 14 l.5)', () => {

### PDT 8 — 1 réf(s) code, 0 dans l'Atlas
- `src/ui/mono-stake-ratchet.test.ts:67` (l.370) — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

### PDT 9 — 1 réf(s) code, 0 dans l'Atlas
- `src/ui/mono-stake-ratchet.test.ts:67` (l.285) — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

## A2-AUTRES — Lignes appelées par le CODE (autres livres) non pinées par l'Atlas

### EDOC 6 — 13/13 ligne(s) code hors couverture
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

### EDO 1 — 6/7 ligne(s) code hors couverture
- l.5 — `src/data/schemas/defs-scenes/narratif.test.ts:26` — source: { book: 'ennemi-dans-l-ombre', page: 12, note: 'EDO 01 l.5' },
- l.13 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:14` — * Promesse tenue, `EDO 01 l.13` : « Deux jours de diligence, bien sûr. À pied, le trajet devrait durer
- l.17 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:15` — * environ une semaine. » Emplacement du relais, `EDO 01 l.17` : « Son emplacement exact importe peu, du
- l.200 — `src/scenes/test-scenarios/96-presets-edo.ts:146` — // CHEMIN JOUEUR de « il leur propose une partie » (`EDO 01 l.200`) : sans lui, le rôle
- l.202 — `src/scenes/test-scenarios/96-presets-edo.ts:198` — // comme une perte de temps de jouer pour moins de 2/- » (`EDO 01 l.202`), soit 24 sous.
- l.340 — `src/scenes/diligence/edo-ch1-calibration-voyage.test.ts:20` — * D'où vient le `km` : `EDO 01 l.340` — « Une borne sur le bas-côté indique : « Altdorf, 180 km ». »

### MSRC 12 — 6/12 ligne(s) code hors couverture
- l.85 — `src/data/index.ts:2500` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.107 — `src/engine/naval-traits.test.ts:303` — it('Plat-bord : palier de LONGUEUR (grande barge ~30 m, bande ouverte au-delà de 20 m) → 45 CO / 60 Enc (MSRC 12 l.107/109)', () => {
- l.111 — `src/data/index.ts:2500` — *  = `totale` (MDG 12 l.364 / MSRC 12 l.85), Plat-bord = `moyenne` (MSRC 12 l.111). Géométrie de Pont,
- l.117 — `src/engine/naval-traits.test.ts:306` — it('Allégement : ALLÈGE la coque — weightEnc NÉGATIF (grande barge → −80 Enc, MSRC 12 l.117)', () => {
- l.137 — `src/data/schemas/defs/sea-weather.ts:106` — /** Gréement de course (MSRC 12 l.137) : DELTA de % voiles ajouté au tableau standard par aspect de vent. */
- l.140 — `src/engine/naval-traits.test.ts:193` — it('Gréement de course → −10 au Test de Navigation (MSRC 12 l.140) ; converti −1 DR d’équipage', () => {

### ADE II 4 — 4/5 ligne(s) code hors couverture
- l.41 — `src/state/interlude-activities.test.ts:319` — it('Identifier : exige Savoir (Magie) acquis (« Pour d’autres sorciers », ADE II 4 l.41)', () => {
- l.43 — `src/state/interlude-activities.test.ts:337` — // ADE II 4 l.43-52 — table de DR complète (le POC collapsait ≥+4/≤+3 et IGNORAIT la ligne « 0 à +1 »).
- l.46 — `src/state/interlude-activities.test.ts:303` — // ── Identifier un artefact magique (ADE II 4 l.46-59) ─────────────────────────────────────
- l.50 — `src/state/interlude-activities.test.ts:362` — it('Identifier : Échec (−2 à −3) → confond avec un objet similaire, AUCUNE fausse Particularité (ADE II 4 l.50)', () => {

### EDOC 13 — 3/8 ligne(s) code hors couverture
- l.137 — `src/data/index.ts:1078` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).
- l.522 — `src/data/index.ts:1646` — /** Tirage PLURIEL et ALTERNÉ de Mutations au spawn (Marque de Tzeentch, EDOC 13 l.522-524 : « gagne
- l.524 — `src/data/refs-migrated.test.ts:850` — *  sont au catalogue, sourcées à la desc verbatim de leur Trait (`EDOC 13 l.524` folio 83,

### MDG 15 — 3/49 ligne(s) code hors couverture
- l.461 — `src/data/naval-ports.test.ts:47` — it('Erengrad : Taille 4, Richesse 4, Surplus pièces-détachées-de-navire +1, Demande laine +1 (MDG 15 l.461-462, folio 138)', () => {
- l.468 — `src/data/naval-ports.test.ts:67` — it('Kirkjugarður Langskipa : production armes/produits-de-luxe, sans surplus ni demande (MDG 15 l.468-469, folio 138)', () => {
- l.474 — `src/data/naval-ports.test.ts:74` — it('Fjirgard : production produits-de-luxe, Demande armes +1, sans surplus (MDG 15 l.474, folio 138)', () => {

### VDM 14 — 3/7 ligne(s) code hors couverture
- l.353 — `src/data/arcanePhenomena.ts:77` — /** Modificateurs de NIVEAU D'INCANTATION apportés par le lieu (`VDM 14 l.353`, l.437, l.489) —
- l.437 — `src/engine/castingNumber.test.ts:28` — it('Caverne de l’Attache : moitié ARRONDIE À L’INFÉRIEUR, Sorts de la Bête (VDM 14 l.437)', () => {
- l.489 — `src/data/index.ts:2074` — *  deux natures (`VDM 12 l.646-647`, `VDM 14 l.489`). */

### ADE I 6 — 1/1 ligne(s) code hors couverture
- l.185 — `src/data/index.ts:1078` — *  permission du MJ », EDOC 13 l.137 ; lignage Éonir Harioth hors espèces jouables, ADE I 6 l.185).

### EDO 7 — 1/1 ligne(s) code hors couverture
- l.184 — `src/ui/mono-stake-ratchet.test.ts:67` — // EDO 7 l.184 / PDT 9 l.285 posent un statbloc de porte, PDT 8 l.370 est de la prose de MJ,

### MSRC 5 — 1/1 ligne(s) code hors couverture
- l.113 — `src/state/riverVoyageFlow.ts:876` — // Réparateur de SUBSTITUTION (`MSRC 5 l.113-117`) : le −10 est DÉJÀ fondu dans la valeur jetée,

### NADJ 16 — 1/19 ligne(s) code hors couverture
- l.119 — `src/engine/combat.ts:898` — *  (Middenball NADJ 16 l.119 : « en utilisant les règles habituelles relatives à l'Avantage »).

## A3-AUTRES — Réfs de CODE sans chapitre (`<ABRÉV> l.X`, pas d'unité chapitre à couvrir)

_Aucune._

## B1 — Règles décrites par l'Atlas marquées « (non implémenté) » (LDB)

- **docs\raw\00-index.md** L33 — le code mort détecté, `(non implémenté)` sinon. Source éditoriale (dettes/blocages) :
- **docs\raw\00-index.md** L86 — - **[`reconciliation.md`](reconciliation.md)** (`node scripts/raw/reconcile.mjs`) — code ↔ Atlas. **Sens A : zéro trou dur toléré** (chapitre cité par le code absent de l'Atlas = trou à ticketer ; non
- **docs\raw\bestiaire.md** L382 — **Implémente :** (non implémenté)

## B2 — Chapitres LDB cités par l'Atlas, jamais référencés dans le code

_Avant crédit folio (12)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 38 · LDB 39

_Crédités par une source folio de `src/data/*.json` (11, donnée référencée sans réf de ligne)_ : LDB 26 · LDB 27 · LDB 28 · LDB 29 · LDB 30 · LDB 31 · LDB 32 · LDB 33 · LDB 34 · LDB 35 · LDB 39

**VRAIS hors-code (après crédit folio) :**
LDB 38

## Autres livres

Code : AA, ACE, ADE I, ADE II, EDO, EDOC, MCLB, MDG, MSRC, NADJ, PDT, VDM, ZI
Atlas : AA, ACE, ADE I, ADE II, AU1, EDO, EDOC, MCLB, MDG, MSR, MSRC, NADJ, PDT, VDM, ZI
<!-- sources-empreinte: 5f3675b606a0251e0e3ccbbcce7b62c0fcaa4850 (4038 fichiers, 153 dossiers) corps: 290e16b40ddc97a432b4da002ce3e52ec4c60c78 -->
