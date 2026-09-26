// STOCKS NOMINATIFS DATÉS du REGISTRE DES SLOTS (#1466 L1a, volet A).
// Consommés par `src/data/slots-contrat.test.ts`, mesurés par `scripts/docs/lib/slots-registre.mts`,
// rendus lisibles par `docs/structures-donnees.md` §6.
// Patron whitelist-en-lib du dépôt (`structuresStock.mjs`, `tableConsumerStock.mjs`).
//
// MANDAT : `MANDAT_SLOTS` (`scripts/docs/lib/structures-lexique.mts`).
//
// CE QUE MESURENT CES STOCKS :
//   - `SLOTS_SANS_DECLARATION` — un couple (dataset, champ) qui porte des références OBSERVÉES
//     (strate `Référence` du scan des deux racines) dont une occurrence au moins n'est pas ATTEINTE.
//     Le côté DÉCLARÉ est ce que le PARSE valide (#1473 R1) : une case `(porteur, clé)` dont la valeur
//     est validée par `idDe` au parse de mesure est un SLOT ; une occurrence est ATTEINTE quand toutes
//     ses cases en sont. Le compte est celui des occurrences OBSERVÉES du couple ; la part atteinte se
//     lit au doc §6.2. Une ligne se solde en faisant ADOPTER la fabrique de référence (`ref`/`refs`/
//     `specRef`/`pick`, toutes sur `idDe`) par le schéma du champ — concept par concept en L2/L3
//     (#1473) — et part dans le MÊME commit que l'adoption.
//   - `SLOTS_INATTEIGNABLES` — un couple dont des occurrences n'ont AUCUNE case qui porte une chaîne :
//     aucune n'est un slot (angle mort `ANGLES_MORTS_SLOTS`). Compte = ces occurrences-là seules ; la
//     ligne se solde quand la donnée ou le scan leur rend une case-chaîne.
// Les deux ne font que DÉCROÎTRE : une référence neuve s'ADOPTE, elle ne s'inscrit pas.
//
// ANGLES MORTS : `ANGLES_MORTS_SLOTS` (`scripts/docs/lib/structures-lexique.mts`), rendus au doc §6.3.

/** Couples dont des occurrences n'ont AUCUNE case qui porte une chaîne, au compte de ces seules
 *  occurrences — mesurés par `occurrencesInatteignables` (`scripts/docs/lib/slots-registre.mts`). */
export const SLOTS_INATTEIGNABLES = [
  { dataset: "careerLevels.json", champ: "trappings", occurrences: 14, lot: "L2/L3 #1473", date: "2026-09-23" }, // `{choice:[…]}` : les feuilles comptent sous `careerLevels.json | choice`
  { dataset: "creatures.json", champ: "spec", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-23" }, // `spec: "art"` de `{id:"savoir", spec:"art"}` (`[119].skills[15]`, `[129].skills[14]`), homonyme de l'id `art` de `skills.json`, rangé par le scan sous le champ `spec` ; sa seule case est une clé de `CLES_DE_SPECIALISATION`. Solde : #1904
  { dataset: "species.json", champ: "of", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-23" }, // `{random:N}`
  { dataset: "species.json", champ: "talents", occurrences: 19, lot: "L2/L3 #1473", date: "2026-09-23" }, // `{random:N}`
];

export const SLOTS_SANS_DECLARATION = [
  { dataset: "actions.json", champ: "armed", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "gate", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "hote", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "keys", occurrences: 27, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "mode", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "rule", occurrences: 32, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "chains", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "classes", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "ops", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "where", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "rule", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-23" }, // #1473 R0 : `[60].rule`, `rule: z.string().optional()` (`defs/activities.ts:200`), aucune fabrique ; son départ au commit a6c963419 était une collision avec le slot `rule` de `formulaSchema`
  { dataset: "arcane-phenomena.json", champ: "cancelsTraitId", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainId", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainIds", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domains", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainsExcept", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "environments", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "fluxTableId", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "tableId", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "a", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "ambush", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "appearance", occurrences: 25, lot: "L2/L3 #1473", date: "2026-09-01" },
  { dataset: "arene-projet.json", champ: "b", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "choices", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "dialogueId", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "effect", occurrences: 72, lot: "L2/L3 #1473", date: "2026-09-11" }, // 76→72 (#1687 lot 3-I) : `phase` et `lodging` sont des littéraux d'enum déclarés (`defs-scenes/effets.ts`), que `choixDeclares` atteint (`structures-scan.mts:516`, #1463 arbitrages L0 point 3)
  { dataset: "arene-projet.json", champ: "members", occurrences: 116, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "merchant", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "modes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "optionals", occurrences: 13, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "qualities", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "roomZoneIds", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "scene", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "start", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "traits", occurrences: 11, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "walls", occurrences: 235, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "weapon", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "ref", occurrences: 406, lot: "L2/L3 #1473", date: "2026-09-23" }, // #1473 R1 : 291 `prop` atteints (`idDe('prop')` de la branche `prop` de `sceneEntitySchema`, `defs-scenes/scene.ts:169`) + 115 `personnage` (`ref` en chaîne libre : dette réelle, #1882)
  { dataset: "barge-du-sel-projet.json", champ: "a", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "ambush", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "ammo", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "appearance", occurrences: 4, lot: "L2/L3 #1473", date: "2026-09-01" },
  { dataset: "barge-du-sel-projet.json", champ: "b", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "crew", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "crewIds", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "effect", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "members", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "postes", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "qualities", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "victoryCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "ref", occurrences: 6, lot: "L2/L3 #1473", date: "2026-09-23" }, // #1473 R1 : 1 `prop` atteint (`idDe('prop')` de la branche `prop` de `sceneEntitySchema`, `defs-scenes/scene.ts:169`) + 5 `personnage` (`ref` en chaîne libre : dette réelle, #1882)
  { dataset: "careerLevels.json", champ: "career", occurrences: 432, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careerLevels.json", champ: "choice", occurrences: 29, lot: "L2/L3 #1473", date: "2026-08-26" },
  // 1283 → 1286 (#1463 L-ref-0 + L-ref-1) : MÊME champ, compte rafraîchi. −4 — les 4 dotations comptées
  // que la mesure classait `count,text (résolvable)` (une FORME de référence) redeviennent des
  // orphelines « clé réservée », hors de cette somme ; +7 — « Chiffon » et les 6 « Carreaux » passent
  // de `{count, text}` à `{count, id}`, donc D'une orpheline À une forme de référence. Les autres
  // liaisons (`{text}` → `{id}`/`{id, spec}`) sont NEUTRES ici : les deux formes comptent déjà.
  { dataset: "careerLevels.json", champ: "trappings", occurrences: 1286, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careers.json", champ: "class", occurrences: 108, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careers.json", champ: "grantGroups", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careers.json", champ: "tenue", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "classes.json", champ: "grantGroups", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "classes.json", champ: "trappings", occurrences: 56, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "combat-stakes.json", champ: "entryCategory", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "combat-stakes.json", champ: "kind", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "combat-stakes.json", champ: "rule", occurrences: 25, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "appearance", occurrences: 456, lot: "L2/L3 #1473", date: "2026-08-27" },
  { dataset: "creatures.json", champ: "features", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "grant", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "spec", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-30" }, // spécialisation homonyme d'un id, comptée comme référence par le scan. Solde : #1904
  { dataset: "creatures.json", champ: "grantGroups", occurrences: 90, lot: "L2/L3 #1473", date: "2026-08-26" }, // +2 : Mouton + Cochon ("bete"), EDOC 07 folio 24 (#673) ; +1 : Chien de trait, EDOC 07 folio 22, #673
  { dataset: "creatures.json", champ: "monster", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "optionals", occurrences: 649, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "remove", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "talents", occurrences: 1724, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "traits", occurrences: 3049, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "trappings", occurrences: 132, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "essential", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "roles", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "rule", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "apresDelai", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "onHealGrant", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "onNextCritWhileCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "ops", occurrences: 207, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "perRound", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "sequels", occurrences: 26, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "traumas", occurrences: 48, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "whenClear", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "diligence-projet.json", champ: "a", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "b", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "modes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "roomZoneIds", occurrences: 38, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "diligence-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "walls", occurrences: 668, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "amount", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "castBonus", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "casterOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "environments", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "of", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "ops", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "tables", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "drunkenness.json", champ: "ops", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "ops", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "passive", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "subject", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "flow", occurrences: 16, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "phase", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "rule", occurrences: 33, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "gods.json", champ: "grantGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "amount", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "entangle", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "free", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "init", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "groups.json", champ: "exceptGroups", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "interludeEvents.json", champ: "revenueBlockedClasses", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "interludeEvents.json", champ: "revenueClasses", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "land-cargo.json", champ: "biens", occurrences: 20, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "lieux-services.json", champ: "backdrop", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "lieux-services.json", champ: "merchantArchetype", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "localisation.json", champ: "rigs", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "locations.json", champ: "parent", occurrences: 46, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "a", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "ambush", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "ammo", occurrences: 16, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "appearance", occurrences: 19, lot: "L2/L3 #1473", date: "2026-09-01" },
  { dataset: "loup-et-saumure-projet.json", champ: "b", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "backdrop", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "choices", occurrences: 23, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "crew", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "crewIds", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "dialogueId", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "effect", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "from", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "members", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "merchant", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "postes", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "qualities", occurrences: 30, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "serviceKind", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "services", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "start", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "victoryCondition", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "weapon", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "ref", occurrences: 12, lot: "L2/L3 #1473", date: "2026-09-23" }, // #1473 R1 : 2 `prop` atteints (`idDe('prop')` de la branche `prop` de `sceneEntitySchema`, `defs-scenes/scene.ts:169`) + 10 `personnage` (`ref` en chaîne libre : dette réelle, #1882)
  { dataset: "maladies.json", champ: "dailyTest", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-01" }, // EDOC 08 l.104 (#674) — le Test quotidien DÉSIGNE son symptôme (#1657 geste A)
  { dataset: "maladies.json", champ: "symptoms", occurrences: 62, lot: "L2/L3 #1473", date: "2026-08-26" }, // +5 : Pneumonie (3) + Rhume commun (2), EDOC 08 folio 33 (#674) ; 54 → 62 : les 8 réfs à Difficulté PROPRE, jusque-là classées `test` (#1657 geste A)
  { dataset: "maneuvers.json", champ: "escapeStrength", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "maneuvers.json", champ: "ops", occurrences: 22, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchantFamilies.json", champ: "columns", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchantFamilies.json", champ: "match", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchants.json", champ: "subTypes", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchants.json", champ: "categories", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "miscast.json", champ: "onFail", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  // 38 → 39 (#1653 train A, 2026-09-04) : la rangée 81-87 de la Colère des dieux gagne UNE op qui
  // désigne un État (la cause récurrente de « Purifier la chair », LDB 40 l.75). Mesuré le 2026-09-23,
  // 0 / 39 atteintes : 35 cases `id` d'op `condition`, posées en `id: z.string().optional()` nu
  // (`src/data/schemas/defs/miscast.ts:54`) dans `jsonOpSchema`, sans `idDe` — aucun slot, dette
  // réelle ; l'une d'elles appartient à l'op dont la case `unlessCondition`
  // (`idDe('etat')`) est touchée, ce qui ne suffit pas. 4 cases `op` d'op `corruption` : discriminant
  // d'op que le scan compte comme référence. Solde : #1902.
  { dataset: "miscast.json", champ: "ops", occurrences: 39, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "montures.json", champ: "creatureIds", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "eyes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "features", occurrences: 54, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "ops", occurrences: 2, lot: "L3 #1473", date: "2026-08-31" }, // #862 : 1ʳᵉ op authorée de mutations.json (re-ciblage `onDayStart` de Haine sporadique)
  { dataset: "mutations.json", champ: "passive", occurrences: 43, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "naval-ports.json", champ: "production", occurrences: 38, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "naval-traits.json", champ: "passive", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "night-stakes.json", champ: "kind", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "night-stakes.json", champ: "rule", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "progression-schemas.derived.json", champ: "livres", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "progression-schemas.derived.json", champ: "titresPage", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "props.json", champ: "light", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" }, // 3→6 : +3 OCCURRENCES — les trois luminaires allumés par #1680 ligne 5 (`applique-murale` et `lustre-opera` en `chandelle`, `lanterne-de-poupe` en `lanterne`) portent un `light.tone`, comme les trois déjà comptés. Dette réelle, mesurée le 2026-09-23 : `tone` est un `z.string()` nu (`defs/props.ts:78`), aucun slot n'est déclaré à `[].light.tone`.
  { dataset: "psychology.json", champ: "becomes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "failCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "immuneToFromTarget", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "immuneWhileActive", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "ops", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "subject", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "targetCauses", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "beats", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "escapeStrength", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "opposed", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  // #1661 : 10 → 11 — le 2ᵉ État Hémorragique offert par Taillade (`AA 08 l.87`) est une op de plus
  // dans le MÊME champ `ops` déjà stocké, pas un champ de référence neuf.
  { dataset: "qualities.json", champ: "ops", occurrences: 11, lot: "L2/L3 #1473", date: "2026-09-05" },
  { dataset: "raceAppearance.json", champ: "featureKeys", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "gabarit", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "head", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "tenue", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "reglesOptionnelles.json", champ: "default", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "reglesOptionnelles.json", champ: "options", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "river-criticals.json", champ: "ops", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-events.json", champ: "escalation", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-events.json", champ: "params", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-events.json", champ: "skills", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-shanties.json", champ: "captainOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-shanties.json", champ: "crewOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "ship-construction.json", champ: "constructionTraits", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "ship-criticals.json", champ: "ops", occurrences: 11, lot: "L2/L3 #1473", date: "2026-09-04" }, // 5 → 11 (#1657 B3-2b-a) : 6 rangées MDG en prose gagnent leur `crewHit` (MDG 13 l.730/734/736/738/751/756)
  { dataset: "skills.json", champ: "altChar", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "skills.json", champ: "chars", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "skills.json", champ: "max", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "species.json", champ: "gatedByRule", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "species.json", champ: "grantGroups", occurrences: 27, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "species.json", champ: "of", occurrences: 80, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "species.json", champ: "talents", occurrences: 96, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "speciesRace.json", champ: "all", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "speciesRace.json", champ: "any", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "speciesRace.json", champ: "default", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "speciesRace.json", champ: "prefix", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "speciesRace.json", champ: "rules", occurrences: 22, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "addQualities", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "addTraits", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "cond", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "domainId", occurrences: 256, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "domains", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "exceptGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "of", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "onCross", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "onlyGroups", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  // 205 -> 206 (#1508 T3, 2026-09-07) : le Dôme gagne l'op TYPÉE `domeWard` (`traitId` + `indice`,
  // graphie canonique d'un octroi) — le Trait qu'il octroie était un `6` en dur dans le moteur. La
  // fabrique EST adoptée (`OP_DEFS.domeWard`, `idDe('trait')`, `grammaire/mecanique.ts:90`) : son
  // `traitId` est un slot, 1 / 206 atteintes au parse de mesure (#1473 R1, 2026-09-23). Les autres
  // occurrences sont dette réelle.
  { dataset: "spells.json", champ: "ops", occurrences: 185, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "perRound", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "qualities", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "when", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "stars.json", champ: "ascendant", occurrences: 11, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "stars.json", champ: "ops", occurrences: 42, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "symptoms.json", champ: "ops", occurrences: 8, lot: "L1b #1467", date: "2026-08-28" }, // les réfs du cycle (`onTick`) comptent ici, sous la feuille `EffectOp` du nœud `test` (#1657 B2b)
  { dataset: "symptoms.json", champ: "passive", occurrences: 3, lot: "L1b #1467", date: "2026-08-28" }, // #1599 : l'État *Exténué* du Malaise (LDB 20 l.188) s'écrit désormais en op `condition` du canal passif
  // #1599, 2026-09-06 : la fenêtre de Détermination d'une op `condition` PASSIVE (`resolveWindow`,
  // LDB 20 l.170) vise une règle optionnelle. Aucun site ne la valide : l'op `condition` est dans
  // `OPS_NON_TYPEES` (`grammaire/mecanique.ts:114`), et `refusLoose` (`:147`) ne lit pas `resolveWindow`
  // — dette réelle, mesuré le 2026-09-23. Se solde avec le typage strict de l'op `condition` dans `OP_DEFS`.
  { dataset: "symptoms.json", champ: "minutes", occurrences: 1, lot: "L1b #1467", date: "2026-09-06" },
  // #1599 : `severePassive` (6) est mort — les passifs s'indexent PAR PALIER (`passiveBySeverity`), en
  // le scan nomme le champ PORTEUR : `moderee` (Convulsions −20, LDB 20 l.157) et `grave` (Fièvre : le
  // seul État *Inconscient*, LDB 20 l.170 — le palier S'AJOUTE, les −10 de base tiennent sans être
  // recopiés). 6 → 6 + 1.
  { dataset: "symptoms.json", champ: "grave", occurrences: 1, lot: "L1b #1467", date: "2026-09-05" },
  { dataset: "tables.json", champ: "ops", occurrences: 67, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "effects", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "gate", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "matches", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "ops", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "when", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tavernGames.json", champ: "attrition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tavernGames.json", champ: "combined", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "affectsGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "amount", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "bonus", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "capabilities", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "cond", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "escapeStrength", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "grantGroups", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "grantsManeuvers", occurrences: 20, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "markMutations", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "of", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "ops", occurrences: 21, lot: "L2/L3 #1473", date: "2026-08-31" }, // +1 (#862) : État Exténué du réveil du Désespoir (VDM 09 l.280)
  { dataset: "traits.json", champ: "passive", occurrences: 5, lot: "L1b #1467", date: "2026-08-28" },
  { dataset: "traits.json", champ: "subject", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "suppressesCapabilities", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "value", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "cond", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "defaultAmmo", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "derivedWeapon", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "exceptGroups", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "onlyGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "ops", occurrences: 28, lot: "L1b #1467", date: "2026-08-28" },
  { dataset: "trappings.json", champ: "passive", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "qualities", occurrences: 438, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "shape", occurrences: 43, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "siegeRig", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "subject", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "subType", occurrences: 441, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "weaponGroup", occurrences: 22, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "byProsthesis", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "escalade", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "ops", occurrences: 16, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "prosthesis", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "rig", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "vehicles.json", champ: "draft", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "voyage-stakes.json", champ: "kind", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "voyage-stakes.json", champ: "rule", occurrences: 32, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "water-exposure.json", champ: "auto", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "weaponGroups.json", champ: "qualities", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "weather.json", champ: "physicalTestChars", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
];
