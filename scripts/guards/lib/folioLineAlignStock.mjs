// STOCK CLIQUETÉ des désalignements folio ↔ ligne de `src/data/*.json` (#1318) — consommé par la
// garde `src/data/folio-line-align.test.ts`. La MESURE vit dans `folioLineAlign.mjs`, traduite en
// SITES par `folioLineAlignAudit.ts`, partagée avec sa régénération,
// `npx tsx scripts/guards/lib/regenStock.mts scripts/guards/lib/folioLineAlignAudit.ts` (politique `DECROISSANT`,
// refus SITE PAR SITE).
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
// lot #1318 donnent la mesure du geste : `stakes.json#combat-aa-hemorragie` 61 → 80 (sommaire
// imprimé d'Aux Armes, `01 - CREDITS.md` : « Blessures, Blessures Critiques et mort 80 ») et
// `stakes.json#sauvetage-destin-choix` 34 → 170 (« Dépenser du Destin » sous l'ancre
// `data-folio="170"` de `17 - Destin et Resistance.md` ; le folio 34 est celui de la CRÉATION de
// personnage, où le Destin est attribué, pas celui de son sacrifice).
//
// DEUX collections, une seule primitive, toutes deux GÉNÉRÉES :
//   — `FOLIO_LINE_ALIGN_RATCHET` : les désalignements MESURÉS, cible 0.
//   — `FOLIO_LINE_ALIGN_NON_JUGEABLE` : les entrées que le détecteur refuse de juger faute d'ancres
//     (`reason: 'queue-trouee'` : la ligne citée tombe au-delà de la dernière ancre `data-folio` du
//     chapitre, et le chapitre suivant ne reprend pas la numérotation — résidu #522). Gelées
//     NOMINATIVEMENT pour que la COUVERTURE du détecteur soit un chiffre tenu et non un angle mort :
//     leur folio déclaré est plausible mais n'a PAS été machine-vérifié (relu à la main, #1318).
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
// Mesure de l'élargissement (motif CHERCHÉ dans la note au lieu d'être ancré), rejouée le 2026-11-11
// (#3578 L3) : 791 → 558 `hors-forme`, `scanned` 613 → 844, non-jugeables 10 → 12
// (`obsessions.json#obsessions` REVIENDRAIT, plus `vents-tourbillonnants.json#force-des-vents`), et
// 34 désalignements NEUFS apparaîtraient (32 → 66), 6 causes : `miscast.json` ×21 (« LDB 40 l.68-89 »
// — déclaré 218, mesuré 219), `carrieres-aleatoires.json` ×5 (« MDG 09 l.9 » — déclaré 64, mesuré
// 63), `weather.json` ×4 (« EDOC 8 l.52-59 » — déclaré 33, mesuré 32), `mutationTables.json` ×2
// (« LDB 19 l.83 » — déclarés 184 et 185, mesuré 183), `eyes.json` ×1 (« LDB 05 l.742-754 » : le
// titre l.742 précède l'ancre `data-folio="40"` l.744 — déclaré 40, mesuré 39) et
// `presets-de-personnage.json#gladiateur` ×1 (« LDB 08 l.1216 » — déclaré 72, mesuré 71). Le cliquet
// étant DÉCROISSANT-SEULEMENT, l'élargissement exige d'ARBITRER ces 34 au `Source/` d'abord : le
// régénérateur REFUSERAIT de les écrire.

export const FOLIO_LINE_ALIGN_RATCHET = [
  { fichier: 'src/data/careers.json', ref: 'alchimiste-ordinaire', occurrence: 1 },
  { fichier: 'src/data/careers.json', ref: 'devin', occurrence: 1 },
  { fichier: 'src/data/regles.json', ref: 'exposition-hydrique', occurrence: 1 },
  { fichier: 'src/data/regles.json', ref: 'tests-opposes', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'chanson-de-marin-test', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'combat-fin-maladie', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'combat-psychologie', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'combat-sort-prolonge', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'equipage-progression', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'equipage-test', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'equipage-tourbillon', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'evaluation-detecter', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'evaluation-evaluer', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'exposition-a-l-eau', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-chavirage', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-louvoyage', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-navigation', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-peril-detection', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-preserver-greement', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'fleuve-redressement', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-epuisement', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-forcer-le-rythme', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-mal-de-mer', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-scorbut', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-tonneau-contamine', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'mer-tonneau-expose', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'rencontre-psychologie', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'soin-blessures', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'soin-hemorragie', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'soin-munition-logee', occurrence: 1 },
  { fichier: 'src/data/stakes.json', ref: 'structure-critique', occurrence: 1 },
  { fichier: 'src/data/weaponGroups.json', ref: 'munitions', occurrence: 1 },
]

export const FOLIO_LINE_ALIGN_NON_JUGEABLE = [
  { fichier: 'src/data/mutations.json', ref: 'crete-sur-la-tete', occurrence: 1 },
  { fichier: 'src/data/pregens.json', ref: 'erina-eberhauer', occurrence: 1 },
  { fichier: 'src/data/pregens.json', ref: 'golthog', occurrence: 1 },
  { fichier: 'src/data/reglesOptionnelles.json', ref: 'corruption-tables-edoc', occurrence: 1 },
  { fichier: 'src/data/reglesOptionnelles.json', ref: 'vents-tourbillonnants', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'auberge-relais', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'diligences-quatre-saisons', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'diligences-tour-du-roc', occurrence: 1 },
  { fichier: 'src/data/reseau-routier.json', ref: 'lignes-rochet', occurrence: 1 },
  { fichier: 'src/data/talents.json', ref: 'mutants-et-hommes-betes', occurrence: 1 },
]
