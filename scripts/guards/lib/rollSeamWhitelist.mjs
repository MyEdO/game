// Whitelist PARTAGÉE du garde « exclusivité du seam de jet » (#274) — SOURCE UNIQUE consommée par
// `src/state/roll-seam-exclusivity-guard.test.ts` (Vitest) ET `scripts/git-hooks/pre-commit.mjs`
// (double détente). Deux listes DISJOINTES, de nature différente :
//
//  1. `ROLL_SEAM_CORE` — exclusion de PRINCIPE : ces fichiers SONT le seam (la porte, la fabrique, le
//     séquenceur, les résolveurs de spec, le pont de Test déclenché en combat). Leur `rollTest(`/
//     `TestOutcome.seal(` est le foyer que le garde protège, pas un contournement : les exclure n'est
//     pas une exemption mais la définition du périmètre. Aucun compte : cette liste ne décroît pas.
//  2. `ROLL_SEAM_PHASE2_STOCK` — stock MESURÉ de sites restant à router par le seam (#918 phase 2),
//     fichier → nombre de sites. Le compte est VÉRIFIÉ par le test : un site de plus dans un de ces
//     fichiers est rouge, et un site migré exige de mettre le compte à jour ICI. Cette liste décroît
//     jusqu'à disparaître ; on n'y ajoute pas de fichier.
//     DEUX sorties LÉGITIMES du stock, pas une seule : (a) `openRoll` — le jet est SURFACÉ (policy
//     M/V/I) ; (b) `rollSansPilote` (`rollSeam.ts`) — le call-site a DÉJÀ établi qu'aucun humain ne
//     contrôle l'acteur, le jet reste inline mais l'invariant (« pas de jet silencieux d'un acteur
//     `humanControlled` ») est asserté dans le noyau au lieu d'être bricolé au call-site. La phase 2a
//     a fait 51 → 39 par la voie (b) sur 12 sites (roundHooks 4→1, turnHooks 1→0, combatFlow 10→5,
//     shipwreck 2→0, travelFlow 7→6).
//
// Les formes (S) « position de spec » et (M) « dé de monde » ne sont PLUS des entrées de liste : elles
// sont reconnues STRUCTURELLEMENT par le scanner (cf. en-tête de `rollSeamExclusivity.mjs`).
// `rollFlowFactory.ts` a rejoint le noyau, et `encounterPsychFlow.ts`/`restFlow.ts` n'avaient plus
// AUCUN site (leurs occurrences vivaient dans des commentaires).
//
// (M) N'EST PLUS UN TROU MUET (#1426) : une exemption STRUCTURELLE ne laisse par construction aucune
// liste visible, et celle-ci a absorbé jusqu'à 11 sites hors moteur sans qu'un seul chiffre bouge.
// `WORLD_DIE_SUBTRACTED_STOCK` (plus bas) PUBLIE désormais ce qu'elle soustrait, fichier par fichier ;
// il est une DETTE À CIBLE ZÉRO (patron `ROLL_SEAM_PHASE2_STOCK`), jamais un registre d'équilibre :
// chaque entrée porte sa raison et MEURT par migration vers l'une des trois portes du canal
// (`rollSeam.openWorldTest` surfacé, `cascade.rollTableStep` en table, `engine/dice.deMonde`
// silencieux). Une fois la liste vide, le compteur reste comme garde ANTI-RÉCIDIVE : tout nouveau
// `d100(` blanchi par (M) hors `src/engine/**` est rouge NOMINATIVEMENT.

/** Le seam lui-même — exclusion de principe, sans compte. @type {Set<string>} */
export const ROLL_SEAM_CORE = new Set([
  'src/state/rollSeam.ts',
  'src/state/rollFlowFactory.ts',
  'src/state/cascade.ts',
  'src/state/rollFlowSpecs.ts',
  'src/state/combat/triggeredTest.ts',
]);

/** Stock à résorber (#918 phase 2) : fichier → nombre de sites MESURÉ. @type {Map<string, number>} */
export const ROLL_SEAM_PHASE2_STOCK = new Map([
  ['src/state/combat/roundHooks.ts', 1],
  ['src/state/combatEffects.ts', 1],
  ['src/state/combatFlow.ts', 3], // 5 → 3 (#1117 L4 : la voie INLINE des jets de fin de combat meurt — Contraction et Corruption sont des BANDES, résolues d'office pour les porteurs non pilotés)
  ['src/state/combatManeuvers.ts', 4],
  ['src/state/corruptionFlow.ts', 1], // 2 → 1 (#942 L5 : le d100 « corps ou esprit » passe par l'étape à table)
  ['src/state/interludeFlow.ts', 3], // 4 → 3 (#942 L7 : le d100 d'Événement passe par l'étape à table)
  ['src/state/massBattleFlow.ts', 1],
  ['src/state/pursuitFlow.ts', 1],
  ['src/state/riverVoyageFlow.ts', 3],
  ['src/state/seaVoyageFlow.ts', 4], // #1501 : 1 jet de l'adversaire d'une Poursuite (:1851) + les 3 Tests de reprise de machine de `runRestart` (:2024/:2027/:2028), roulés en boucle bornée hors modale
  ['src/state/shipManeuver.ts', 2],
  ['src/state/travelFlow.ts', 3], // 6→3 au câblage allure forcée (#673 L3) : les 3 rollTest inline (conducteur + 2 Résistance des bêtes) ont MIGRÉ vers les résolveurs purs de vehicle.ts (forcedPaceCheck/forcedPaceBeastCheck), comptés au stock (D)
  ['src/state/travelPostes.ts', 1],
  ['src/state/triggeredEffects.ts', 1],
  // `src/state/upkeep.ts` : 2 → 0 (#1657 B3-3) — les 2 `rollTest` du Dessoûlage (LDB 09 l.485) meurent
  // avec le chemin eager de l'entretien : `runDailyUpkeep` EXIGE désormais sa porte (`onDeferTest`
  // requis au type), et les deux Tests partent en étapes influençables comme leurs voisins.
]);

/**
 * (M) CE QUE L'EXEMPTION « DÉ DE MONDE » SOUSTRAIT (#1426) — fichier → nombre de sites `d100(` que le
 * scanner blanchit STRUCTURELLEMENT, hors `src/engine/**` (le moteur reçoit un rng, il ne décide pas
 * du surfaçage : ses sites sont déjà inventoriés à leur CALL-SITE dans `ENGINE_DELEGATED_ROLL_STOCK`,
 * les compter ici serait un double compte).
 *
 * DETTE À CIBLE ZÉRO, comme `ROLL_SEAM_PHASE2_STOCK` : chaque entrée nomme le ticket qui l'emporte et
 * disparaît par migration vers une porte du canal — jamais par relèvement du compte. Le test
 * (`roll-seam-exclusivity-guard.test.ts`) vérifie le compte À L'UNITÉ dans les DEUX sens : un site de
 * plus est une régression NOMMÉE, un site migré doit être soldé ici, une entrée retombée à 0 est
 * PÉRIMÉE. Mesure au scanner CANONIQUE (`scanRollSeamExclusivity(..., { includeExcluded: true })`),
 * jamais un fork instrumenté — deux comptes du même stock divergent toujours.
 *
 * @type {Map<string, { n: number, why: string }>}
 */
export const WORLD_DIE_SUBTRACTED_STOCK = new Map([
  // VIDE — la forme (M) ne soustrait plus RIEN hors `src/engine/**` (#1426 soldé). Le compteur RESTE :
  // il est désormais une garde ANTI-RÉCIDIVE, et c'est le test qui le rend mordant (tout fichier
  // mesuré et absent d'ici est rouge NOMINATIVEMENT). Une entrée ne se rajoute pas pour « faire
  // passer » un site : elle se rajoute avec le ticket qui l'emporte, ou le site se route par une des
  // trois portes du canal.
]);

/** @type {Set<string>} */
export const ROLL_SEAM_FILE_WHITELIST = new Set([...ROLL_SEAM_CORE, ...ROLL_SEAM_PHASE2_STOCK.keys()]);

/** @param {string} rel @returns {boolean} */
export function rollSeamExcluded(rel) {
  return rel.startsWith('src/engine/') || ROLL_SEAM_FILE_WHITELIST.has(rel);
}

// ===========================================================================================
// REGISTRE DES CHEMINS DE JET (#1066) — la POLICY des deux familles neuves scannées par
// `rollSeamExclusivity.mjs` (`scanPendingJetFabrication`, `engineRollerExports` +
// `scanEngineDelegatedRoll`), plus l'énumération des familles CANONIQUES d'ouverture de jet.
// SOURCE UNIQUE : le test Vitest la VÉRIFIE (compte mesuré = compte déclaré, aucune entrée sans
// justification, aucune entrée périmée) et la doc `docs/registre-jets.md` en est DÉRIVÉE.
// ===========================================================================================

/**
 * Entrée de stock : nombre de sites MESURÉ + `kind` + justification ÉCRITE. Le `kind` porte
 * l'INVARIANT de l'entrée — sans lui, « cette liste décroît » (en-tête de `ROLL_SEAM_PHASE2_STOCK`)
 * ne vaut que pour une partie des entrées, et un lot futur ne sait pas laquelle doit tomber à zéro.
 * TROIS états, chacun VÉRIFIÉ par le test — le tri de population est SOLDÉ (#1070) : chaque entrée est
 * qualifiée site par site, et `'tri'` n'est plus une valeur acceptée (contrat POSITIF du garde).
 *  - `'dette'`     — TOUS les sites doivent disparaître ; `why` cite le ticket (`#N`) qui les emporte.
 *  - `'canonique'` — aucun site ne bouge ; `why` COMMENCE par « canonique » et dit la raison mesurée.
 *  - `'mixte'`     — l'entrée porte les deux natures (l'entrée ne tombera pas à 0) ; `why` cite un
 *                    ticket ET le mot « canonique ».
 * @typedef {{ n: number, kind: 'dette'|'canonique'|'mixte', why: string }} StockEntry
 */

/**
 * (F) FABRICATION D'UN PENDING DE JET — fichier → { sites mesurés, kind, justification }.
 * Population figée AVANT le lot d'affichage #1064 : ce qui n'est pas ici est une régression.
 * @type {Map<string, StockEntry>}
 */
export const PENDING_JET_FABRICATION_STOCK = new Map([
  ['src/state/combatEffects.ts', { n: 1, kind: 'canonique', why: 'canonique : le corps d\'`openSkillTest` (combatEffects.ts:326) — LA fabrique du `pendingTest` de la famille Flow authorée, le pending y est monté UNE fois pour tous ses appelants.' }],
  ['src/state/combatFlow.ts', { n: 2, kind: 'mixte', why: '1 gate de main (`pendingHandGate`, `openAttackCascade`) monté à la main -> #1064 ; 1 `PendingReload` d\'ennemi construit APRÈS un `rollSansPilote` déjà scellé — canonique : objet de RENDU (journal/popin), aucun jet à ouvrir.' }],
  ['src/state/combatSlice.ts', { n: 5, kind: 'dette', why: '2 `pendingReload` (pièce servie / poste de navire), 1 `pendingStateRecovery`, 1 `pendingHandGate` (2ᵉ main), 1 `pendingHeal` -> #1064 (le lot d\'affichage les re-route ; 6 -> 5 : le `pendingTest` de `battleGainAdvantage` passe par `openSkillTest`).' }],
  ['src/state/interludeFlow.ts', { n: 1, kind: 'dette', why: '`pendingActivity` du catalogue d\'Activités (`openCatalogActivity`) — fabrique UNIQUE de toutes les Activités à jet d\'interlude -> #1064.' }],
  ['src/state/massBattleFlow.ts', { n: 1, kind: 'dette', why: '`openBattleActivity` — fabrique PARTAGÉE, atteinte par 6 call-sites (prep ×3/round ×2/resistance) -> #1067 (surfaçage massBattle).' }],
  ['src/state/medicFlow.ts', { n: 2, kind: 'dette', why: '`pendingHeal` et `pendingSurgery` du soigneur PNJ hors combat -> #1064.' }],
  ['src/state/merchantFlow.ts', { n: 1, kind: 'dette', why: '`pendingAppraise` (Évaluation / Intuition de détection) -> #1064.' }],
  ['src/state/seaVoyageFlow.ts', { n: 1, kind: 'dette', why: '`pendingSteamSave` (`openSteamSave`, Test d\'Initiative de l\'ingénieur) : le flux a bien sa spec canonique (`rollFlowSpecs.ts` `steamSave`, `makeRollFlow`), c\'est la FABRIQUE du pending qui reste montée à la main -> #1474.' }],
  ['src/state/store.ts', { n: 1, kind: 'canonique', why: 'canonique : re-ciblage d\'un `pendingTest` EXISTANT (`{ ...pt, … }`) sur un autre candidat — `target` recopié du candidat DÉJÀ calculé par la fabrique, aucun jet neuf décrit.' }],
]);

/**
 * (D) ROULAGE DÉLÉGUÉ AU MOTEUR — fichier → { call-sites mesurés, kind, justification }. Un site = un
 * appel, depuis `src/state`/`src/ui`, d'un export de `src/engine` qui roule (liste DÉRIVÉE par
 * `engineRollerExports`, clôture transitive). Les fichiers de `ROLL_SEAM_CORE` sont hors périmètre
 * (ils SONT le seam) ; la forme (S) « position de spec » garde son exclusion structurelle.
 * @type {Map<string, StockEntry>}
 */
export const ENGINE_DELEGATED_ROLL_STOCK = new Map([
  ['src/state/combat/roundHooks.ts', { n: 1, kind: 'dette', why: '`bleedDeathRoll` (Hémorragie mortelle) roulé en fin de ronde -> #1064.' }],
  ['src/state/combat/turnHooks.ts', { n: 6, kind: 'dette', why: 'psychologie de début de tour (`resolveFrenzyEntry`/`resolveTerreurTest`/`resolvePeurTest` ×2/`resolveCalmeSimple` ×2) -> #1064.' }],
  ['src/state/combatEffects.ts', { n: 2, kind: 'dette', why: '`drawWaterDisease` (:1637) tire la maladie sur la table d100 (MSRC 16 p.91) dans l\'applier au lieu de la porte -> #1508 (un tirage de conséquence est un dé comme un autre : doctrine du 2026-09-04, « tous les jets passé par le même point d\'entrée »). `traumaOnImpossibleAmbition` (:1224) roule un Test de Calme de HÉROS dans le mutateur, 45,09 % de Trauma permanent -> #1103.' }],
  ['src/state/combatFlow.ts', { n: 29, kind: 'mixte', why: '33 -> 31 -> 30 (#1508 T3b-4 : `applyTrample`, sans appelant de production, meurt avec son `resolveTrample` — le Piétinement du héros passe par `trampleConfirm`) -> 29 (#1508 T3b-4 : les Maladresses de l\'attaquant et du défenseur s\'écrivent par `ecrireLaMaladresse`, un seul `rollOups`) (#1426 : la voie INLINE de l\'Imparfaite meurt — `applyMiscast` DÉCLARE son étape à table sans condition, le `rollMiscast` restant est celui de l\'applier ; #1657 B3-1b : les amputations post-rencontre cessent d\'être roulées ici — le nœud ARMÉ part par `routeTriggeredTest`, dette #1095 SOLDÉE). Canonique pour les tirages de TABLE surfacés en étape/reveal (`critWoundLocation`, `rollOups`, `resolveCritique`, `rollMiscast`, `applyHullCritical`, `rollStructureCritical`) et pour les confrontations DÉJÀ affichées (`resolveRanged`, `resolveMelee` de `resolveAttack`, `rollDisengageAttack`, `rollGrappleForce` de `startGrapple`, `rollMeleeAttacker` de `maybeOpenDefense`, `rollRangedAttacker`, `resolveCounterspell`, `resolveRun`). Dettes : bouclier (`rollMeleeAttacker` de `applyShieldReaction`) -> #1093 ; attaque gratuite (`resolveMelee` d\'`applyFreeAttack`) et 2ᵉ main (`rollMeleeDefender` de `resolveDualSecond`) -> #1094, surface du dual-wield -> #998 ; `rollGrappleForce` ×2 de `resolveGrappleOpposed` et `opposedTest` de `runEnemyAI` (récupération d\'État jouée par l\'IA, résolue sans modale) -> #1096.' }],
  ['src/state/combatSetup.ts', { n: 1, kind: 'dette', why: '`initiativeOrder` — l\'Initiative de mise en place roule la ligne entière d\'un coup -> #1064.' }],
  ['src/state/combatSlice.ts', { n: 9, kind: 'mixte', why: 'canonique pour 7 sites : la Volée en table (`resolveVolley` d\'`applyBatteryVolley`), le Test d\'équipage d\'un navire piloté par l\'IA (`resolveCrewTestByRoles` de `shipAutoBattery`), et les jets affichés (`rollDisengageAttack` d\'`auContactRoll`, `rollGrappleForce` de `grappleRoll`, `rollOups` de `fumbleRoll`, `resolveMagicMissile` de `castRoll`, `resolveCasting` de `castRoll`). Dettes : `rollMeleeDefender` de `disengageRoll` (défense au désengagement) -> #1097 ; `animositeOrHaine` d\'`acquireAnimositeOnFate` (Animosité acquise sur un Destin dépensé) -> #1098.' }],
  ['src/state/interludeFlow.ts', { n: 3, kind: 'dette', why: 'les 3 `deMonde` (:1042-1044) tirent le Générateur de mission du contremaître (AA 12 l.63-144) dans l\'applier d\'un Test de Ragot déjà surfacé : trois dés hors porte, ni affichés ni posables -> #1508 T4.' }],
  ['src/state/landMarketFlow.ts', { n: 5, kind: 'mixte', why: 'canonique pour 4 sites : `rollFindMerchant`/`rollCargoQuantity`/`rollRandomLandCargo` peuplent la HALLE à l\'arrivée (`openLandMarket`, MSRC 13 l.22-42) et passent par le CANAL des dés de monde — la fenêtre de LOT (#1426, `etalLotFlow`) : chaque dé y est une rangée posable, nommée par ce qu\'elle décide. `rollTradeRumour` tire sa rumeur dans l\'applier d\'un `openPartyTest` DÉJÀ surfacé (MSRC 13 l.176-180). Dette : le Marchandage opposé n\'a plus qu\'UN site physique, `bargainOpposed` — source unique achat + vente, ordre RNG inchangé -> #1099.' }],
  ['src/state/massBattleFlow.ts', { n: 1, kind: 'dette', why: '`resolveClash` (massBattleFlow.ts:875) → `rollMightTest` (engine/massBattle.ts:124) → `rollTest` : LE site fondateur du trou engine-délégué -> #1067.' }],
  ['src/state/merchantFlow.ts', { n: 1, kind: 'dette', why: '`rollStock` (:218) est le Test de DISPONIBILITÉ de l\'étal (LDB 59 l.50), roulé hors porte : sa RÉVÉLATION passe par `openStockRevealCascade`, pas son TIRAGE — il ne se lance ni ne se fixe -> #1508 T5.' }],
  ['src/state/outOfCombatUpkeep.ts', { n: 1, kind: 'dette', why: '`bleedDeathRoll` hors combat (entretien quotidien) -> #1064.' }],
  ['src/state/portFlow.ts', { n: 3, kind: 'mixte', why: 'canonique : `rollRandomCargo` peuple l\'ÉTAL à l\'arrivée (`openPort`) et passe par le CANAL des dés de monde — la fenêtre de LOT (#1426, `etalLotFlow`) : ses tirages sont posables d\'un bloc avant l\'écran quand l\'option « Dés fixés » est active, et strictement identiques sinon. Dettes : les 2 `rollMerchantOpposition` sont des Marchandages opposés résolus en silence -> #580.' }],
  ['src/state/restFlow.ts', { n: 2, kind: 'dette', why: 'les 2 sites RESTANTS du chemin EAGER de la nuit (`sleepParty`) : `restRecovery` (:190, Test de Résistance Accessible +20, LDB 18 l.296) et `rollContraction` (:231, contagion de promiscuité, LDB 20 l.206) — leur VALEUR est celle de la porte depuis #1685 (`testValue`, États compris), leur FENÊTRE reste à ouvrir -> #1101. Le 3ᵉ site a disparu en #1657 B3-3 : les Tests d\'entretien de ce chemin (faim, soif, maladie, convalescence, dessoûlage) sont désormais MONTÉS par la porte et résolus d\'office (`runCascadeImmediate`, :182, branche I du seam — appliers + journal), au lieu d\'être roulés dans le moteur sans trace.' }],
  ['src/state/riverVoyageFlow.ts', { n: 3, kind: 'dette', why: 'les 2 `resolveRiverImpact` tirent les MAGNITUDES de dégâts d\'un péril sur d100 (MSRC 7 l.138-144) dans l\'applier -> #1508 T5 ; `deMonde` (:677) rejoue la chance du péril dans l\'applier de `riverPerilCheck` -> #1508 T4. Le redressement d\'un chavirage est passé en étapes Round par Round (#1104a) : plus aucun Test de HÉROS roulé en boucle ici.' }],
  ['src/state/seaVoyageFlow.ts', { n: 4, kind: 'dette', why: 'les 3 `deMonde` tirent la Panne de Vapeur dans l\'applier de l\'étape `progression` (MDG 12 l.313, :1736) et les conséquences d\'un événement de bord — Débris marins (:2465), Échouage (:2477, MDG 13 l.485-499) : trois dés de monde hors porte -> #1508 T4. `rollWeeklyFouling` (40,22 % sans trace) -> #1105. L\'événement de bord lui-même a QUITTÉ ce stock : il est une étape à TABLE de monde (`sea-board-events`, `mod` = Humeur de Manann) ; l\'Exposition du jour est passée en étapes influençables (#1104b).' }],
  ['src/state/shipBattery.ts', { n: 1, kind: 'dette', why: '`resolveCrewTestByRoles` — Test d\'équipage de la batterie -> #1067 (même famille navale qu\'`openCrewTestPending`).' }],
  ['src/state/shipCrew.ts', { n: 1, kind: 'dette', why: '`deMonde` (:479) roule la désertion à la relâche, UN DÉ PAR MARIN présent (MDG 14 l.192-202), dans l\'applier de l\'étape `sea-desertion` : N dés de monde qui ne s\'affichent ni ne se posent -> #1508 T4 (bande de dés de monde possédée par `WORLD_STEP_OWNER`).' }],
  ['src/state/tavernFlow.ts', { n: 2, kind: 'canonique', why: 'canonique : `rollTavernTest` est la primitive `roll*` à UN SEUL jet extraite en #370 — elle ne roule QUE le côté ADVERSAIRE ABSTRAIT (la salle), et seulement quand aucun héros ne tient ce camp : deux héros ouvrent une BANDE où chacun joue SON jet par le seam (#1279 S1). Deux sites : le gel à l\'ouverture de la manche (fabrique du socle de séquence) et son repli dans le réducteur de clôture si le gel manque.' }],
  ['src/state/travelFlow.ts', { n: 4, kind: 'dette', why: 'la Météo d\'Étape a QUITTÉ ce stock : elle est une étape à TABLE de monde (`stage-weather-<saison>`, posable), son applier insérant ce qui dépend du temps qu\'il fait. Quatre dettes : `forcedMarchTest` (marche forcée) -> #1102 ; `resolveMountedDay` (journée en selle EDOC 07 l.142-146 dont le Test de Chevaucher du CAVALIER l.165-174, rendu en lecture seule, 69,96 % d\'échecs) -> #1106 ; les 2 sites du câblage allure forcée (#673 L3) — `forcedPaceCheck` (:1044, Conduite du CONDUCTEUR, pénalité EDOC 08 l.229 en modificateur) et `forcedPaceBeastCheck` (:1220, Résistance des bêtes de trait au repli asynchrone) — Tests roulés par le moteur et rendus en lecture seule, même famille que la journée en selle -> #1106.' }],
  ['src/state/upkeep.ts', { n: 2, kind: 'canonique', why: 'canonique : 4 → 2 (#1657 B3-3) — `dailyDiseaseUpkeep` et `tickTraumaRecovery` ne peuvent PLUS rouler (leur porte est exigée au type), ils quittent donc la population déléguée ; restent `dailyFoodUpkeep`/`dailyWaterUpkeep`, qui gardent un chemin eager pour leurs appelants hors entretien. `onDeferTest` est désormais REQUIS de `runDailyUpkeep` : tout Test d\'entretien devient une étape, sur TOUS les chemins (repos interactif, avance d\'horloge, et le sommeil multi-jours qui les résout d\'office par `runCascadeImmediate`).' }],
]);

/**
 * TOUT DÉ TIRÉ HORS PORTE (#1508) — fichier → { sites MESURÉS par la garde sœur, kind, justification }.
 * Un site = un APPEL où le DÉ TOMBE dans un fichier consommateur : une primitive de `engine/dice`
 * importée, un `.int(` de RNG, ou un export de `src/engine` qui tire dans son corps
 * (`scanDesHorsPorte` + `engineDiceRollers`, `rollSeamExclusivity.mjs`).
 *
 * POURQUOI CETTE LISTE EXISTE : la garde d'exclusivité (#274) ne connaît que le FORGEAGE d'un Test
 * (`rollTest`/`d100`/`TestOutcome.seal`) — une magnitude, une dispersion, une désignation lui sont
 * invisibles par construction, et 60 des 75 lignes de dé de `src/state`+`src/ui` ne comptaient nulle
 * part au 2026-09-04. La doctrine utilisateur du 2026-09-04 (« tous les jets passé par le même point
 * d'entrée, il est inutile de se demander si le jeu est configuré pour ») ne laisse aucune classe de
 * dé hors de la porte : ce stock est donc une DETTE À CIBLE ZÉRO, au patron de
 * `ROLL_SEAM_PHASE2_STOCK`, et chaque entrée nomme la FAMILLE du design #1508 (A dés de monde,
 * B magnitudes d'`applyOps`, C magnitudes d'applier, D sauvegardes du héros, E dispersion,
 * F désignation) et le TRAIN qui l'emporte. Aucune entrée ne justifie une règle ; elles MESURENT.
 *
 * Le test (`roll-seam-exclusivity-guard.test.ts`) vérifie le compte À L'UNITÉ dans les DEUX sens : un
 * site de plus est une régression NOMMÉE, un site migré se solde ICI, une entrée retombée à 0 est
 * PÉRIMÉE, et un fichier mesuré ABSENT d'ici est rouge nominativement.
 *
 * PÉRIMÈTRE : hors `src/engine/**` (le moteur reçoit un rng, il ne surface pas — règle 3) et hors
 * `ROLL_SEAM_CORE` (ces fichiers SONT la porte).
 *
 * @type {Map<string, StockEntry>}
 */
export const DES_HORS_PORTE_STOCK = new Map([
  ['src/data/mutations.ts', { n: 1, kind: 'dette', why: 'mesuré : deMonde×1. A (`deMonde` de la table de mutation) -> #1508 T4.' }],
  ['src/data/obsessions.ts', { n: 1, kind: 'dette', why: 'mesuré : rollExpr×1. C (`rollExpr` d\'une magnitude authorée) -> #1508 T5.' }],
  ['src/data/pregens.ts', { n: 1, kind: 'dette', why: 'mesuré : rollInitialWealth×1. C (fortune de départ) -> #1508 T5.' }],
  ['src/state/activityWorldRolls.ts', { n: 1, kind: 'dette', why: 'mesuré : applyOps×1 — celui de l\'APPLIER des issues (`registerCascadeApplier(ACTIVITY_WORLD_ROLL_KIND)`), qui applique `wr.ops` une fois le seuil tombé. Le dé de MONDE lui-même passe par la porte (`worldStep`, évaluation `seuil`) et sa CIBLE se LIT sans rng (`formulaExpectation`) : AUCUN dé ne se tire ici aujourd\'hui — la seule issue authorée est `statusMod` (`activities.json › mendier.worldRolls`), sans magnitude. L\'entrée reste au stock parce que le détecteur compte `applyOps` comme SURFACE de dé, pas parce qu\'un dé y roule. B (magnitudes d\'`applyOps`) -> #1508 T2.' }],
  ['src/state/aiSpellValue.ts', { n: 1, kind: 'dette', why: 'mesuré : applyOps×1. B (`applyOps` en ÉVALUATION d\'IA) -> #1508 T2.' }],
  ['src/state/combat/roundHooks.ts', { n: 3, kind: 'dette', why: 'mesuré : bleedDeathRoll×1, rollTest×1, rollWindsOfMagic×1. B + Hémorragie mortelle roulée en fin de ronde -> #1508 T2/T3.' }],
  ['src/state/combat/turnHooks.ts', { n: 6, kind: 'dette', why: 'mesuré : resolveCalmeSimple×2, resolvePeurTest×2, resolveFrenzyEntry×1, resolveTerreurTest×1. psychologie de début de tour roulée en direct -> #1508 T3.' }],
  ['src/state/combatEffects.ts', { n: 23, kind: 'dette', why: 'mesuré : applyOps×7, resolveFormula×6, rng.int×2, applyFaimTest×1, applyManannFactor×1, applySoifTest×1, d10×1, d100×1, drawWaterDisease×1, roll×1, traumaOnImpossibleAmbition×1. Cardinal INCHANGÉ pour une raison dite (#1508 T2) : `applyFall×1` a QUITTÉ le compte (la chute ne tire plus son 1d10 — il lui arrive de la porte, `ouvrirChute`/`OpsCtx.des`), et l\'`applyOps` de l\'applier `opsDe` (celui qui applique la feuille APRÈS les dés) l\'a remplacé. B (magnitudes d\'`applyOps`/`resolveFormula`), C (magnitudes d\'applier) -> #1508 T2/T5.' }],
  ['src/state/combatFlow.ts', { n: 54, kind: 'dette', why: '60 -> 59 (#1508 T2 : `collapseStructure` ne fait plus tomber la passerelle en silence — le 1d10 de chaque occupant passe par `ouvrirChute`) -> 58 (#1508 T3 G0 : le Projectile magique cesse de ré-implémenter le Dôme et le Martyr — il route par le registre `hitModifiers`, seul site des sauvegardes de touche ; le d10 en double meurt et le démon touché par un Dard fait enfin sa sauvegarde, LDB 85 l.98) -> 56 (#1508 T3b-4 : la grappe de dés d\'une CASSE D\'ARME passe par la porte — le `d10` de la Sauvegarde Solide meurt (`wearActiveWeapon` reçoit le dé tombé, LDB 60 l.30) et `rollArtillerySalveMisfire` aussi (le moteur ne roule plus : `lireSalveMisfire` LIT le d10 d\'une étape à TABLE, AA 10 l.270-277)) -> 55 (#1508 T3b-4 : `applyTrample`, sans appelant de production, meurt avec son `resolveTrample`) -> 54 (#1508 T3b-4 : les Maladresses de l\'attaquant et du défenseur s\'écrivent par `ecrireLaMaladresse`, un seul `rollOups`). mesuré : resolveFormula×13, applyOps×9, rng.int×5, resolveCritique×3, rollGrappleForce×3, rollTest×3, resolveRanged×2, rollDisengageAttack×2, rollMeleeAttacker×2, rollOups×1, rollStructureCritical×2, applyHullCritical×1, opposedTest×1, resolveCounterspell×1, resolveRun×1, rollMeleeDefender×1, rollMiscast×1, rollRangedAttacker×1, rollWindsOfMagic×1, scatter×1. B (magnitudes d\'`applyOps`/`resolveFormula`), D (sauvegardes du héros), E (dispersion), + les Tests déjà comptés au registre -> #1508 T2/T3/T6.' }],
  ['src/state/combatManeuvers.ts', { n: 4, kind: 'dette', why: 'mesuré : rollTest×4. Tests de manœuvre roulés en direct -> #1508 T3.' }],
  ['src/state/combatSetup.ts', { n: 3, kind: 'dette', why: 'mesuré : rng.int×2, initiativeOrder×1. F (désignation `rng.int`), Initiative de mise en place -> #1508 T3/T6.' }],
  ['src/state/combatSlice.ts', { n: 8, kind: 'dette', why: 'mesuré : applyOps×2, resolveCasting×1, resolveVolley×1, rollDisengageAttack×1, rollGrappleForce×1, rollMeleeDefender×1, rollOups×1. B + confrontations déjà affichées -> #1508 T2.' }],
  ['src/state/corruptionFlow.ts', { n: 1, kind: 'dette', why: 'mesuré : rollTest×1. Test roulé en direct -> #1508 T3.' }],
  ['src/state/devtools.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×1, rng.int×1. B, F (outil de recette) -> #1508 T2/T6.' }],
  ['src/state/encounterPsychFlow.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×2. B -> #1508 T2.' }],
  ['src/state/etalLot.ts', { n: 2, kind: 'dette', why: 'mesuré : rng.int×2. F (désignation `rng.int`) -> #1508 T6.' }],
  ['src/state/innFlow.ts', { n: 1, kind: 'dette', why: 'mesuré : applyOps×1. B -> #1508 T2.' }],
  ['src/state/interludeFlow.ts', { n: 15, kind: 'dette', why: 'mesuré : applyOps×5, d100×3, deMonde×3, apprenticeshipTutorCost×1, entrainementTutorCost×1, roll×1, statusIncome×1. A (les 3 `deMonde` du contremaître), B, C -> #1508 T2/T4/T5.' }],
  ['src/state/landMarketFlow.ts', { n: 7, kind: 'dette', why: 'mesuré : rollMerchantSkill×2, opposedTest×1, rng.int×1, rollCargoQuantity×1, rollFindMerchant×1, rollTradeRumour×1. C (peuplement de la halle), F -> #1508 T5/T6.' }],
  ['src/state/massBattleFlow.ts', { n: 5, kind: 'dette', why: 'mesuré : applyOps×2, d10×1, d100×1, rng.int×1. B, C, F -> #1508 T2/T5/T6.' }],
  ['src/state/medicFlow.ts', { n: 3, kind: 'dette', why: 'mesuré : applyOps×1, d10×1, rng.int×1. B, C (magnitude de soin), F -> #1508 T2/T5/T6.' }],
  ['src/state/merchantFlow.ts', { n: 2, kind: 'dette', why: 'mesuré : fullStock×1, rollStock×1. C (Test de DISPONIBILITÉ, étal du marchand, LDB 59 l.50 — `rollStock` et son helper module-local `fullStock`) -> #1508 T5.' }],
  ['src/state/outOfCombatUpkeep.ts', { n: 1, kind: 'dette', why: 'mesuré : bleedDeathRoll×1. Hémorragie mortelle hors combat -> #1508 T3.' }],
  ['src/state/portFlow.ts', { n: 6, kind: 'dette', why: 'mesuré : rollMerchantOpposition×2, rollMerchantSkill×2, cargoBasePrice×1, rollCargoAvailability×1. C (peuplement de l\'étal), Marchandages opposés -> #1508 T5.' }],
  ['src/state/possessionsFlow.ts', { n: 1, kind: 'dette', why: 'mesuré : possessionGrantsFromRefs×1. C (octrois tirés) -> #1508 T5.' }],
  ['src/state/pursuitFlow.ts', { n: 1, kind: 'dette', why: 'mesuré : rollTest×1. Test de poursuite roulé en direct -> #1508 T3.' }],
  ['src/state/restFlow.ts', { n: 8, kind: 'dette', why: 'mesuré : applyExposureFailure×2, applyFaimTest×1, applyOps×1, applySoifTest×1, restRecovery×1, rng.int×1, rollContraction×1. B, C (Exposition, faim/soif) -> #1508 T2/T5.' }],
  ['src/state/riverVoyageFlow.ts', { n: 14, kind: 'dette', why: 'mesuré : rollTest×3, resolveRiverImpact×2, rollExpr×2, applyCrewHit×1, deMonde×1, rollBarrage×1, rollBarrageClearing×1, rollRiverWind×1, rollShipCritical×1, tickRiverWindDay×1. A (péril fluvial), C (dégâts d\'impact) -> #1508 T4/T5.' }],
  ['src/state/seaActivities.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×2. B -> #1508 T2.' }],
  ['src/state/seaVoyageFlow.ts', { n: 54, kind: 'dette', why: 'mesuré : roll×16, d10×7, rollShipCritical×5, applyOps×4, rollTest×4, deMonde×3, rng.int×2, rollDaysToNextEvent×2, rollSeaWeather×2, rollWindDirection×2, applyCrewHit×1, pickSeaHazard×1, resolveFastVoyage×1, rollCourseChange×1, rollPortEvent×1, rollWeeklyFouling×1, tickWindForceDay×1. A (dés de monde), C (magnitudes maritimes) -> #1508 T4/T5.' }],
  ['src/state/sequenceCore.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×2. B -> #1508 T2.' }],
  ['src/state/shipCollision.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×2. B -> #1508 T2.' }],
  ['src/state/shipCrew.ts', { n: 4, kind: 'dette', why: 'mesuré : applyOps×2, deMonde×1, recalcMorale×1. A (désertion `deMonde`, un dé par marin), B -> #1508 T2/T4.' }],
  ['src/state/shipDamage.ts', { n: 2, kind: 'dette', why: 'mesuré : applyOps×2. B -> #1508 T2.' }],
  ['src/state/shipManeuver.ts', { n: 2, kind: 'dette', why: 'mesuré : rollTest×2. Tests d\'équipage roulés en direct -> #1508 T3.' }],
  ['src/state/spawn.ts', { n: 4, kind: 'dette', why: 'mesuré : randomizeChars×2, rng.int×2. F (désignation `rng.int`), caractéristiques aléatoires au spawn -> #1508 T6.' }],
  ['src/state/summonFlow.ts', { n: 1, kind: 'dette', why: 'mesuré : resolveFormula×1. B (`resolveFormula`) -> #1508 T2.' }],
  ['src/state/tavernFlow.ts', { n: 9, kind: 'dette', why: 'mesuré : rng.int×4, applyOps×3, rollTavernTest×2. B, F (désignation `rng.int`) -> #1508 T2/T6.' }],
  ['src/state/travelFlow.ts', { n: 11, kind: 'dette', why: '12 -> 11 (#1508 T2 : la chute de selle EDOC 07 l.167 ouvre son 1d10 à la porte, `ouvrirChute`). mesuré : d10×2, d100×2, applyOps×1, declareDisease×1, forcedMarchTest×1, forcedPaceBeastCheck×1, forcedPaceCheck×1, resolveMountedDay×1, rollTest×1. C (magnitudes de route) -> #1508 T5.' }],
  ['src/state/travelPostes.ts', { n: 5, kind: 'dette', why: 'mesuré : applyOps×3, applyExposureFailure×1, d100×1. B, C (Exposition des postes) -> #1508 T2/T5.' }],
  ['src/state/triggeredEffects.ts', { n: 1, kind: 'dette', why: 'mesuré : rollTest×1. Test déclenché roulé en direct -> #1508 T3.' }],
  ['src/state/upkeep.ts', { n: 3, kind: 'dette', why: 'mesuré : applyOps×1, dailyFoodUpkeep×1, dailyWaterUpkeep×1. B + entretien quotidien -> #1508 T2.' }],
  ['src/state/zones.ts', { n: 4, kind: 'dette', why: 'mesuré : applyOps×2, resolveFormula×2. B (magnitudes d\'`applyOps`/`resolveFormula` de zone) -> #1508 T2.' }],
  ['src/ui/creator/CharacterCreator.tsx', { n: 2, kind: 'dette', why: 'mesuré : generateName×1, rng.int×1. cérémonie du créateur — pose sous « Dés fixés » à instruire -> #1508 T6.' }],
  ['src/ui/creator/draft.ts', { n: 15, kind: 'dette', why: 'mesuré : rollCareer×4, rollStar×2, resolveSpeciesTalentsDetail×2, rng.int×1, rollAge×1, rollEyes×1, rollHair×1, rollHeight×1, rollInitialWealth×1, rollSpecies×1. cérémonie du créateur (`CreatorDice`) — la pose sous « Dés fixés » reste à instruire -> #1508 T6.' }],
]);

/**
 * Les familles CANONIQUES d'ouverture de jet — l'énumération que le registre publie. Chaque entrée est
 * VÉRIFIÉE par le test : le symbole existe, à ce fichier, avec ce statut d'export. `exported: false`
 * n'est pas un défaut à corriger en douce, c'est un FAIT mesuré qui explique pourquoi la famille était
 * hors registre (un symbole module-local ne se cherche pas depuis l'extérieur).
 * @type {{ name: string, file: string, exported: boolean, role: string }[]}
 */
export const SEAM_CALLERS = [
  { name: 'openRoll', file: 'src/state/rollSeam.ts', exported: true, role: 'LA porte déclarative : le call-site DÉCRIT un `RollRequest`, la porte résout la policy de surfaçage M/V/I.' },
  { name: 'openPartyTest', file: 'src/state/rollSeam.ts', exported: true, role: 'Porte du jet de GROUPE (meilleur / assisté) — même policy, acteur choisi dans le groupe.' },
  { name: 'openWorldTest', file: 'src/state/rollSeam.ts', exported: true, role: 'Porte du jet de MONDE (aucun acteur porteur) — propriétaire = le siège MJ via `worldOwner`.' },
  { name: 'makeRollFlow', file: 'src/state/rollFlowFactory.ts', exported: true, role: 'La FABRIQUE de flux de jet : une spec (`resolve`/`reresolve`/`rollActor`…) devient un flux à modale.' },
  { name: 'FLOWS', file: 'src/state/rollFlowSpecs.ts', exported: true, role: 'Le CATALOGUE des specs de flux montées par `makeRollFlow` — position (S) du garde d\'exclusivité.' },
  { name: 'openSkillTest', file: 'src/state/combatEffects.ts', exported: true, role: 'Ouvre le `pendingTest` d\'un nœud `test` de Flow AUTHORÉ (donnée : sorts, effets déclenchés, consommables).' },
  { name: 'rollTableStep', file: 'src/state/cascade.ts', exported: true, role: 'Étape de cascade « à table » : le dé est lu en table (d100 → fourchette), surfacé comme une étape.' },
  { name: 'openCrewTestPending', file: 'src/state/combatSlice.ts', exported: false, role: '3ᵉ famille NAVALE (Test d\'équipage : manœuvre, batterie, type libre) — MODULE-LOCALE, 3 call-sites internes ; sa localité est exactement ce qui l\'a tenue hors registre jusqu\'ici (-> #1067).' },
];
