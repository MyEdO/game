// STOCK des structures de donnée (#1463, #2705, #3021) : les deux collections que la donnée ne fait pas bouger.
// `STRUCTURES_CIBLES` fige les signatures `cible` du lexique (`CONCEPTS`, `scripts/docs/lib/structures-lexique.mts`) ;
// `STRUCTURES_REDECLARATIONS` porte les littéraux zod d'un `defs/*.ts` qui redéclarent un concept, mesurés sur l'AST
// des defs (`scannerRedeclarations`, `scripts/docs/lib/structures-scan.mts`) et comptés sous la porte des comptes
// (`COLLECTIONS_A_COMPTE`, `scripts/guards/lib/occurrencesStock.mjs`). Contrat : `src/data/structures-contrat.test.ts` ;
// rendu : `docs/structures-donnees.md` (`npm run docs:structures`).
//
// La dette que la DONNÉE révèle (formes, orphelines, homonymes, défauts, slots) n'a pas de stock : elle s'INVENTORIE
// (`scripts/guards/lib/inventaireDeDette.mts`), hors de la porte.
//
// COMMENT UNE LIGNE DE REDÉCLARATION SE SOLDE — jamais en la retirant seule : on compose le nœud commun de la grammaire
// dans le def, dans le LOT porté par la ligne (champ `lot`, testé contre `LOTS_CONNUS`) ; la mesure ne l'observe plus,
// le contrat rougit sur « ligne périmée », et la ligne se retire dans le MÊME commit. Une BAISSE de compte s'écrit
// (`occurrences-structures.mts --write`) ; une HAUSSE n'a que la migration pour remède.

/** Signatures de statut `cible` du lexique, FIGÉES ici : l'égalité stricte avec
 *  `CONCEPTS` est testée. Faire passer une graphie en `cible` (donc hors du dénominateur)
 *  exige de toucher CE fichier — un mot du lexique ne solde plus des centaines d'occurrences. */
export const STRUCTURES_CIBLES = [
  { concept: "palette-d-objet", signature: "accent,cuir,metal", date: "2026-10-23" },
  { concept: "prose-nommee", signature: "texte", date: "2026-10-08" },
  { concept: "prose-nommee", signature: "texte+…", date: "2026-10-08" },
  { concept: "reference", signature: "id", date: "2026-08-23" },
  { concept: "reference", signature: "id,spec", date: "2026-08-23" },
  { concept: "reference", signature: "choix,id", date: "2026-08-23" },
  { concept: "reference", signature: "id,type", date: "2026-08-23" },
  { concept: "reference", signature: "count,id,type", date: "2026-08-23" },
  { concept: "reference", signature: "of,pick", date: "2026-08-23" },
  { concept: "reference", signature: "pick,table", date: "2026-08-23" },
  // #1921 (2026-10-17) — le Spécial d'un jeu de taverne naît CIBLE : `specialSchema` le valide, rien à migrer.
  { concept: "special-de-jeu", signature: "effet,hasTalent,source,steps", date: "2026-10-17" },
  { concept: "special-de-jeu", signature: "difficulty,effet,hasTalent,source", date: "2026-10-17" },
  // RECLASSEMENT AU SITE (L2 #1548, commit 4bis) — trois graphies passent CIBLE au SEUL site du
  // STATBLOC (`SITE_STATBLOC` du lexique : bestiaire + statblocs embarqués des projets de scène,
  // champ `skills`). Elles restent HISTORIQUES partout ailleurs (inventaire `CASES_DE_REFERENCE`,
  // `inventaireDeDette.mts`, lot L3). Ce que le site tranche, c'est que la valeur IMPRIMÉE est un champ de la
  // référence de Compétence (#1463, « Faits tranchés au Source »). AUCUNE donnée n'est réécrite par ce reclassement.
  { concept: "reference", signature: "id,value", date: "2026-08-31" },
  { concept: "reference", signature: "id,spec,value", date: "2026-08-31" },
  // Le régime `choix` du MÊME nœud (53 emplacements libres + 6 bornés, migrés au commit 4bis).
  { concept: "reference", signature: "choix,id,value", date: "2026-08-31" },
  // #1463 Trait PR-3b (2026-10-26) — deux formes du Trait POSÉ naissent CIBLES au seul site du Trait posé
  // (`SITE_TRAIT_POSE` du lexique) : PR-3b les ouvre dans `traitInstanceSchema` et les peuple par sa migration.
  { concept: "reference", signature: "id,parLocalisation", date: "2026-10-26" },
  { concept: "reference", signature: "id,plage", date: "2026-10-26" },
  // DESIGN v2 S2 (#1463, commentaire du 2026-08-23) : « `refs(type)` = liste d'ids nus brandée
  // (75 champs `string[]`) ». La liste d'ids nus EST la forme visée — ce qui reste à faire est le
  // TYPAGE du champ, pas une réécriture de la donnée : elle sort du dénominateur des formes.
  { concept: "refs", signature: "ids-nus", date: "2026-08-30" },
  { concept: "monnaie", signature: "brass,gold,silver", date: "2026-08-23" },
  // #1463 L-monnaie-3 (2026-09-01) — les 6 sous-signatures NON VIDES d'un montant PARTIEL sortent du
  // dénominateur. PREUVE : `moneyPartialSchema` (`src/data/schemas/grammaire/valeurs.ts:300`) déclare
  // les 3 dénominations OPTIONNELLES, et `toMoney` (`src/engine/money.ts:45`) complète à 0 celles qui
  // manquent : un coût authoré qui n'écrit que ce qu'il chiffre EST à la forme cible. Les variantes
  // `+…` n'y sont PAS : un montant qui cohabite avec d'autres clés sur le MÊME objet est un étalement,
  // et l'étalement se migre (les 44 `giveMoney` du même lot), il ne se blanchit pas.
  { concept: "monnaie", signature: "brass", date: "2026-09-01" },
  { concept: "monnaie", signature: "gold", date: "2026-09-01" },
  { concept: "monnaie", signature: "silver", date: "2026-09-01" },
  { concept: "monnaie", signature: "brass,gold", date: "2026-09-01" },
  { concept: "monnaie", signature: "brass,silver", date: "2026-09-01" },
  { concept: "monnaie", signature: "gold,silver", date: "2026-09-01" },
  // #1595 (2026-10-15) — le PROFIL DE PROPULSION d'un navire naît CIBLE : c'est la forme que
  // `vehicles.ts › ship.sail`/`ship.oars` et `ship-construction.ts` valident, rien à migrer.
  { concept: "profil-de-propulsion", signature: "crew,m", date: "2026-10-15" },
  { concept: "profil-de-propulsion", signature: "crew,m,spec", date: "2026-10-15" },
  // #2534 / #2539 (2026-10-16) — billet de route, son marchandage et ses paliers, forme d'un état de
  // campagne : nés CIBLES, ce sont les formes que `worldmap.ts` et `narratif.ts` valident, rien à migrer.
  { concept: "palier-de-billet", signature: "drMin,prix", date: "2026-10-16" },
  { concept: "marchandage-de-billet", signature: "paliers,presetId", date: "2026-10-16" },
  { concept: "marchandage-de-billet", signature: "presetId", date: "2026-10-16" },
  // #2779 (2026-10-18) — le Test NOMMÉ : `flowTestSchema` (`src/data/schemas/grammaire/mecanique.ts:644`)
  // désigne sa Compétence (`skill`) ou sa caractéristique (`characteristic`) avec sa `difficulty`, et
  // `testDeRegleSchema` exige `skill` + `difficulty` : ces deux graphies SONT la forme que la porte valide.
  // `char,difficulty` reste historique (`char` → `characteristic`, #1657 B2c).
  { concept: "test", signature: "difficulty,skill", date: "2026-10-18" },
  { concept: "test", signature: "characteristic,difficulty", date: "2026-10-18" },
  // #2662 (2026-10-17) — la forme d'un état passe à ses clés RÉELLES, au seul site des projets.
  { concept: "forme-d-etat", signature: "kind", date: "2026-10-17" },
  { concept: "forme-d-etat", signature: "kind,valeurs", date: "2026-10-17" },
  { concept: "forme-d-etat", signature: "identite,kind", date: "2026-10-17" },
  { concept: "identite-de-heros", signature: "ancres,lignes,reperes", date: "2026-10-17" },
  { concept: "ligne-d-identite", signature: "espece,sexe,valeurs", date: "2026-10-17" },
  { concept: "valeur-d-identite", signature: "repere,valeur+…", date: "2026-10-17" },
  { concept: "billet-de-route", signature: "prix", date: "2026-10-16" },
  { concept: "billet-de-route", signature: "prix+…", date: "2026-10-16" },
  // #2533 (2026-10-17) — provenance des valeurs de route : formes CIBLES de la porte de #2533, que le détecteur de la base
  // de sa plage (`scripts/guards/lib/corpusDesComptes.mts`) doit reconnaître.
  { concept: "provenance-de-valeur", signature: "source", date: "2026-10-17" },
  { concept: "provenance-de-valeur", signature: "maison", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "km", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "perilDie", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "speed", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "km,perilDie", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "km,speed", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "perilDie,speed", date: "2026-10-17" },
  { concept: "provenances-de-route", signature: "km,perilDie,speed", date: "2026-10-17" },
  // #1389 (épique #1388, 2026-09-07) — l'ADRESSE de prose et son FRAGMENT naissent CIBLES : ce sont
  // les formes que le parseur `src/data/source/decoupe.ts` PRODUIT et que `descRefSchema`
  // (`grammaire/valeurs.ts`) est seul à accepter — il n'y a rien à migrer vers une autre graphie.
  // Sans ces trois lignes, `book` les ferait classer `source` et `sum` `formule`, par MISCLASSEMENT.
  { concept: "adresse", signature: "book,ch,parts", date: "2026-09-07" },
  { concept: "fragment", signature: "b0,b1,sec,secOcc,sum+…", date: "2026-09-07" },
  { concept: "fragment", signature: "col,row,sec,secOcc,sum+…", date: "2026-09-07" },
  // #1765 : les deux branches de `weaponDamageSpecSchema` (`grammaire/valeurs.ts`). Aucune donnée n'est réécrite.
  { concept: "degats-arme", signature: "flat,plusBF", date: "2026-10-13" },
  { concept: "degats-arme", signature: "bare,flat,plusBF", date: "2026-10-13" },
  { concept: "degats-arme", signature: "literal", date: "2026-10-13" },
  { concept: "de", signature: "n,sides", date: "2026-08-23" },
  { concept: "de", signature: "n,plus,sides", date: "2026-08-23" },
  // #1463 L-de-1 : la COMPOSITION d'une `Formula` (`formulaSchema`, `grammaire/valeurs.ts`) et le
  // terme de Péché qui s'y ajoute (`sinPointsSchema`) — LDB 40 l.58/62/63/65/68/71/72/73/75/77.
  { concept: "formule", signature: "sum", date: "2026-09-01" },
  { concept: "formule", signature: "sinPoints", date: "2026-09-01" },
  { concept: "formule", signature: "minimum,of", date: "2026-09-18" },
  { concept: "formule", signature: "of,parTranche", date: "2026-10-28" },
  { concept: "source", signature: "book,page", date: "2026-08-23" },
  { concept: "source", signature: "book,note,page", date: "2026-08-23" },
  // #1897 : l'emplacement SECONDAIRE (`alsoIn`) est la référence de source plus sa preuve `quote`
  // (`secondarySourceRefSchema`, `grammaire/valeurs.ts`), cible au SEUL site `alsoIn`
  // (`SITE_EMPLACEMENT_SECONDAIRE` du lexique). Aucune donnée n'est réécrite.
  { concept: "source", signature: "book,page,quote", date: "2026-09-23" },
  { concept: "source", signature: "book,note,page,quote", date: "2026-09-23" },
  { concept: "plage", signature: "max,min", date: "2026-08-23" },
  // #1463 L4 P2 (2026-08-31) — la FOURCHETTE d'une rangée de table sort du dénominateur. Ce n'est pas
  // un mot du lexique qui la sort : la cible est TRANCHÉE (forme PLATE `{min, max}` + `findTableEntry`,
  // `src/engine/tables.ts`), et la charge utile d'une rangée (102 charges distinctes mesurées) est
  // INHÉRENTE — c'est ce que le suffixe `+…` de la projection nomme. Rien à migrer sur les 1413 objets
  // déjà à cette forme ; ce qui restait à faire l'a été, et se voit en donnée : les 34 rangées que
  // `weather.json` et `advancementCosts.json` encodaient par la BORNE HAUTE SEULE portent leurs deux
  // bornes, et leurs deux lookups ordre-dépendants sont passés à `findTableEntry`.
  { concept: "plage", signature: "max,min+…", date: "2026-08-31" },
  // Les bornes du DOMAINE d'un réglage (`reglesOptionnelles.json`, 23 objets, co-présence
  // `default`/`step`) : même noyau, autre concept — aucun d100 ne les traverse. Elles étaient comptées
  // `plage divergente` par MISCLASSEMENT ; le concept `bornes` du lexique les nomme, à leur forme.
  { concept: "bornes", signature: "max,min+…", date: "2026-08-31" },
  { concept: "quantite", signature: "fixed", date: "2026-08-23" },
  { concept: "quantite", signature: "roll", date: "2026-08-23" },
  // STRATE DOCUMENT (#1633, 2026-09-01) — les enveloppes nommées de la grammaire de campagne entrent
  // ici, PORTE par PORTE. Ce ne sont pas des formes à migrer : chaque signature est la PROJECTION du
  // noyau REQUIS de sa porte zod, et le suffixe `+…` y nomme les clés OPTIONNELLES que le schéma
  // déclare (les DEUX projections sont donc cibles, la donnée n'en posant aujourd'hui qu'une par
  // porte). Elles quittent les objets invisibles du scan (`scan.objets.invisibles`) : la
  // projection réunit les deux buckets qu'un optionnel peuplé (`source`) séparait.
  // Portes : `ouvertureSchema` / `clotureSchema` / `formeNarratif`
  // (`src/data/schemas/defs-scenes/narratif.ts`) et `conditionSchema`
  // (`src/data/schemas/grammaire/mecanique.ts`, variante `flag`).
  { concept: "ouverture", signature: "pitch,titre", date: "2026-09-01" },
  { concept: "ouverture", signature: "pitch,titre+…", date: "2026-09-01" },
  { concept: "cloture", signature: "titre,when", date: "2026-09-01" },
  { concept: "cloture", signature: "titre,when+…", date: "2026-09-01" },
  // #2539 (2026-10-16) — le registre `etats` est REQUIS par `formeNarratif` : il entre au noyau.
  { concept: "narratif", signature: "affaires,documents,etats,indices,objets,presetsPnj", date: "2026-10-16" },
  { concept: "narratif", signature: "affaires,documents,etats,indices,objets,presetsPnj+…", date: "2026-10-16" },
  { concept: "condition", signature: "expr,kind", date: "2026-09-01" },
  // #2539 (2026-10-16) — l'Effet qui ÉCRIT un état de campagne naît CIBLE : `poserEtatSchema` et
  // `designerHerosSchema` (`src/data/schemas/defs-scenes/effets.ts`) le valident, rien à migrer.
  { concept: "effet-d-etat", signature: "etat,type,valeur", date: "2026-10-16" },
  { concept: "effet-d-etat", signature: "etat,invite,type", date: "2026-10-16" },
  { concept: "effet-d-etat", signature: "etat,invite,type+…", date: "2026-10-16" },
  { concept: "effet-narratif", signature: "documentId,type", date: "2026-10-17" },
  { concept: "effet-narratif", signature: "indiceId,stade,type", date: "2026-10-17" },
];

/** Littéral d'objet zod d'un `defs/*.ts` qui REDÉCLARE localement un concept du lexique (ou la
 *  signature exacte d'un littéral de la grammaire, `src/data/schemas/grammaire/`). Keyé par `def | champ | concept | signature` :
 *  sans le CHAMP, 13 lignes agrégeaient 2 à 4 champs distincts. Pas de numéro de ligne ici : une
 *  ligne bouge à chaque édition du def et ferait rougir la garde sans qu'aucune structure n'ait
 *  changé — le `fichier:ligne` vit dans `docs/structures-donnees.md` §4, régénéré à chaque build.
 *  `oups.ts | plage` NE PEUT PAS sortir par le geste des autres bandes, et sa ligne se tient ICI
 *  plutôt que dans un rendu (refus MOTIVÉ, #1463 L-gram-1) : le dataset
 *  porte les 7 bandes d100 du Tableau des Oups ! ET l'Incident de Tir, section DISTINCTE du livre
 *  (`LDB 14 l.21-30` / `l.32-34`), qui n'a AUCUNE borne. Ses deux bornes sont donc OPTIONNELLES,
 *  disjointes par un refine ⟺ — composer `plageSchema` (bornes REQUISES) rendrait la donnée
 *  invalide, et `bornesSchema` dirait un RÉGLAGE là où le lexique a séparé `plage` et `bornes`. La
 *  ligne sort quand `misfire` sort du dataset : c'est la question #1544 (découpage produit), pas une
 *  adoption de forme. */
export const STRUCTURES_REDECLARATIONS = [
  { def: "activities.ts", champ: "", concept: "test", signature: "char,difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "arcane-phenomena.ts", champ: "controlFlux", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "criticals.ts", champ: "", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "criticals.ts", champ: "loss", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "land-cargo.ts", champ: "gossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "miscast.ts", champ: "", concept: "test", signature: "characteristic,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "oups.ts", champ: "", concept: "plage", signature: "max,min+…", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "psychology.ts", champ: "test", concept: "test", signature: "difficulty,skill", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "river-navigation.ts", champ: "temporaryRepair", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "producesGossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "surplusGossip", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-cargo.ts", champ: "test", concept: "test", signature: "difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-navigation.ts", champ: "epuisement", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "evasion", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "freeTest", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-perils.ts", champ: "tourbillonSwim", concept: "test", signature: "difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "sea-weather.ts", champ: "affaler", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "steam-breakdown.ts", champ: "restart", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "tavernGames.ts", champ: "options", concept: "test", signature: "char,difficulty,skill+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "tavernGames.ts", champ: "rows", concept: "plage", signature: "max,min+…", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-09-01" },
  { def: "tavernGames.ts", champ: "throwerPenalty", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "water-exposure.ts", champ: "", concept: "", signature: "kind,op,value", statut: "hors lexique", commun: "conditionSchema", occurrences: 2, lot: "L1a #1466", date: "2026-08-23" },
  { def: "water-exposure.ts", champ: "test", concept: "test", signature: "difficulty,skill", statut: "cible", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
  { def: "weather.ts", champ: "resistanceTest", concept: "test", signature: "difficulty+…", statut: "divergente", commun: "", occurrences: 1, lot: "L4 #1463", date: "2026-08-23" },
];
