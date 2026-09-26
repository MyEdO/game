// STOCKS NOMINATIFS DATÉS du REGISTRE DES SLOTS (#1466 L1a, volet A).
// Consommés par `src/data/slots-contrat.test.ts`, mesurés par `scripts/docs/lib/slots-registre.mts`,
// rendus lisibles par `docs/structures-donnees.md` §6.
// Patron whitelist-en-lib du dépôt (`structuresStock.mjs`, `tableConsumerStock.mjs`).
//
// MANDAT — SOURCE UNIQUE `MANDAT_SLOTS` (`scripts/docs/lib/structures-lexique.mts`), jamais reformulé :
//   Ce volet est le REMPLAÇANT committé du « test FK générique » re-scopé au commentaire #1466 du 2026-08-23 : « le registre des SLOTS pour `docs/structures-donnees.md` (déclaré × observé) ».
//
// CE QUE MESURENT CES STOCKS :
//   - `SLOTS_SANS_DECLARATION` — un couple (dataset, champ) qui porte des références OBSERVÉES
//     (strate `Référence` du scan des deux racines) et qu'AUCUN slot DÉCLARÉ n'atteint. Le déclaré
//     est un PATH (`[].curated[]`), l'observé est plat : la jointure passe par la PROJECTION du path
//     sur son dernier segment-clé (`champDuPath`). Une ligne se solde en faisant ADOPTER la fabrique
//     de référence (`ref`/`refs`/`specRef`/`pick`) par le schéma du champ — concept par concept en
//     L2/L3 (#1473) — et part dans le MÊME commit que l'adoption.
//   - `SLOTS_INTERNES` — un slot d'espèce `id` dont le `type` est INCONNU du registre
//     `_ids.generated` : il vise une entité INTERNE à une scène, que ce volet ne sait pas résoudre.
//     Il se solde par `typedRef` en L2 (#1473).
// Les deux ne font que DÉCROÎTRE, à UNE exception NOMMÉE : une ligne dont la fabrique de référence est
// DÉJÀ ADOPTÉE au schéma du champ et dont les slots RÉSOLVENT, et que seule la PROJECTION sur le
// dernier segment-clé (angle mort ci-dessous) laisse hors jointure. Celle-là s'INSCRIT, parce qu'il
// n'y a rien à adopter : elle ne meurt qu'avec le dériveur descendu d'un niveau (L3 #1473), avec
// toute sa famille. Elle porte donc, à sa ligne, le path DÉCLARÉ et le champ OBSERVÉ qui divergent.
// Mesuré le 2026-09-18 : DIX lignes relèvent de cette exception — `reliefDefaults` et `roofDefaults`
// des quatre projets de scène et de `semences-de-scene.json`, tous servis par les MÊMES schémas de
// `defs-scenes/scene.ts` (`slotsStock.mjs:84-248` et ci-dessous) ; s'y ajoutent, de la même projection
// sur le dernier segment-clé, `props.json | light` (`[].light.tone` → `tone`) et `props.json |
// primitives` (`[].volume.primitives[]|N.material` → `material`), et les références ENVELOPPÉES de
// l'angle mort inverse (`buildings.json | features`, `ship-stations.json | requiresTrait`,
// `structures.json`/`vehicles.json | traits`).
// Tout autre cas reste une DÉRIVE : une référence neuve s'ADOPTE, elle ne s'inscrit pas.
// Symétrique, un DÉPART sans adoption : une ligne que la PROJECTION joint à une déclaration VOISINE
// (même dernier segment-clé, autre path) quitte le stock sans que son champ ait adopté la fabrique ;
// son compte vit alors à l'angle mort de projection (`ANGLES_MORTS_SLOTS`, ci-dessous), jamais ici.
// Mesuré le 2026-09-22 : les quatre lignes `<projet> | ref` (444 `ref` d'entités de scène), jointes
// à `worldMap.places[].port.ref` quand ce champ a adopté `idDe('navalPort')`.
//
// ANGLES MORTS — SOURCE UNIQUE `ANGLES_MORTS_SLOTS` (`scripts/docs/lib/structures-lexique.mts`),
// rendus aussi au doc §6.3 ; la garde compare les trois :
//   - L’espèce `acteur` (`actorRefSchema`) est HORS résolution : elle désigne l’acteur d’une mécanique par un ENUM, pas l’id d’une entité d’un dataset — ce n’est pas une FK.
//   - Un slot dont le `type` n’est pas un type du registre `_ids.generated` (entité INTERNE à une scène : pion, nœud de dialogue) n’est pas résoluble ici — l’index qui les porte est celui du scan (documents EMBARQUÉS), pas le registre généré. Ces slots sont au stock `SLOTS_INTERNES`, listés et jamais résolus ; l’unification passe par `typedRef` en L2 (#1473).
//   - La PROJECTION path → champ retient le DERNIER segment-clé : deux paths distincts qui finissent sur la même clé se joignent au même champ observé, et la couverture y est SUR-estimée — jusqu’à couvrir un champ ENTIER qu’aucun slot ne déclare. Mesuré le 2026-09-22 : la déclaration de `worldMap.places[].port.ref` (`idDe('navalPort')`) se joint aux `ref` des entités de scène des 4 paquets `*-projet.json` (444 occurrences : 314 `prop`, 130 `personnage`), qui ne portent AUCUN slot déclaré à leur path — le `ref` d’un décor est résolu par le `superRefine` par `kind` de `sceneEntitySchema` (`idDe('prop')`, #877), celui d’un personnage par aucun schéma (`defs-scenes/scene.ts`).
//   - Symétrique et INVERSE : une référence ENVELOPPÉE (`{id}` posé par `ref(type)`) projette sur la clé `id`, jamais sur le champ PORTEUR que le scan observe — mesuré 2026-09-01, `species.json › [].previewCareer.id` → `id`, `structures.json › [].traits[].id` → `id`, `vehicles.json › [].ship.traits[].id` → `id`. La couverture est donc SOUS-estimée sur toute référence à enveloppe, et la ligne de `SLOTS_SANS_DECLARATION` du champ porteur NE SE SOLDE PAS par l’adoption de la fabrique : elle survit à la migration qui la rendait caduque.
//   - `valeursAuPath` traverse une branche d’union (`|N`) sans la discriminer : la donnée ne porte pas la branche qui la parse, chaque branche lit donc les valeurs de toutes — mesuré le 2026-09-22 sur `props.json › [].volume.primitives[]|0..2.material`, 297 valeurs à chacune des trois branches : la résolution y est comptée une fois par branche.

/** Slots d'espèce `id` visant une entité INTERNE à une scène (type hors `_ids.generated`) :
 *  listés, JAMAIS résolus par ce volet. VIDE aujourd'hui — la garde asserte l'ÉGALITÉ, donc toute
 *  apparition est un rouge NOMINATIF, pas un silence. */
export const SLOTS_INTERNES = [];

export const SLOTS_SANS_DECLARATION = [
  { dataset: "actions.json", champ: "armed", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "gate", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "hote", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "keys", occurrences: 27, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "mode", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "actions.json", champ: "rule", occurrences: 32, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "chains", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "classes", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "cible", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-06" },
  { dataset: "activities.json", champ: "factor", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-06" },
  { dataset: "activities.json", champ: "mod", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-06" },
  { dataset: "activities.json", champ: "ops", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  // `rule` : la RÈGLE que l’Activité applique (`augure` → `tableau-augure`) ; `skills` 61 → 63 — les 2 voies
  // à Difficulté PROPRE rejoignent leurs 61 sœurs. Les deux étaient classées `test` par le seul `difficulty`
  // (#1657 geste A) : même donnée, mesurée sous le concept qui la nomme.
  { dataset: "activities.json", champ: "skills", occurrences: 64, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "activities.json", champ: "where", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "cancelsTraitId", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainId", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainIds", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domains", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "domainsExcept", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "environments", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "fluxTableId", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "spellIds", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arcane-phenomena.json", champ: "tableId", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "a", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "acts", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "ambush", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "appearance", occurrences: 25, lot: "L2/L3 #1473", date: "2026-09-01" }, // +3 : les 3 statblocs d'auteur muets (nuées de rats, dragon) portent leur Espèce
  { dataset: "arene-projet.json", champ: "b", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "choices", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "dialogueId", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "effect", occurrences: 72, lot: "L2/L3 #1473", date: "2026-09-11" }, // 76→72 (#1687 lot 3-I) : cette ligne dérive de `scan.formes` (`champsSansSlot`), et 4 objets `effect` d'`arene-projet.json` en sortent — non parce que leur donnée bouge (elle ne bouge pas, et ils vivent sous les flux de dialogue/déclencheur, jamais sous `interact`) mais parce que `choixDeclares` les ATTEINT désormais : `phase` et `lodging` sont déclarés à HEAD comme ici (`defs-scenes/effets.ts`), et c'est la marche de l'instrument — DFS mémoïsé borné à `PROFONDEUR_MEMO = 12` — qui change de chemin quand `interact` cède à `usable.actions[].flow` ; un littéral d'enum DÉCLARÉ n'est pas une clé étrangère (`structures-scan.mts:501`). Défaut d'instrument dit en tête de `horsStrateStock.mjs`, où ces 4 objets sont des entrées
  { dataset: "arene-projet.json", champ: "members", occurrences: 116, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "merchant", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "modes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "optionals", occurrences: 13, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "qualities", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  // #1691 : `<scène> › reliefDefaults` — la matière de chaque PARTIE de relief (falaise, rampe,
  // tablier, pilier), lue par `gameIso/builders/floors.ts`. Le SLOT EST DÉCLARÉ et il RÉSOUT :
  // `defs-scenes/scene.ts › reliefDefaultsSchema` pose `idDe('material','relief')` sur chacune des
  // quatre parties, mesuré 28/28 par partie au volet RÉSOLUTION. Ce qui laisse ces quatre lignes au
  // stock est l'ANGLE MORT déclaré en tête : le path `scenes[].reliefDefaults.cliff` se projette sur
  // `cliff`, jamais sur le champ PORTEUR `reliefDefaults` que le scan observe (le record entier y est
  // un nœud de référence à graphie divergente, stock L3 #1463 `structuresStock.mjs`). Même forme et
  // même solde que `props.json | light` (`light.tone` déclaré, `light` observé) : la ligne meurt avec
  // le dériveur d'un niveau, pas par une adoption au champ.
  { dataset: "arene-projet.json", champ: "reliefDefaults", occurrences: 18, lot: "L2/L3 #1473", date: "2026-09-07" },
  // #1715 : `<scène> › roofDefaults` — la couverture, la pente de RÉFÉRENCE et la borne de comble des
  // toitures DÉRIVÉES, lues par `toitureEffective` (`state/sceneEdit.ts`). MÊME forme et MÊME solde
  // que `reliefDefaults` ci-dessus : le slot EST déclaré et il RÉSOUT
  // (`defs-scenes/scene.ts › sceneRoofDefaultsSchema`, `idDe('material','roof')` sur `material`) ;
  // ce qui laisse ces quatre lignes au stock est l'ANGLE MORT déclaré en tête — le path
  // `scenes[].roofDefaults.material` se projette sur `material`, jamais sur le champ PORTEUR
  // `roofDefaults` que le scan observe. La ligne meurt avec le dériveur d'un niveau.
  { dataset: "arene-projet.json", champ: "roofDefaults", occurrences: 18, lot: "L2/L3 #1473", date: "2026-09-09" },
  { dataset: "arene-projet.json", champ: "roomZoneIds", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "scene", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "spells", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "start", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "traits", occurrences: 11, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "walls", occurrences: 235, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "weapon", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "arene-projet.json", champ: "skill", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "axes.json", champ: "skills", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "axes.json", champ: "talents", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
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
  { dataset: "barge-du-sel-projet.json", champ: "reliefDefaults", occurrences: 3, lot: "L2/L3 #1473", date: "2026-09-07" },
  { dataset: "barge-du-sel-projet.json", champ: "roofDefaults", occurrences: 3, lot: "L2/L3 #1473", date: "2026-09-09" },
  { dataset: "barge-du-sel-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "skills", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "barge-du-sel-projet.json", champ: "victoryCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  // La référence de PROP est ADOPTÉE (`features: z.array(ref('prop', { anchor }))`, `defs/buildings.ts`)
  // et elle RÉSOUT (4/4, volet RÉSOLUTION) : ce qui laisse la ligne ici est l'angle mort DÉCLARÉ de la
  // référence ENVELOPPÉE — `[].features[].id` projette sur `id`, jamais sur le champ porteur `features`.
  // Même forme que `structures.json | traits`, `vehicles.json | traits` et `ship-stations.json |
  // requiresTrait` : elle meurt avec le dériveur d'un niveau (L3 #1473), pas par une adoption au champ.
  { dataset: "buildings.json", champ: "features", occurrences: 4, lot: "L2/L3 #1473", date: "2026-09-09" },
  { dataset: "careerLevels.json", champ: "career", occurrences: 432, lot: "L2/L3 #1473", date: "2026-08-26" },
  // 27 → 29 (#1463 L-ref-1) : RAFRAÎCHISSEMENT DE COMPTE, pas un champ neuf — « Atelier (Ingénierie ou
  // Magie) » (alchimiste-4) devient l'emplacement `{choice:[{id,spec},{id,spec}]}` et pose 2 références
  // observées de plus sous le MÊME champ, déjà en dette d'adoption ici.
  { dataset: "careerLevels.json", champ: "choice", occurrences: 29, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careerLevels.json", champ: "of", occurrences: 11, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "careerLevels.json", champ: "skills", occurrences: 2237, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "careerLevels.json", champ: "talents", occurrences: 1724, lot: "L2/L3 #1473", date: "2026-08-26" },
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
  { dataset: "combat-stakes.json", champ: "kind", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "combat-stakes.json", champ: "rule", occurrences: 25, lot: "L2/L3 #1473", date: "2026-08-26" }, // 23 → 24 (#1657 B3-1) : l'enjeu `critRowTest` de la rangée de Critique nomme son foyer ; 24 → 25 (#1657 B3-2) : l'enjeu `shipCrewHit` du coup à l'équipage nomme le sien (`critiques-de-bateau`, MSRC 07 l.74)
  { dataset: "creatures.json", champ: "appearance", occurrences: 456, lot: "L2/L3 #1473", date: "2026-08-27" }, // +1 : Chien de trait, EDOC 07 folio 22, #673
  { dataset: "creatures.json", champ: "features", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "grant", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "spec", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-30" },
  { dataset: "creatures.json", champ: "grantGroups", occurrences: 90, lot: "L2/L3 #1473", date: "2026-08-26" }, // +2 : Mouton + Cochon ("bete"), EDOC 07 folio 24 (#673) ; +1 : Chien de trait, EDOC 07 folio 22, #673
  { dataset: "creatures.json", champ: "monster", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "optionals", occurrences: 649, lot: "L2/L3 #1473", date: "2026-08-26" }, // +2 : Trait Entêté optionnel sur Âne + Mule, EDOC 07 folio 22 (#673)
  { dataset: "creatures.json", champ: "remove", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "skills", occurrences: 5981, lot: "L2/L3 #1473", date: "2026-08-26" }, // −1 : doublon `riverain-respecte` supprimé du statbloc (687863ec6, skills 27→26) — compte non rafraîchi au commit
  { dataset: "creatures.json", champ: "spells", occurrences: 599, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "talents", occurrences: 1724, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "creatures.json", champ: "traits", occurrences: 3049, lot: "L2/L3 #1473", date: "2026-08-26" }, // +5 : Chien de trait, EDOC 07 folio 22, #673
  { dataset: "creatures.json", champ: "trappings", occurrences: 132, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-roles.json", champ: "skills", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "essential", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "roles", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "crew-test-types.json", champ: "rule", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  // #1657 B2a (2026-09-02) : `aa-criticals.json` (7 lignes / 144 occ.) et `criticals.json`
  // (11 lignes / 159 occ.) fusionnent — 18 lignes → 10, à occurrences CONSTANTES (303), le stock
  // DÉCROÎT en LIGNES sans qu'une seule référence sorte de la mesure. Ce qui a bougé, nommément :
  // `onFail` (18+24 = 42) rejoint `ops` (85+88 = 173 → 215) : la conséquence d'un jet vit
  // dans la branche `fail` du nœud `test` ; les 9 autres couples se somment simplement
  // (1+1 → 2, 13+13 → 26, 24+24 → 48, 2+2 → 4) ou restent propres au LDB (`onHealGrant`,
  // `onNextCritWhileCondition`, `subject`, `whenClear` — aucune ligne AA ne les portait).
  { dataset: "criticals.json", champ: "apresDelai", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "onHealGrant", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "onNextCritWhileCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "ops", occurrences: 215, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "perRound", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "recoveryPenalty", occurrences: 4, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "sequels", occurrences: 26, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "skill", occurrences: 39, lot: "L2/L3 #1473", date: "2026-09-02" }, // #1657 B3-1 : les 39 nœuds `test` nomment la Compétence de leur `desc` verbatim (même couple que `spells | skill`)
  { dataset: "criticals.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "criticals.json", champ: "traumas", occurrences: 48, lot: "L2/L3 #1473", date: "2026-09-02" },
  { dataset: "criticals.json", champ: "whenClear", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "diligence-projet.json", champ: "a", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "b", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "modes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "reliefDefaults", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-07" },
  { dataset: "diligence-projet.json", champ: "roofDefaults", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-09" },
  { dataset: "diligence-projet.json", champ: "roomZoneIds", occurrences: 38, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "diligence-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "diligence-projet.json", champ: "walls", occurrences: 668, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "amount", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "castBonus", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "casterOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "environments", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "of", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "ops", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "requiresSkill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "tables", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "domains.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "drunkenness.json", champ: "ops", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "exceptSkills", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "ops", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "passive", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "subject", occurrences: 10, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "etats.json", champ: "value", occurrences: 2, lot: "L1b #1467", date: "2026-08-28" },
  { dataset: "etats.json", champ: "skill", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "flow", occurrences: 16, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "phase", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "flow-stakes.json", champ: "rule", occurrences: 33, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "gods.json", champ: "blessings", occurrences: 90, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "gods.json", champ: "chaosSpells", occurrences: 17, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "gods.json", champ: "grantGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "gods.json", champ: "miracles", occurrences: 96, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "amount", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "entangle", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "free", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "grapple.json", champ: "init", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "groups.json", champ: "exceptGroups", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "incidents-monture.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-30" },
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
  { dataset: "loup-et-saumure-projet.json", champ: "appearance", occurrences: 19, lot: "L2/L3 #1473", date: "2026-09-01" }, // +8 : l'équipage exposé des deux abordages portait un statbloc sans apparence
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
  { dataset: "loup-et-saumure-projet.json", champ: "port", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "postes", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "qualities", occurrences: 30, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "reliefDefaults", occurrences: 5, lot: "L2/L3 #1473", date: "2026-09-07" },
  { dataset: "loup-et-saumure-projet.json", champ: "roofDefaults", occurrences: 5, lot: "L2/L3 #1473", date: "2026-09-09" },
  { dataset: "loup-et-saumure-projet.json", champ: "scene", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "serviceKind", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "services", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "skills", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "start", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "victoryCondition", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "weapon", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "loup-et-saumure-projet.json", champ: "skill", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "maladies.json", champ: "mutation", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" }, // mue Rhume → Pneumonie, EDOC 08 l.122 (#674)
  { dataset: "maladies.json", champ: "ops", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" }, // cycle quotidien de la Pneumonie, EDOC 08 l.104-108 (#674) — champ `onFail` → `ops` (#1657 B2b)
  { dataset: "maladies.json", champ: "otherwise", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-31" }, // échelon Toxine du même cycle, EDOC 08 l.106-108 (#674)
  { dataset: "maladies.json", champ: "dailyTest", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-01" }, // EDOC 08 l.104 (#674) — le Test quotidien DÉSIGNE son symptôme (#1657 geste A)
  { dataset: "maladies.json", champ: "symptoms", occurrences: 62, lot: "L2/L3 #1473", date: "2026-08-26" }, // +5 : Pneumonie (3) + Rhume commun (2), EDOC 08 folio 33 (#674) ; 54 → 62 : les 8 réfs à Difficulté PROPRE, jusque-là classées `test` (#1657 geste A)
  { dataset: "maneuvers.json", champ: "escapeStrength", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "maneuvers.json", champ: "ops", occurrences: 22, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "maneuvers.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchantFamilies.json", champ: "columns", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchantFamilies.json", champ: "match", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchants.json", champ: "subTypes", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "merchants.json", champ: "categories", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "miscast.json", champ: "onFail", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  // 38 → 39 (#1653 train A, 2026-09-04) : la rangée 81-87 de la Colère des dieux gagne UNE op qui
  // désigne un État (la cause récurrente de « Purifier la chair », LDB 40 l.75). Le champ MESURÉ est le
  // CONTENEUR `ops` (signature de l'objet-op), pas le champ de référence : son `unlessCondition` a bien
  // ADOPTÉ la fabrique (`idDe('etat')`, `defs/miscast.ts`) et est un slot DÉCLARÉ résolu, sans que la
  // ligne du porteur se solde — angle mort DIT du volet (`ANGLES_MORTS_SLOTS` : la projection path →
  // champ retient le dernier segment-clé, jamais le champ porteur observé).
  { dataset: "miscast.json", champ: "ops", occurrences: 39, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "miscast.json", champ: "skill", occurrences: 26, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "montures.json", champ: "creatureIds", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "eyes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "features", occurrences: 54, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "ops", occurrences: 2, lot: "L3 #1473", date: "2026-08-31" }, // #862 : 1ʳᵉ op authorée de mutations.json (re-ciblage `onDayStart` de Haine sporadique)
  { dataset: "mutations.json", champ: "passive", occurrences: 106, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "mutations.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "naval-ports.json", champ: "production", occurrences: 38, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "naval-traits.json", champ: "passive", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "naval-traits.json", champ: "skill", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "night-stakes.json", champ: "kind", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "night-stakes.json", champ: "rule", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "pregens.json", champ: "career", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "pregens.json", champ: "species", occurrences: 8, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "progression-schemas.derived.json", champ: "livres", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "progression-schemas.derived.json", champ: "titresPage", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "props.json", champ: "light", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" }, // 3→6 : +3 OCCURRENCES — les trois luminaires allumés par #1680 ligne 5 (`applique-murale` et `lustre-opera` en `chandelle`, `lanterne-de-poupe` en `lanterne`) portent un `light.tone`, comme les trois déjà comptés. L'ADOPTION de la fabrique NE SOLDE PAS cette ligne, mesuré le 2026-09-02 : `idDe('lightTone')` sur `light.tone` déclare un slot au path `[].light.tone`, que `champDuPath` projette sur `tone` — jamais sur le champ PORTEUR `light` que le scan observe (angle mort déclaré en tête de ce fichier). La ligne se solde avec cet angle mort, pas avant.
  { dataset: "props.json", champ: "primitives", occurrences: 379, lot: "L2/L3 #1473", date: "2026-08-26" }, // EXCEPTION NOMMÉE d'angle mort (en-tête) : fabrique ADOPTÉE (`idDe('material', 'prop')`, `defs/props.ts`), slots RÉSOLUS ; path DÉCLARÉ `[].volume.primitives[]|N.material` projeté sur `material`, champ OBSERVÉ `primitives`. 89 → 172 (#1644 lot A) → 297 (#1343 lot B) → 379 (#1343 lot C) : les recettes volumiques du catalogue
  { dataset: "psychology.json", champ: "becomes", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "failCondition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "immuneToFromTarget", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "immuneWhileActive", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "ops", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "subject", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "targetCauses", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "psychology.json", champ: "skill", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "beats", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "escapeStrength", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "opposed", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "qualities.json", champ: "passive", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-28" },
  // #1661 : 10 → 11 — le 2ᵉ État Hémorragique offert par Taillade (`AA 08 l.87`) est une op de plus
  // dans le MÊME champ `ops` déjà stocké, pas un champ de référence neuf.
  { dataset: "qualities.json", champ: "ops", occurrences: 11, lot: "L2/L3 #1473", date: "2026-09-05" },
  { dataset: "qualities.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "featureKeys", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "gabarit", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "head", occurrences: 7, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "raceAppearance.json", champ: "tenue", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "reglesOptionnelles.json", champ: "default", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "reglesOptionnelles.json", champ: "options", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "river-criticals.json", champ: "ops", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" }, // `onFail` mort, `ops` 4 → 5 (#1657 B2c) : la conséquence du coup à l'équipage vit sous la feuille `EffectOp` du nœud `test`
  { dataset: "sea-events.json", champ: "escalation", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-events.json", champ: "params", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-events.json", champ: "skills", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-shanties.json", champ: "captainOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-shanties.json", champ: "crewOps", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-shanties.json", champ: "skill", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-weather.json", champ: "skills", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "sea-weather.json", champ: "spec", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  // #1716 : `semences-de-scene.json › reliefDefaults` / `› roofDefaults` — la SEMENCE d'une scène neuve
  // porte les deux MÊMES records que les quatre projets de scène ci-dessus, et par les MÊMES schémas :
  // `defs/semences-de-scene.ts` compose `reliefDefaultsSchema` et `sceneRoofDefaultsSchema` de
  // `defs-scenes/scene.ts`, jamais une copie. Les slots sont donc DÉCLARÉS et ils RÉSOLVENT (mesuré :
  // `reliefDefaults.cliff|ramp|deck|pilier` et `roofDefaults.material`, 5 slots `material` au volet
  // RÉSOLUTION) — la fabrique EST adoptée, il n'y a rien à adopter de plus. Ces deux lignes sont
  // l'ANGLE MORT déclaré en tête, celui de `buildings.json | features` (#1715) : le path projette sur
  // le DERNIER segment (`cliff`, `material`), jamais sur le champ PORTEUR que le scan observe. Elles
  // meurent avec le dériveur d'un niveau (L3 #1473), avec les huit lignes des quatre projets.
  { dataset: "semences-de-scene.json", champ: "reliefDefaults", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-18" },
  { dataset: "semences-de-scene.json", champ: "roofDefaults", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-18" },
  { dataset: "ship-construction.json", champ: "constructionTraits", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "ship-criticals.json", champ: "ops", occurrences: 11, lot: "L2/L3 #1473", date: "2026-09-04" }, // 5 → 11 (#1657 B3-2b-a) : 6 rangées MDG en prose gagnent leur `crewHit` (MDG 13 l.730/734/736/738/751/756)
  { dataset: "ship-criticals.json", champ: "skill", occurrences: 12, lot: "L2/L3 #1473", date: "2026-09-04" }, // NEUF (#1657 B3-2b-a) : les 6 nœuds MDG + « Canon détaché » nomment l’Athlétisme de leur `note` verbatim ; 7 → 12 (#1657 B3-2b-c) : les 5 rangées du gréement (MDG 13 l.711/714/715/717/718)
  { dataset: "ship-stations.json", champ: "requiresTrait", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-04" }, // NEUF (#1657 B3-2b-a) : `ref('navalTrait')` ADOPTÉ, mais la réf ENVELOPPÉE projette sur `id` — même angle mort documenté que `vehicles.json | traits`
  { dataset: "skills.json", champ: "altChar", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "skills.json", champ: "chars", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "skills.json", champ: "max", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "species.json", champ: "gatedByRule", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "species.json", champ: "grantGroups", occurrences: 27, lot: "L2/L3 #1473", date: "2026-08-26" },
  // Le champ a CHANGÉ DE NOM au L-gram-2 (#1463) et a ADOPTÉ `ref('career')` — la ligne survit
  // pourtant : le slot déclaré est `[].previewCareer.id`, que la projection rend `id` (angle mort
  // SOUS-estimation, `ANGLES_MORTS_SLOTS`). Ce n'est pas une dette d'adoption, c'est la mesure qui
  // ne sait pas la voir.
  { dataset: "species.json", champ: "previewCareer", occurrences: 27, lot: "L2/L3 #1473", date: "2026-09-01" },
  // NEUF (#1882) : `ref('creature')` ADOPTÉ (profil standard, LDB 77 l.7), même angle mort que `previewCareer`.
  { dataset: "species.json", champ: "profilStandard", occurrences: 26, lot: "L2/L3 #1473", date: "2026-09-23" },
  { dataset: "species.json", champ: "of", occurrences: 80, lot: "L2/L3 #1473", date: "2026-08-31" },
  { dataset: "species.json", champ: "skills", occurrences: 315, lot: "L2/L3 #1473", date: "2026-08-26" },
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
  // fabrique EST adoptée (`OP_DEFS.domeWard`, `idDe('trait')`) ; ce qui inscrit la ligne ici est
  // l'angle mort déjà nommé par ce volet, le même que `removeTrait.traitId` : le scan mesure l'objet-op
  // au CHAMP PORTEUR (`ops`), le slot se projette sur le dernier segment (`traitId`).
  { dataset: "spells.json", champ: "ops", occurrences: 206, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "perRound", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "qualities", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "subject", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "when", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "spells.json", champ: "skill", occurrences: 50, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "stars.json", champ: "ascendant", occurrences: 11, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "stars.json", champ: "ops", occurrences: 55, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "steam-breakdown.json", champ: "skill", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-30" },
  { dataset: "structures.json", champ: "traits", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "symptoms.json", champ: "ops", occurrences: 12, lot: "L1b #1467", date: "2026-08-28" }, // 12 : les réfs du cycle (`onTick`) comptent ici, sous la feuille `EffectOp` du nœud `test` (#1657 B2b)
  { dataset: "symptoms.json", champ: "passive", occurrences: 26, lot: "L1b #1467", date: "2026-08-28" }, // 25 → 26 (#1599) : l'État *Exténué* du Malaise (LDB 20 l.188) s'écrit désormais en op `condition` du canal passif
  // #1599, 2026-09-06 : la fenêtre de Détermination d'une op `condition` PASSIVE (`resolveWindow`,
  // LDB 20 l.170) vise une règle optionnelle. La fabrique EST adoptée (`idDe('regleOptionnelle')`,
  // `grammaire/valeurs.ts › formulaSchema`) et l'id résout au parse ; le couple reste ici parce que le
  // slot n'est pas sur le CHEMIN de la marche : `gameOpSchema` est un `looseObject` + superRefine, donc
  // aucune référence portée par le payload d'une op n'apparaît en slot déclaré (même angle mort que
  // `passive`/`ops` ci-dessus). Se solde avec le typage strict de l'op `condition` dans `OP_DEFS`.
  { dataset: "symptoms.json", champ: "minutes", occurrences: 1, lot: "L1b #1467", date: "2026-09-06" },
  // #1599 : `severePassive` (6) est mort — les passifs s'indexent PAR PALIER (`passiveBySeverity`), en
  // le scan nomme le champ PORTEUR : `moderee` (Convulsions −20, LDB 20 l.157) et `grave` (Fièvre : le
  // seul État *Inconscient*, LDB 20 l.170 — le palier S'AJOUTE, les −10 de base tiennent sans être
  // recopiés). 6 → 6 + 1.
  { dataset: "symptoms.json", champ: "moderee", occurrences: 6, lot: "L1b #1467", date: "2026-09-05" },
  { dataset: "symptoms.json", champ: "grave", occurrences: 1, lot: "L1b #1467", date: "2026-09-05" },
  // #1657 B3-3 : Blessé et Toxine nomment la Compétence de leur RAW (« Test de Résistance », LDB 20
  // l.145/l.212) dans leur nœud `test` — MÊME fabrique `SkillRef` que `criticals | skill` (39) et
  // `spells | skill`, donc MÊME angle mort de projection (une référence ENVELOPPÉE `{id}` projette
  // sur la clé `id`, jamais sur son champ porteur — déclaré en tête de ce fichier) : la ligne ne se
  // solde pas par l'adoption, elle attend `typedRef` (L2 #1473) comme ses 2 sœurs.
  { dataset: "symptoms.json", champ: "skill", occurrences: 2, lot: "L2/L3 #1473", date: "2026-09-03" },
  { dataset: "symptoms.json", champ: "visiblePassive", occurrences: 1, lot: "L1b #1467", date: "2026-08-28" },
  { dataset: "tables.json", champ: "of", occurrences: 1, lot: "L2/L3 #1473", date: "2026-09-06" }, // #1612 : le terme `{rule}` de l'amende des gardes (`mendier-ennuis`), porté par `times.of` d'une `Formula`. MÊME angle mort que ses sœurs `activities.json | cible/factor/mod` — `formulaSchema` EST une union, et `valeursAuPath` ne descend pas dans une branche d'union.
  { dataset: "tables.json", champ: "ops", occurrences: 79, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tables.json", champ: "skill", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "effects", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "gate", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "matches", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "ops", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "passive", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "skill", occurrences: 123, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "skills", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "talents.json", champ: "when", occurrences: 12, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tavernGames.json", champ: "attrition", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tavernGames.json", champ: "combined", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "tavernGames.json", champ: "skill", occurrences: 14, lot: "L2/L3 #1473", date: "2026-08-26" },
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
  { dataset: "traits.json", champ: "passive", occurrences: 49, lot: "L1b #1467", date: "2026-08-28" }, // +1 : Trait Entêté (charMod FM), EDOC 07 folio 22 (#673)
  { dataset: "traits.json", champ: "subject", occurrences: 6, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "suppressesCapabilities", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "value", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traits.json", champ: "skill", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "cond", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "defaultAmmo", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "derivedWeapon", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "diseases", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "exceptGroups", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "onlyGroups", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "ops", occurrences: 53, lot: "L1b #1467", date: "2026-08-28" },
  { dataset: "trappings.json", champ: "passive", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "qualities", occurrences: 438, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "shape", occurrences: 43, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "siegeRig", occurrences: 18, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "subject", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "subType", occurrences: 441, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "weaponGroup", occurrences: 22, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "trappings.json", champ: "skill", occurrences: 29, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "byProsthesis", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "escalade", occurrences: 3, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "ops", occurrences: 16, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "prosthesis", occurrences: 9, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "rig", occurrences: 2, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "traumas.json", champ: "skill", occurrences: 13, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "vehicles.json", champ: "draft", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "vehicles.json", champ: "traits", occurrences: 20, lot: "L2/L3 #1473", date: "2026-09-04" }, // 19 → 20 (#1657 B3-2b-a) : la barge fluviale gagne le Trait `cale` (MSRC 07 l.94, MSRC 10 l.90)
  { dataset: "voyage-stakes.json", champ: "kind", occurrences: 15, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "voyage-stakes.json", champ: "rule", occurrences: 32, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "water-exposure.json", champ: "auto", occurrences: 4, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "weaponGroups.json", champ: "qualities", occurrences: 5, lot: "L2/L3 #1473", date: "2026-08-26" },
  { dataset: "weather.json", champ: "physicalTestChars", occurrences: 1, lot: "L2/L3 #1473", date: "2026-08-26" },
];
