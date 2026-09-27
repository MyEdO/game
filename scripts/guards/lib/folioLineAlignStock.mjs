// STOCK CLIQUETÉ des désalignements folio ↔ ligne de `src/data/*.json` (#1318 E8) — consommé par la
// garde `src/data/folio-line-align.test.ts`. La MESURE vit dans `folioLineAlign.mjs`, traduite en
// SITES par `folioLineAlignAudit.ts`, partagée avec le régénérateur
// `npx tsx scripts/data/regen-folio-line-align-stock.mts` (DÉCROISSANT-SEULEMENT, refus SITE PAR SITE).
//
// FORME DES ENTRÉES — `{ fichier, ref, occurrence }`, la forme UNIQUE de tout stock nominatif du
// dépôt (`cleDeSite`, `scripts/guards/lib/stock.mjs`) : `fichier` = le dataset à OUVRIR, `ref` = l'id
// de l'entrée fautive. C'est le `fichier` que la porte de plage (`croissanceDesStocks`) voit : une
// clé `<dataset>#<id>` lui est INVISIBLE (le `#` casse son motif de chemin), et un append n'y coûte
// alors rien. Aucun PLAFOND : ce qu'une dette ne peut pas faire, c'est croître SANS SE DÉCLARER, et
// c'est l'entrée nommée qui le dit. Toute prose posée ENTRE les entrées est mangée à la régénération.
//
// La CITATION et les deux folios (« VDM 03 l.40 » → mesuré 35, déclaré 36) ne sont pas gravés ici :
// la garde les REND depuis le disque du jour (`citationsParCle`, `folioLineAlignAudit.ts`). Une copie
// gelée dirait le folio d'hier dès la prochaine ré-extraction Marker.
//
// Ce que le stock dit : ces entrées citent deux fois leur source et les deux citations divergent.
// Il ne dit PAS laquelle ment — trancher demande d'ouvrir le `Source/` entrée par entrée (une ligne
// dérivée à la ré-extraction Marker, un folio pris sur le titre de section gouvernant et un folio
// simplement faux se ressemblent tous les trois ici). Le stock ne peut que DÉCROÎTRE : on solde une
// entrée en RELEVANT le passage, jamais en alignant l'une sur l'autre à l'aveugle. Deux soldes du
// lot #1318 E8 donnent la mesure du geste : `combat-stakes.json#combat-aa-bleed` 61 → 80 (sommaire
// imprimé d'Aux Armes, `01 - CREDITS.md` : « Blessures, Blessures Critiques et mort 80 ») et
// `flow-stakes.json#fate-save-choice` 34 → 170 (« Dépenser du Destin » sous l'ancre
// `data-folio="170"` de `17 - Destin et Resistance.md` ; le folio 34 est celui de la CRÉATION de
// personnage, où le Destin est attribué, pas celui de son sacrifice).
//
// DEUX collections, une seule primitive, toutes deux GÉNÉRÉES :
//   — `FOLIO_LINE_ALIGN_RATCHET` : les désalignements MESURÉS, cible 0.
//   — `FOLIO_LINE_ALIGN_NON_JUGEABLE` : les entrées que le détecteur refuse de juger faute d'ancres
//     (`reason: 'queue-trouee'` : la ligne citée tombe au-delà de la dernière ancre `data-folio` du
//     chapitre, et le chapitre suivant ne reprend pas la numérotation — résidu #522). Gelées
//     NOMINATIVEMENT pour que la COUVERTURE du détecteur soit un chiffre tenu et non un angle mort :
//     leur folio déclaré est plausible mais n'a PAS été machine-vérifié (relu à la main, #1318 E8).
//     Si une extraction regagne ses ancres, l'entrée devient jugeable et SORT de cette liste à la
//     régénération. Les quatre entrées de `reseau-routier.json` (#677) sont citées APRÈS l'unique
//     ancre d'`EDOC 06` (`data-folio="20"`, l.37) : le chapitre suivant ne reprend pas la
//     numérotation, la queue est donc trouée pour tout ce qui suit cette ancre.
//
// ANGLE MORT MESURÉ du détecteur (2026-08-28, #1467 L1b V-FLIP-TABLE) — il ne se lit dans aucune des
// deux collections : `parseLineCitation` (`folioLineAlign.mjs`) ANCRE son motif au DÉBUT de la
// citation (`/^<ABRÉV> <ch> l.<n>/`). Toute note PRÉFIXÉE (« Tableau des Obsessions, EDOC 12 l.170 »)
// est donc classée `hors-forme`, c'est-à-dire INVISIBLE — pas jugée, et pas comptée ici non plus.
// `obsessions.json#(racine)` est hors de la seconde collection par CETTE cécité, pas par résolution :
// sa citation nue `ref` est devenue une note préfixée à la migration `2026-08-28-l1b-8c`.
// Mesure de l'élargissement (motif CHERCHÉ dans la note au lieu d'être ancré) : 872 → 678
// `hors-forme`, `scanned` 270 → 462, non-jugeables 2 → 4 (`obsessions.json#obsessions` REVIENDRAIT,
// plus `vents-tourbillonnants.json#force-des-vents`), et 14 désalignements NEUFS apparaîtraient —
// 2 causes seulement : `eyes.json` ×10 (une note unique, qui DIT elle-même « pagination Marker
// estimée entre les folios 37 et 41 » — déclaré 40, mesuré 39) et `weather.json` ×4 (« EDOC 8
// l.52-59 » — déclaré 33, mesuré 32). Le cliquet étant DÉCROISSANT-SEULEMENT, l'élargissement exige
// d'ARBITRER ces 14 au `Source/` d'abord : le régénérateur REFUSERAIT de les écrire (#1469 L1d).

export const FOLIO_LINE_ALIGN_RATCHET = [
  { fichier: 'src/data/careers.json', ref: 'alchimiste-ordinaire', occurrence: 1 },
  { fichier: 'src/data/careers.json', ref: 'devin', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'combat-end-disease', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'combat-psych', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'combat-spell-plus', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'encounter-psych', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'structure-critical', occurrence: 1 },
  { fichier: 'src/data/combat-stakes.json', ref: 'water-exposure', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'appraise-detect', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'appraise-evaluate', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'crew-test-roll', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'heal-ammo', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'heal-bleed', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'heal-wounds', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'recover-empetre', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'recover-en-flammes', occurrence: 1 },
  { fichier: 'src/data/flow-stakes.json', ref: 'shanty-roll', occurrence: 1 },
  { fichier: 'src/data/regles.json', ref: 'exposition-hydrique', occurrence: 1 },
  { fichier: 'src/data/regles.json', ref: 'tests-opposes', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'crew-progression', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'crew-tourbillon', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-capsize', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-nav', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-peril-detect', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-rigging', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-righting', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'river-tack', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-degagement', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-epuisement', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-force-pace', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-mal-de-mer', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-overspeed', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-scorbut', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-tonneau-contamine', occurrence: 1 },
  { fichier: 'src/data/voyage-stakes.json', ref: 'sea-tonneau-expose', occurrence: 1 },
  { fichier: 'src/data/weaponGroups.json', ref: 'munitions', occurrence: 1 },
]

export const FOLIO_LINE_ALIGN_NON_JUGEABLE = [
  { fichier: 'src/data/mutations.json', ref: 'crete-sur-la-tete', occurrence: 1 },
  { fichier: 'src/data/reglesOptionnelles.json', ref: 'corruption-tables-edoc', occurrence: 1 },
  { fichier: 'src/data/reglesOptionnelles.json', ref: 'vents-tourbillonnants', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'auberge-relais', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'diligences-quatre-saisons', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'diligences-tour-du-roc', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'lignes-rochet', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'mutants-et-hommes-betes', occurrence: 1 },
]
