/**
 * CASCADE séquentielle influençable — cœur générique (régime choisi par l'utilisateur pour les jets
 * de NUIT et de VOYAGE : un jet à la suite de l'autre, chacun influençable par la Chance/Résilience/
 * Pacte, AVANT que sa conséquence ne soit validée). Cf. docs/superpowers/specs/2026-06-14-multi-roll-
 * modal-design.md, Étape 3.
 *
 * Le JET d'une étape est kind-agnostique (Test « +0 » sur `step.target`, géré par `FLOWS.cascade`).
 * La CONSÉQUENCE d'une étape dépend de son `kind` et vit dans le REGISTRE `cascadeAppliers` (code,
 * identique hôte/invité — jamais une closure dans le pending, qui est snapshoté/transmis en coop).
 * Une conséquence peut INSÉRER des étapes suivantes (dépendance : un abri réussi réduit le nombre de
 * jets d'Exposition des campeurs).
 *
 * Deux pilotes du MÊME plan d'étapes (zéro duplication de la logique de conséquence) :
 *  - INTERACTIF (`advanceCascade` au fil de la modale `CascadeModal`) — nuit d'une journée, halte ;
 *  - IMMÉDIAT (`runCascadeImmediate`) — repos de plusieurs jours, reprise auto, triche de recette :
 *    on lance chaque étape (RNG, sans influence) et on applique sa conséquence, sans modale.
 */
import type { Get, Set } from './flowTypes';
import type { GameState } from './store';
import type { Combatant, Difficulty } from '../engine/types';
import { roll, d100, type RNG, type DiceSpec } from '../engine/dice';
import { findTableEntry } from '../engine/tables';
import type { CascadeStep, CascadeStepMeta, PendingCascade, CascadeRoll, BatchParticipant, CascadeAggregate, CascadeSecondRead, CascadeDeDecl, CascadeDeTirage, CascadeDeResult, CascadeTableDecl, CascadeTableResult, OpposedRowFreeze, StepEvaluation, SeuilDeSauvegarde } from './pendings';
import { formatWardSave } from '../engine/traits/dispatch';
import { t } from '../i18n';
import type { StakeRef } from '../data';
import type { Consequence } from './rollSeam';
import type { BuiltCascadeStep } from './stepBrand';
import { resultLines, surfaceOf } from './rollSeam';
import { WORLD_STEP_OWNER } from './netOwnership';
import { hoteOrphelin, PENDING_BY_JET } from './stateFields';
import { toRecapLines } from './recapLine';
import { actorIn } from './combatants';
import { rollTest, evaluateTest, evaluateCombinedTest, bestForcedRoll, resolveOpposed, opposedBranchSuccess, type TestResult } from '../engine/tests';
import { battleRng } from './battleRng';
import { traceLineOf, traceDieLineOf } from '../engine/traceLine';
import { dataLabel } from '../data';
import { scheduleFlowTimer } from './combatTimers';
import { journaliser } from './combatLog';

/**
 * ENCHAÎNEMENT d'une étape depuis l'applier de la PRÉCÉDENTE — le séquenceur est la maison de ce
 * geste, et sa SOURCE UNIQUE (`portFlow`, `landMarketFlow`). Une conséquence qui veut OUVRIR l'étape
 * suivante ne peut pas le faire pendant que la cascade courante commite encore la sienne : d'où le
 * report d'un tour de boucle. Sur le chemin INLINE (surface I, aucune cascade ouverte) l'ouverture est
 * DIRECTE et le flux reste synchrone — c'est ce que voit un jet non surfacé, et donc ses tests.
 */
export function chainStep(get: Get, open: () => void): void {
  if (get().pendingCascade) scheduleFlowTimer(open, 0);
  else open();
}

/**
 * Conséquence d'une étape, appliquée à la VALIDATION. Mute le héros (via get/set), renvoie les
 * conséquences (rendues par `resultLine`, #295 Lot 0) et d'éventuelles étapes à INSÉRER juste après
 * l'étape courante (dépendance). Vit dans le registre — pas dans le pending (coop). `step.result` est
 * garanti non-null si `step.target != null`. `ctx` donne les étapes DÉJÀ jouées
 * (`ctx.steps[0..index-1]` committées) : une escalade cumulative (Exposition au froid : 1ᵉʳ échec →
 * −10 CT/Ag/Dex, 2ᵉ → reste, 3ᵉ → Blessures) lit le nombre d'échecs précédents de CE héros — c'est
 * cette dépendance qui rend la séquence séquentielle.
 *
 * `consequences` (`Consequence[]`, rendu par `resultLine`) est la SEULE voie de dénouement — aucun
 * canal de chaîne libre n'existe dans ce type, le compilateur interdit toute réapparition.
 *
 * `insert` est MURÉ (#1262 V2) : une étape insérée porte la marque `BuiltCascadeStep`, donc elle sort
 * d'un constructeur de la porte (`rollSeam`/`revealStep`) — un littéral d'étape monté à la main dans
 * une conséquence ne compile plus. C'est le second canal d'entrée d'étapes du moteur, après la file
 * (`openSequence`) : les deux sont désormais fermés par le type.
 *
 * `stopSequence` (#1426) — LE VERBE SYMÉTRIQUE D'`insert` : la conséquence a repris la main sur la
 * suite du monde (un péril d'auteur ouvre un combat, une transition de scène), et les étapes qui
 * RESTAIENT n'ont plus lieu d'être. Le séquenceur TRONQUE alors la séquence à l'étape courante, au
 * goulot UNIQUE (`commitStep`) que partagent les trois pilotes.
 *
 * C'est la troncature — et non l'ouverture du combat — qui garantit la PARITÉ DE FLUX RNG avec la
 * boucle `for … break` qu'elle remplace : sans elle, les périls suivants rejoueraient leurs dés
 * (au retour du combat pour le pilote interactif, immédiatement pour les deux autres), là où la
 * boucle d'origine sortait sans les tirer.
 */
export type CascadeApplier = (
  get: Get,
  set: Set,
  step: CascadeStep,
  hero: Combatant | undefined,
  ctx: { steps: CascadeStep[]; index: number },
) => { consequences?: Consequence[]; insert?: readonly BuiltCascadeStep[]; stopSequence?: true } | void;

/** Une entrée de registre : la conséquence appliquée (`apply`) seule. L'affichage de l'issue de
 *  modale a pour source UNIQUE `resultLine`/`Consequence[]` (#295 Lot 2 : `cons` vide ⇒ `''`, la
 *  rangée ✓/✗ ±DR porte alors seule le verdict), sans repli de secours. Ajouter un
 *  kind ne touche JAMAIS l'UI. */
export interface CascadeKind {
  apply: CascadeApplier;
}

/** Registre par `kind` — source unique extensible (+1 entrée par nature d'étape : `apply`).
 *  Peuplé par les modules de domaine (restFlow, travelFlow) à leur chargement et par les tests. */
export const cascadeAppliers: Record<string, CascadeKind> = {};

/** Enregistre (ou remplace) la conséquence d'un `kind` d'étape de cascade. */
export function registerCascadeApplier(kind: string, apply: CascadeApplier): void {
  cascadeAppliers[kind] = { apply };
}

/**
 * PLI « APRÈS LE DÉ » d'une étape à table — ce que le `kind` dérive du tirage AU MOMENT où il tombe,
 * et qui ne peut PAS être re-dérivé plus tard : la sévérité d'une Blessure critique consomme du RNG
 * même sous dé posé (`engine/critical.resolveCritique`, Sauvagerie/relances), donc la recalculer au rendu
 * donnerait une autre Blessure à chaque redessin. Le pli pose sur l'étape ce que la fenêtre montre
 * (charge de l'applier + `reveal`) : le dé, la ligne et la conséquence parlent d'UN SEUL tirage.
 *
 * Il est appliqué par le SITE UNIQUE de pose d'un `table.result` (`tableStepResolved`), donc par les
 * CINQ pilotes de tirage sans exception (modale, dé posé, curseur posé, « Tout lancer », immédiat) —
 * un pilote qui l'oublierait rendrait une étape à table résolue mais SANS sa dérivée.
 *
 * Un pli PEUT être impur (RNG) : le site unique le MÉMORISE donc par valeur de dé sur l'étape, et ne
 * le rappelle que pour une valeur jamais vue — cf. `tableStepResolved` pour le contrat exact.
 */
export type CascadeTableFold = (step: CascadeStep, get: Get) => CascadeStep;

/**
 * CONTINUATION D'ÉTAPE rejouée APRÈS que sa conséquence est DITE (#1508) — injectée (patron
 * `ownTestFailedEmitter` ci-dessous), parce que la reprise vit dans `state/combatEffects` et que le
 * socle ne connaît ni Flow ni Effets.
 *
 * Elle est appelée ICI, au goulot unique de validation, et pas dans l'applier : un applier qui rejoue
 * lui-même sa suite le fait AVANT que `commitStep` ne journalise sa propre conséquence — le journal
 * annonce alors la suite avant la cause, et toute grandeur lue par différence après coup (les
 * Blessures d'une chute) est faussée par ce que la suite a déjà changé.
 */
let suiteApresCommit: ((get: Get, set: Set, step: CascadeStep) => void) | null = null;
/** Enregistre la reprise de continuation d'étape (appelée par `state/combatEffects` à son chargement). */
export function setSuiteApresCommit(fn: NonNullable<typeof suiteApresCommit>): void { suiteApresCommit = fn; }

/** Registre des plis par `kind` — patron `cascadeAppliers` (inversion de dépendance). */
export const cascadeTableFolds: Record<string, CascadeTableFold> = {};

/** Enregistre (ou remplace) le pli post-dé d'un `kind` d'étape à table. */
export function registerCascadeTableFold(kind: string, fold: CascadeTableFold): void {
  cascadeTableFolds[kind] = fold;
}

/**
 * Registre des PRÉDICATS DE SUCCÈS d'une étape batch sommée — INVERSION de dépendance, patron
 * `cascadeAppliers` : le seuil de succès d'un domaine (naval : `crewTestSuccess`, MDG 14 l.13, seuil
 * réglable par règle optionnelle) est FOURNI par le flux propriétaire, la machinerie générique ne
 * connaît que l'id. L'étape porte l'id (`meta.aggregateSuccessRule`, chaîne SÉRIALISABLE) et non la
 * fonction : un pending est snapshoté en JSON (sauvegarde, coop) — une closure y serait effacée en
 * silence et l'étape retomberait sur un seuil qui n'est pas le sien.
 */
export const cascadeSuccessRules: Record<string, (sl: number) => boolean> = {};

/** Enregistre (ou remplace) le prédicat de succès d'un id de règle d'agrégat. */
export function registerCascadeSuccessRule(id: string, succeeds: (sl: number) => boolean): void {
  cascadeSuccessRules[id] = succeeds;
}

/** ÉMETTEUR `onOwnTestFailed` INJECTÉ (inversion de dépendance, patron `testRouter`) : `commitStep` déclenche
 *  le trigger pour l'acteur d'une étape à jet raté SANS importer `triggeredEffects` (qui rebouclerait
 *  cascade↔triggeredEffects→combatFlow→cascade). Câblé par `combatFlow` (effet de bord au chargement). */
type OwnTestFailedEmitter = (get: Get, actor: Combatant, sl: number) => string[];
let ownTestFailedEmitter: OwnTestFailedEmitter | undefined;
export function setOwnTestFailedEmitter(fn: OwnTestFailedEmitter): void { ownTestFailedEmitter = fn; }

/**
 * Conséquence d'une ISSUE de TEST ÉTENDU (`PendingExtendedTest.outcome`, #273 Étape 1) — calque exact
 * de `CascadeApplier` ci-dessus (mute get/set, renvoie des `Consequence[]`), appliquée à la CLÔTURE du
 * Test étendu (`extendedTestNext`, store.ts) qu'il ait atteint sa cible OU buté sur `maxAttempts`.
 * `reached` = `total ≥ targetDR` ; `false` = borne d'essais épuisée sans réussir (Commerce d'opportunité,
 * MDG 15 : « 10 DR en ≤ 3 tentatives » — l'échec de la borne EST une issue, jamais une boucle infinie).
 * Registre séparé de `cascadeAppliers` (un Test étendu n'est PAS une étape de cascade — `pendingExtendedTest`
 * coexiste comme porteur de données à côté d'une cascade-hôte à 1 étape `jet:'extended'`).
 */
export type ExtendedTestOutcomeApplier = (
  get: Get,
  set: Set,
  p: import('./pendings').PendingExtendedTest,
  total: number,
  reached: boolean,
) => { consequences?: Consequence[] } | void;

/** Registre par `kind` (`PendingExtendedTest.outcome.kind`) — source unique extensible, kind-agnostique. */
export const extendedTestOutcomeAppliers: Record<string, ExtendedTestOutcomeApplier> = {};

/** Enregistre (ou remplace) l'issue de domaine d'un `kind` de Test étendu. */
export function registerExtendedTestOutcome(kind: string, apply: ExtendedTestOutcomeApplier): void {
  extendedTestOutcomeAppliers[kind] = apply;
}

/**
 * REGISTRE des TABLES tirables par une étape (`CascadeStep.table.tableId`) — source unique
 * extensible, peuplée par les modules de DOMAINE à leur chargement (comme `cascadeAppliers`) : le
 * cœur générique ne nomme aucune table. `rows` porte les fourchettes `[min,max]` + l'id STABLE de
 * chaque ligne (le lookup est `findTableEntry`, brique partagée) ; `lines` rend les lignes
 * d'affichage de la ligne tirée, formatées par le MOTEUR du domaine (source unique du texte).
 *
 * Distinct du registre des tables d'EFFETS (`data/effectTables.ts`, `findEffectTableById`) : celui-là
 * résout des lignes `{min,max,ops}` — un `GameOp[]` appliqué à une cible, sans id de ligne stable ni
 * issue hors-ops (Effondrement, note verbatim). Les deux partagent la brique de lookup, pas la forme.
 */
export interface TableStepRow {
  min: number;
  max: number;
  /** id STABLE de la ligne (toute logique s'y attache — jamais le libellé). */
  id: string;
  /** Libellé de la ligne — AFFICHAGE seul (picker de lignes). Les `rows` sont passées PAR RÉFÉRENCE
   *  depuis la donnée du domaine (`STRUCTURE_CRITICALS` porte déjà son `label`) : zéro duplication. */
  label?: string;
}

/** CONTEXTE d'un tirage sur table — ce que le résolveur transmet au formateur de lignes quand son
 *  pilote en dispose. Un seul membre : l'accès à l'état, en LECTURE. */
export interface TableStepCtx {
  get: Get;
}

export interface TableStepDef {
  /** Libellé de la table (rangée `TableRollLine`). */
  label: string;
  /** Faces du dé (défaut 100) — une déclaration d'étape peut le surcharger. */
  die?: number;
  rows: TableStepRow[];
  /** Lignes d'affichage de la ligne atteinte par le dé EFFECTIF (formatage du moteur de domaine).
   *
   *  `ctx` — CONTEXTE DU TIRAGE, transmis par le résolveur quand son pilote en a un (`{ get }`).
   *  Il existe parce qu'une ligne de table ne dit pas toujours la même chose selon l'ÉTAT au moment
   *  du dé : une même fourchette peut porter deux issues (atteindre un nombre cible, ou le passer au
   *  joueur suivant — `NADJ 16 l.17`), et un libellé figé à l'ENREGISTREMENT annoncerait la
   *  fourchette au lieu de ce qui vient d'arriver. Le socle ne connaît toujours aucun domaine : il
   *  transmet l'accès, il ne lit rien. Absent (résolveur PUR, moteur hors store) : la table rend son
   *  libellé de fourchette — toute implémentation doit rester correcte sans `ctx`. */
  lines: (effectiveRoll: number, ctx?: TableStepCtx) => string[];
  /** Catégorie Codex où vivent les LIGNES de cette table (`criticalsTete`, `mutations`,
   *  `interludeEvents`…). Déclarée ICI parce que la table est le seul endroit qui la connaisse : un
   *  même `kind` d'étape tire sur N tables (une Blessure critique se joue sur celle de SA
   *  Localisation). C'est elle qui fait DESCENDRE l'enjeu à la ligne jouée après le tirage
   *  (`stakeAtTableRow`) ; absente, l'enjeu reste au foyer du `kind`. */
  entryCategory?: string;
}

/** REGISTRE STATIQUE : les tables dont l'id est ÉCRIT AU CODE (Critiques de Structure, Événements
 *  d'interlude, `sea-board-events`…) — une def posée une fois, au chargement de son module. */
const tableStepStatiques: Record<string, TableStepDef> = {};

/**
 * FAMILLE de tables DÉRIVÉES d'un dataset (#1692) — ses ids ET ses defs se redemandent à CHAQUE
 * lecture du registre, la famille portant son mémo (`memoParVersion`, `src/data/versionDataset.ts`).
 * Une saison retirée au Codex quitte le registre, une saison ajoutée y entre sans rechargement, et
 * AUCUN lecteur ne dépend d'un enregistrement déclenché ailleurs : la reprise d'une cascade
 * sauvegardée lit la même chose que la fenêtre qui a ouvert l'étape.
 *
 * La famille EST son mémo : un accesseur qui rend la table des defs à cet instant. Une famille de
 * plus coûte donc UNE ligne (`registerTableStepFamily(tablesDeX)`), pas une paire `ids`/`def`
 * recopiée.
 */
export type TableStepFamily = () => ReadonlyMap<string, TableStepDef>;

const tableStepFamilles: TableStepFamily[] = [];

/** Enregistre (ou remplace) une table tirable par une étape — id FIXE, def écrite au code. */
export function registerTableStep(tableId: string, def: TableStepDef): void {
  tableStepStatiques[tableId] = def;
}

/** Enregistre une FAMILLE de tables dérivées de la donnée (cf. `TableStepFamily`). */
export function registerTableStepFamily(famille: TableStepFamily): void {
  tableStepFamilles.push(famille);
}

/** LECTURE UNIQUE du registre — les statiques d'abord, les familles ensuite. */
export function tableStepDef(tableId: string): TableStepDef | undefined {
  const statique = tableStepStatiques[tableId];
  if (statique) return statique;
  for (const famille of tableStepFamilles) {
    const def = famille().get(tableId);
    if (def) return def;
  }
  return undefined;
}

/** TOUS les ids tirables à cet instant — statiques + familles, sans doublon. */
export function tableStepIds(): string[] {
  return [...new Set([...Object.keys(tableStepStatiques), ...tableStepFamilles.flatMap((f) => [...f().keys()])])];
}

/**
 * DÉCLARATION RÉSOLUE à l'instant du tirage — SITE UNIQUE qui compose une `CascadeTableDecl` : le
 * modificateur VIVANT (`modPerActor` : `factor` × le compteur de l'ACTEUR de l'étape) est versé dans
 * `mod`, qui reste additif. Tout pilote de tirage passe par ici, et la surface qui OFFRE la pose
 * (mode table) aussi : sinon la ligne montrée et la ligne appliquée divergeraient dès que le
 * compteur bouge entre l'ouverture de l'étape et le dé (rafale de Colères : la 1ʳᵉ expie un Péché,
 * la 2ᵉ doit tirer au NOUVEAU total — LDB 40 l.46). Sans `modPerActor`, la déclaration est rendue
 * TELLE QUELLE (aucun coût pour les tables à modificateur figé).
 */
export function liveTableDecl(s: GameState, step: CascadeStep): CascadeTableDecl {
  return declVivante(s, step.table as CascadeTableDecl, step.actorId);
}

/** LA MÊME composition pour un dé NU (`step.de`) — même site, même règle : le porteur du dé change,
 *  pas le geste (#1508). */
export function liveDeDecl(s: GameState, step: CascadeStep): CascadeDeDecl {
  return declVivante(s, step.de as CascadeDeDecl, step.actorId);
}

/** LE CORPS COMMUN des deux compositions ci-dessus — générique sur la déclaration, pour qu'un champ
 *  ajouté à `CascadeDeDecl` traverse les deux lectures sans être recopié. */
function declVivante<T extends CascadeDeTirage>(s: GameState, decl: T, actorId: string | undefined): T {
  if (!decl?.modPerActor) return decl;
  const actor = actorId ? actorIn(s, actorId) : undefined;
  const live = (actor?.[decl.modPerActor.counter] ?? 0) * decl.modPerActor.factor;
  return { ...decl, mod: (decl.mod ?? 0) + live };
}

/** LES DÉS d'un tirage sur TABLE : la déclaration l'emporte, la table donne son défaut, d100 sinon —
 *  seul endroit où le repli de la table s'exprime, lu par le résolveur comme par les bornes de saisie. */
export function tableSpec(decl: CascadeTableDecl): DiceSpec {
  return decl.spec ?? { n: 1, sides: tableStepDef(decl.tableId)?.die ?? 100 };
}

/** PLAGE des dés NATURELS que ce `DiceSpec` peut sortir : `n` dés de `sides` faces, totalisés — de `n`
 *  à `n × sides`. C'est elle qui borne toute SAISIE de dé posé : les faces seules mentiraient dès
 *  qu'un tirage en compte plusieurs (un 2d10 sort 17, aucun d10 ne le fait). PURE. */
export function plageNaturelle(spec: DiceSpec): { min: number; max: number } {
  return { min: spec.n, max: spec.n * spec.sides };
}

/**
 * LE ROULAGE d'un dé d'étape (#1508) — GESTE UNIQUE de tout tirage de la porte, quelle que soit sa
 * LECTURE (nue ou en table) : `forcedRoll` FIGE le naturel (dé posé par un siège, injection d'un
 * résolveur moteur), sinon `n` dés de `sides` faces sont totalisés ; `keepHighest` (N > 1) rejoue le
 * tirage NATUREL et retient le plus élevé — un dé POSÉ n'est jamais re-tiré.
 *
 * Le TOTAL est `naturel + spec.plus + mod` : c'est lui que la conséquence consomme (dé nu) ou que le
 * lookup lit (table, où il est le dé EFFECTIF). `modPerActor` a déjà été versé dans `mod` par le site
 * unique de composition (`declVivante`). PUR (RNG injecté), aucun concept de domaine.
 */
export function roulerDe(decl: CascadeDeTirage, spec: DiceSpec, rng: RNG): CascadeDeResult {
  // FAIL-FAST, jamais un plancher SILENCIEUX : une déclaration à `n`/`sides` non positifs ne tire
  // rien, et la caler à 1 rendrait un dé que personne n'a déclaré. La porte, elle, REFUSE la
  // déclaration en amont (`rollSeam.dieStep`) ; ici c'est le dernier verrou, pour les deux porteurs.
  if (!(spec.n > 0) || !(spec.sides > 0)) {
    throw new Error(`roulerDe : dés non tirables (${spec.n}d${spec.sides}) — aucun dé à jeter.`);
  }
  let natural = decl.forcedRoll ?? roll(spec.n, spec.sides, rng);
  if (decl.forcedRoll == null) for (let i = 1; i < (decl.keepHighest ?? 1); i++) natural = Math.max(natural, roll(spec.n, spec.sides, rng));
  return { roll: natural, total: natural + (spec.plus ?? 0) + (decl.mod ?? 0) };
}

/** Ramène une SAISIE libre aux naturels que CE tirage peut sortir — borne PARTAGÉE de la pose d'un dé
 *  (une table resserre encore, cf. `clampTableNatural`). PURE. */
export function clampNaturel(spec: DiceSpec, roll: number): number {
  const plage = plageNaturelle(spec);
  return Math.min(Math.max(Math.floor(roll), plage.min), plage.max);
}

/**
 * RÉSOLVEUR UNIQUE d'un tirage sur table (#942 L2) — la COMPOSITION des deux gestes que #1508 a
 * séparés : `roulerDe` (le dé, commun à toutes les lectures) puis `lireEnTable` (la lecture). Rien de
 * propre à la table ne subsiste dans le tirage lui-même. PUR (RNG injecté), aucun concept de domaine.
 */
export function rollTableStep(decl: CascadeTableDecl, rng: RNG, ctx?: TableStepCtx): CascadeTableResult {
  const de = roulerDe(decl, tableSpec(decl), rng);
  return lireEnTable(decl, de, ctx);
}

/**
 * LA LECTURE EN TABLE d'un dé déjà tombé (#1508) — le TOTAL sert de dé EFFECTIF au lookup (convention
 * de l'op `rollTable`, `engine/ops.ts`), `findTableEntry` (brique partagée) trouve la ligne, et
 * l'issue porte son id stable + ses lignes. PURE.
 *
 * Deux fail-fast, aucun repli silencieux :
 *  - table introuvable au registre — jamais enregistrée, ou RETIRÉE de la donnée (un `tableId`
 *    fautif ne se résout jamais en silence) ;
 *  - dé EFFECTIF HORS de la plage couverte par la table : `findTableEntry` replie sur la DERNIÈRE
 *    ligne, donc un `mod` fautif (au-dessus comme en dessous de la plage) rendrait la MÊME ligne
 *    extrême — ici la borne est vérifiée et l'appelant est nommé (tableId/dé/mod). Seul le PLANCHER
 *    se déclare (`clamp`, table dont le RAW borne par le bas) ; le plafond reste un fail-fast.
 */
export function lireEnTable(decl: CascadeTableDecl, de: CascadeDeResult, ctx?: TableStepCtx): CascadeTableResult {
  const def = tableStepDef(decl.tableId);
  // Une table RETIRÉE de la donnée (saison, seuil d'espèce, Tableau de Corruption) rend IRRÉSOLUBLE
  // toute cascade persistée sur son id : le refus est NOMMÉ, jamais un repli sur une autre table.
  // Aucune migration de sauvegarde (`.claude/memory/user-arbitrage-saves-reset-pas-migration.md`).
  if (!def) {
    throw new Error(
      `rollTableStep : table d'étape « ${decl.tableId} » introuvable — jamais enregistrée (registerTableStep) ou table retirée de la donnée.`,
    );
  }
  const lo = def.rows[0].min;
  const hi = def.rows[def.rows.length - 1].max;
  const die = decl.clamp ? Math.max(de.total, lo) : de.total;
  if (die < lo || die > hi) {
    throw new Error(
      `rollTableStep : dé effectif ${die} hors de la plage [${lo}, ${hi}] de la table « ${decl.tableId} » (dé naturel ${de.roll}, mod ${decl.mod ?? 0}).`,
    );
  }
  const row = findTableEntry(def.rows, die);
  return { roll: de.roll, die, id: row.id, lines: def.lines(die, ctx) };
}

/**
 * LA LECTURE EN SEUIL d'un dé déjà tombé (#1508) — JUMELLE de `lireEnTable` : même tirage (`roulerDe`),
 * troisième lecture. Ici le total est confronté à un INDICE déclaré SUR l'étape (`CascadeDeDecl.seuil`) :
 * `total ≥ indice` → sauvé (`LDB 85 l.98`, `LDB 85 l.278`, `LDB 47 l.410`). Le TOTAL est le dé EFFECTIF,
 * comme il l'est pour le lookup d'une table — la même convention pour les trois lectures.
 *
 * La LIGNE de journal est rendue ICI, à l'unique graphie du seuil (`formatWardSave`) : un dé JETÉ s'ÉCRIT,
 * qu'il sauve ou non — sans la ligne du raté, le porteur voit ses Blessures tomber sous sa propre
 * protection sans que rien ne le lui explique. PURE (aucun état lu).
 */
export function lireEnSeuil(seuil: SeuilDeSauvegarde, de: CascadeDeResult, nom: string): { sauve: boolean; ligne: string } {
  const sauve = de.total >= seuil.indice;
  return {
    sauve,
    ligne: t(sauve ? 'cf.wardSaved' : 'cf.wardFailed', {
      name: nom,
      roll: de.total,
      trait: formatWardSave(seuil.traitId, seuil.indice),
      src: seuil.dome ? t('cf.wardFromDome') : '',
    }),
  };
}

/**
 * RE-POSE POST-TIRAGE de l'enjeu d'une étape à TABLE (#1117 L2) — l'étape énonce son enjeu à la
 * CONSTRUCTION, mais la LIGNE jouée n'existe qu'APRÈS le dé : tant que le tirage n'est pas tombé,
 * l'enjeu ne peut parler que du `kind` (« une Blessure critique »), jamais de ce qui vient d'arriver
 * (« Blessure majeure à l'œil »). Cette fonction fait descendre la clé à l'entrée tirée, en versant
 * la catégorie Codex DÉCLARÉE PAR LA TABLE (`TableStepDef.entryCategory`) — le pilote de tirage n'a
 * donc rien à nommer, et un `kind` qui tire sur N tables descend chaque fois dans la bonne.
 *
 * SANS enjeu posé, table sans catégorie, ou enjeu AUTHORÉ par un document (aucune clé de dataset où
 * descendre) : la référence est rendue TELLE QUELLE (repli déclaré sur le foyer du `kind`, jamais un
 * renvoi fabriqué). PURE.
 */
export function stakeAtTableRow(stake: StakeRef | undefined, decl: CascadeTableDecl, result: CascadeTableResult): StakeRef | undefined {
  const category = tableStepDef(decl.tableId)?.entryCategory;
  if (!stake || !category || stake.key == null) return stake;
  return { ...stake, key: { ...stake.key, entryId: result.id, entryCategory: category } };
}

/**
 * Étape à table RÉSOLUE : la déclaration qui a tiré + son résultat + l'enjeu redescendu à la ligne
 * jouée + le PLI post-dé du `kind` (`cascadeTableFolds`). SITE UNIQUE de la pose d'un `table.result`
 * sur une étape — les CINQ pilotes de tirage (modale, dé posé, curseur posé, résolution forcée,
 * cascade immédiate) passent par ici, sinon l'un d'eux laisserait l'enjeu au `kind` pendant que les
 * autres l'ont fait descendre, et rendrait une étape tirée sans sa dérivée.
 *
 * CE QUI EST GARANTI — pour UNE étape donnée, un dé posé rend TOUJOURS la même conséquence : la
 * dérivée est MÉMORISÉE sur l'étape (`step.foldMemo`, keyée par la valeur du dé) et re-servie
 * telle quelle, le pli n'étant rappelé que pour une valeur jamais vue sur cette étape. Un pli IMPUR
 * (la sévérité d'un Critique consomme du RNG même sous dé posé) rendrait sinon une Blessure
 * différente à chaque re-pose de la même valeur, et la fenêtre mentirait sur son propre dé.
 *
 * CE QUI N'EST PAS GARANTI — l'ORDRE des dés SUIVANTS après une exploration de poses : la valeur
 * re-servie ne consomme PAS de RNG, celle qui est découverte en consomme. Explorer 76 → 20 → 76
 * rend bien deux fois le même Critique sur 76, mais le flux d'aléa a avancé d'un tirage de plus que
 * si le joueur avait posé 76 d'emblée. Le mémo est un contrat de CONSÉQUENCE, pas de séquence.
 */
export function tableStepResolved(step: CascadeStep, decl: CascadeTableDecl, result: CascadeTableResult, get: Get): CascadeStep {
  const fold = cascadeTableFolds[step.kind];
  const posee = tableStepPosee(step, decl, result);
  if (!fold) return posee;
  const memo = step.foldMemo;
  const cle = String(result.roll);
  const deja = memo?.[cle];
  if (deja) return { ...deja, foldMemo: memo };
  const { foldMemo: _sansMemo, ...plie } = fold(posee, get);
  return { ...plie, foldMemo: { ...(memo ?? {}), [cle]: plie } };
}

/** LA PART PURE de la pose ci-dessus — la déclaration qui a tiré, son résultat, l'enjeu redescendu, et
 *  RIEN d'autre. Réservée à l'étape poussée DÉJÀ TIRÉE (`rollSeam.tableStepDone`), dont le tirage a eu
 *  lieu chez son PRODUCTEUR : ce qui se dérive du dé y est déjà calculé, et il n'y a aucune fenêtre où
 *  poser un pli. `tableStepDone` REFUSE d'ailleurs un `kind` qui en déclare un — un pli sauté rendrait
 *  une étape tirée sans sa dérivée. */
export function tableStepPosee(step: CascadeStep, decl: CascadeTableDecl, result: CascadeTableResult): CascadeStep {
  const stake = stakeAtTableRow(step.stake, decl, result);
  return { ...step, table: { ...decl, result }, ...(stake ? { stake } : {}) };
}

/** Type d'INTERACTION d'une étape, inféré de ses champs (zéro migration des étapes-jet existantes) :
 *  un Test (`target`), un TIRAGE SUR TABLE non résolu (`table` sans `result`, #942 L2), un DÉ NU non
 *  résolu (`de` sans `result`, #1508 — même dé, même pose, lecture nue), un batch multi
 *  (`participants` — seam de jet #275 Décision 4 cran 1, UNE rangée par contributeur), une SAISIE
 *  NUMÉRIQUE bornée (`quantity`, #1279 Sf), un choix du joueur (`options`), ou un pur affichage
 *  (aucun des six). */
export function stepInteraction(step: CascadeStep): 'jet' | 'table' | 'de' | 'batch' | 'quantite' | 'choix' | 'affichage' {
  if (step.target != null) return 'jet';
  if (step.table != null && step.table.result == null) return 'table';
  if (step.de != null && step.de.result == null) return 'de';
  if (step.participants != null) return 'batch';
  if (step.quantity != null) return 'quantite';
  if (step.options != null) return 'choix';
  return 'affichage';
}

/** L'étape est-elle prête à être validée ? jet → lancée (`result`) ; table → tirée (`table.result`) ;
 *  batch → TOUS les participants INTERACTIFS ont un `result` ; quantité → un nombre est posé
 *  (`amount` — le mint en pose un d'ouverture, cf. `rollSeam.quantityStep`) ; choix → tranchée
 *  (`chosen`) ; affichage → toujours.
 *
 *  CONTRAT d'une rangée TÉMOIN (`interactive:false`) : elle NAÎT avec son `result` — c'est son
 *  PRODUCTEUR qui le roule à la construction (`pursuitFlow.pursuitRow`, `ui/opposedFrozen`). Rien ne
 *  roule les rangées d'une étape ouverte : `rollBatchParticipants` n'est appelé QUE par les pilotes
 *  « tout résoudre »/immédiat (`resolveRemainingCascade`/`runCascadeImmediate`). Une témoin sans
 *  `result` n'en obtiendrait donc jamais — et comme elle ne freine pas ce prédicat, son jet serait
 *  simplement PERDU à la validation. */
export function stepReady(step: CascadeStep): boolean {
  switch (stepInteraction(step)) {
    case 'jet': return !!step.result;
    case 'table': return !!step.table!.result;
    case 'de': return !!step.de!.result;
    case 'batch': return step.participants!.every((p) => p.interactive === false || !!p.result);
    case 'quantite': return step.amount != null;
    case 'choix': return step.chosen != null;
    case 'affichage': return true;
  }
}

/**
 * BORNE d'une saisie de quantité — SITE UNIQUE : la valeur est ramenée dans `[min, max]` et calée sur
 * le pas déclaré depuis `min` (une étape qui compte de 5 en 5 ne rend pas 7). Le poseur d'état
 * (`setCascadeAmount`) et le mint (`rollSeam.quantityStep`) l'appellent tous deux : la valeur
 * d'OUVERTURE et la valeur SAISIE obéissent à la même règle, sinon l'ouverture pourrait porter un
 * nombre que le compteur ne sait plus atteindre. PURE.
 */
export function clampStepAmount(q: NonNullable<CascadeStep['quantity']>, n: number): number {
  // TOTALE : un champ numérique vidé rend `NaN` (`Number('')`), qui traverserait toute comparaison
  // (`NaN < min` est faux, `Math.min` le propage) et poserait un `amount` illisible. Seul `NaN` est
  // hors domaine — un infini, lui, tombe naturellement sur la borne qu'il vise.
  if (Number.isNaN(n)) return q.min;
  const pas = Math.max(1, Math.floor(q.step ?? 1));
  const cale = q.min + Math.round((Math.round(n) - q.min) / pas) * pas;
  return Math.min(q.max, Math.max(q.min, cale));
}

/**
 * ISSUE de la SECONDE LECTURE d'un jet (Test combiné, `LDB 12 l.202-208`) — le socle EXPOSE, l'UI
 * affiche : `evaluateCombinedTest` est le SEUL juge (le MÊME dé confronté à la seconde valeur), et
 * aucune surface ne recompare un `roll ≤ target` de son côté. Sans déclaration ni jet : `undefined`
 * (la ligne n'a alors qu'une lecture, comme avant). PURE.
 */
export function secondReadOf(second: CascadeSecondRead | undefined, result: CascadeRoll | null | undefined):
{ label: string; target: number; base?: number; difficulty?: Difficulty; roll: number; sl: number; success: boolean } | undefined {
  if (!second || !result) return undefined;
  const b = evaluateCombinedTest(result.roll, result.target, second.target).b;
  return {
    label: second.label,
    target: second.target,
    ...(second.base != null ? { base: second.base } : {}),
    ...(second.difficulty ? { difficulty: second.difficulty } : {}),
    roll: result.roll,
    sl: b.sl,
    success: b.success,
  };
}

/**
 * ISSUE d'un jet de cascade OPPOSÉ à un jet d'adversaire FIGÉ — SOURCE UNIQUE (étape MONO du flux
 * `cascade`, rangée d'une étape BATCH) : `resolveOpposed` est le SEUL juge (LDB 12 l.160) et
 * `opposedBranchSuccess` la SEULE lecture de branche (statu quo à l'égalité parfaite). `bonusSL`
 * s'ajoute au DR du défenseur AVANT l'opposition (Piège-lame, LDB 62 l.280) sans entrer dans le `sl`
 * reporté ; `statuQuo` marque l'égalité parfaite — rien ne s'est passé, ce n'est pas un Test raté.
 *
 * `defBase` = le Niveau de Compétence NU du défenseur, quand l'émetteur l'a posé : il n'entre QUE
 * dans l'opposition. Absent ⇒ les deux camps retombent sur leurs cibles (tout-ou-rien d'`openValues`) :
 * le dé est jeté sur une cible DÉJÀ modifiée, l'opposer à un `base` d'attaquant comparerait deux
 * grandeurs distinctes. PURE.
 */
export function opposedCascadeRoll(def: TestResult, opp: OpposedRowFreeze, target: number, defBase?: number): CascadeRoll {
  const o = resolveOpposed(opp.aT, { ...def, sl: def.sl + (opp.bonusSL ?? 0), base: defBase });
  return {
    roll: def.roll, target, sl: def.sl,
    success: opposedBranchSuccess(o, opp.defenderMustWin),
    ...(o.winner === 'tie' ? { statuQuo: true as const } : {}),
  };
}

/**
 * LA LECTURE D'UN DÉ D'ÉTAPE (#1426) — expression UNIQUE des deux évaluations (`CascadeStep.evaluation`),
 * lue par les TROIS pilotes (interactif `FLOWS.cascade`, « tout résoudre », immédiat) et par les
 * rangées batch. Deux lectures, jamais une troisième :
 *  - `'test'` (défaut) : la lecture WFRP complète, déléguée à `evaluateTest` (bandes LDB 12 l.28 + DR) ;
 *  - `'seuil'` : `dé ≤ nombre visé`, DR nul, aucune bande — le pourcentage tel que le RAW l'écrit.
 * La CIBLE n'est jamais écrêtée en mode seuil : un nombre visé de 100 vaut 100 %.
 */
export function lireDeEtape(roll: number, target: number, evaluation?: StepEvaluation): CascadeRoll {
  if (evaluation === 'seuil') return { roll, target, sl: 0, success: roll <= target };
  const ev = evaluateTest(roll, target);
  return { roll, target, sl: ev.sl, success: ev.success };
}

/**
 * LE ROULAGE d'un dé d'étape — UN d100 dans les deux modes (parité de flux RNG garantie), puis
 * `lireDeEtape`. En mode `'test'` la cible passe par `rollTest` (qui l'écrête aux bornes de
 * `TestPolicy`) ; en mode `'seuil'` le dé est NU et la cible intacte.
 */
export function roulerDeEtape(target: number, rng: RNG, evaluation?: StepEvaluation): CascadeRoll {
  if (evaluation === 'seuil') return lireDeEtape(d100(rng), target, evaluation);
  const t = rollTest(target, 'intermediaire', rng);
  return { roll: t.roll, target, sl: t.sl, success: t.success };
}

/** Jet d'UN participant batch — GÉNÉRIQUE : d100 contre sa cible EFFECTIVE (`target`, difficulté déjà
 *  appliquée à la construction), + `bonusSlOnSuccess` sur une réussite (Talent baké par le flux
 *  propriétaire). PUR (RNG injecté), aucun concept de domaine.
 *
 *  `opposed` — jet d'adversaire FIGÉ de l'étape (`meta.opposed`) : la rangée est alors un Test OPPOSÉ
 *  et son issue vient d'`opposedCascadeRoll`, pas de `roll ≤ cible`. UNE opposition figée vaut pour
 *  TOUTES les rangées de l'étape (LDB 13 l.77) — c'est le producteur qui l'a jetée, une seule fois. */
export function rollBatchParticipant(p: BatchParticipant, rng: RNG, opposed?: OpposedRowFreeze, evaluation?: StepEvaluation): CascadeRoll {
  if (evaluation === 'seuil') return lireDeEtape(d100(rng), p.target, evaluation);
  const t = rollTest(p.target, 'intermediaire', rng);
  if (opposed) return opposedCascadeRoll(t, opposed, p.target, p.base);
  return { roll: t.roll, target: t.target, sl: t.sl + (t.success ? (p.bonusSlOnSuccess ?? 0) : 0), success: t.success };
}

/** Résilience « Je ne faillirai pas ! » (LDB 17 l.68) pour UN participant batch : DR MAXIMAL policy-aware
 *  sur sa cible (réussite forcée). PUR, générique. */
export function forceBatchParticipant(p: BatchParticipant, evaluation?: StepEvaluation): CascadeRoll {
  // Mode SEUIL : il n'y a pas de « meilleur DR » à choisir (aucun DR n'existe) — la Résilience achète
  // la seule chose que le pourcentage offre, la réussite, sur le dé le plus bas.
  if (evaluation === 'seuil') return { roll: 1, target: p.target, sl: 0, success: true };
  const die = bestForcedRoll(p.target);
  const ev = evaluateTest(die, p.target);
  return { roll: die, target: p.target, sl: ev.sl + (p.bonusSlOnSuccess ?? 0), success: true };
}

/** Agrège les jets d'une étape À PARTICIPANTS PRÊTE en un `CascadeRoll` scalaire — GÉNÉRIQUE (aucun
 *  concept de domaine) : `best` = le meilleur DR l'emporte ; `summed-dr` (défaut) = Σ des DR (les
 *  participants `essential` comptent DOUBLE, MDG 14 l.19) + `flatDR` (modificateur plat versé par le
 *  flux), plafonné à `capTo` s'il est fourni (plafond CHIFFRÉ par le flux — Manque de bras l.55) ;
 *  `opposed` = ce total net d'`opposeSl`. Le SEUIL de succès du total sommé est `successOf`, injecté par
 *  le flux propriétaire (naval : `crewTestSuccess`) ; absent = ≥ 1. PUR, aucun concept de domaine.
 *  SOURCE UNIQUE pour `CascadeStep.participants` (`BatchParticipant[]`, flag `essential`) — le même
 *  « essentiel ×2 » (l.19) est ré-implémenté sur une forme DISTINCTE par `maneuverCrewTotal`
 *  (`state/shipManeuver.ts`, pending MULTI de COMBAT `ShipManeuverParticipant[]`, `roleId` matché) : NON
 *  convergentes VOLONTAIREMENT, deux pendings de forme différente (#351). */
export function aggregateBatchRolls(
  parts: BatchParticipant[],
  aggregate: CascadeAggregate = 'summed-dr',
  opts: { flatDR?: number; capTo?: number; opposeSl?: number; successOf?: (sl: number) => boolean } = {},
): { sl: number; success: boolean } {
  if (aggregate === 'best') {
    const sl = parts.reduce((m, p) => (p.result && p.result.sl > m ? p.result.sl : m), -Infinity);
    const best = Number.isFinite(sl) ? sl : 0;
    return { sl: best, success: best > 0 };
  }
  let total = opts.flatDR ?? 0;
  for (const p of parts) if (p.result) total += p.essential ? p.result.sl * 2 : p.result.sl;
  if (opts.capTo != null && total > opts.capTo) total = opts.capTo;
  if (aggregate === 'opposed') { const sl = total - (opts.opposeSl ?? 0); return { sl, success: sl > 0 }; }
  return { sl: total, success: (opts.successOf ?? ((n: number) => n >= 1))(total) };
}

/** Agrège une étape « batch » PRÊTE (`stepReady`) en un `CascadeRoll` scalaire — même vocabulaire
 *  `result` qu'une étape mono, pour que l'applier `cascadeAppliers[kind]` reste kind-agnostique du
 *  nombre de contributeurs (seam de jet #275 Décision 4 cran 1). Les paramètres de formule vivent en
 *  `meta` NEUTRE (`aggregateFlatDR`/`aggregateCapTo`/`aggregateOpposeSl`/`aggregateSuccessRule`), versés
 *  à la construction. Un id de règle de succès INCONNU jette (fail-closed) : retomber en silence sur le
 *  seuil générique appliquerait à un domaine un seuil qui n'est pas le sien. */
function aggregateBatchStep(step: CascadeStep): CascadeRoll {
  const meta = step.meta;
  const flatDR = typeof meta?.aggregateFlatDR === 'number' ? meta.aggregateFlatDR : 0;
  const capTo = typeof meta?.aggregateCapTo === 'number' ? meta.aggregateCapTo : undefined;
  const opposeSl = typeof meta?.aggregateOpposeSl === 'number' ? meta.aggregateOpposeSl : 0;
  const ruleId = typeof meta?.aggregateSuccessRule === 'string' ? meta.aggregateSuccessRule : undefined;
  const successOf = ruleId ? cascadeSuccessRules[ruleId] : undefined;
  if (ruleId && !successOf) throw new Error(`aggregateBatchStep : règle de succès « ${ruleId} » non enregistrée (registerCascadeSuccessRule).`);
  const { sl, success } = aggregateBatchRolls(step.participants!, step.aggregate ?? 'summed-dr', { flatDR, capTo, opposeSl, successOf });
  return { roll: 0, target: 0, sl, success };
}

/**
 * OPPOSITION FIGÉE d'une étape, telle que la lisent les résolveurs de rangée (`meta.opposed`) —
 * SOURCE UNIQUE de la lecture : le jet d'adversaire est jeté UNE fois par le producteur et vaut pour
 * toutes les rangées. `undefined` = étape non opposée (jet simple sur la cible).
 *
 * CONTRAT d'une étape OPPOSÉE : sa `base` est NUE (Niveau de Compétence, `LDB 09 l.17`) — c'est elle
 * qui DÉPARTAGE à DR égal (`LDB 12 l.160`, `engine/tests.openValues`), et une valeur SOUTENUE y
 * comparerait deux grandeurs distinctes. `CascadeStepBase` ne peut plus porter de Soutien FONDU : le
 * Soutien est une ligne NOMMÉE de `mods` (`soutienMod`) pour TOUT producteur d'étape.
 */
export function stepOpposedFreeze(step: CascadeStep | undefined): OpposedRowFreeze | undefined {
  const opp = step?.meta?.opposed;
  if (!opp) return undefined;
  return {
    aT: opp.aT,
    ...(opp.bonusSL != null ? { bonusSL: opp.bonusSL } : {}),
    ...(opp.defenderMustWin ? { defenderMustWin: true } : {}),
  };
}

/** SURFACE des rangées d'une bande résolue par un pilote sans fenêtre, DÉCLARÉE par ce pilote : le
 *  procès-verbal structuré d'une traversée (`dayEntriesFromStep`, `seaVoyageFlow.ts`) montre déjà
 *  chaque dé, ligne par ligne — le journal ne les redit pas (#1291). Absente = le journal est la seule
 *  surface, il porte les dés. Déclaration d'APPEL (rien n'entre dans la sauvegarde), patron du mono
 *  `unwitnessed`. */
export type RowSurface = 'pv';

/**
 * Lance d'office les participants SANS influence (pilotes automatiques — `resolveRemainingCascade`/
 * `runCascadeImmediate`) : même Test générique que la modale (`rollBatchParticipant`), même opposition
 * figée, simplement sans le cycle Chance/Résilience du flux `cascadeBatch`.
 *
 * `autoResolved` — la rangée est roulée SANS FENÊTRE (`runCascadeImmediate` : bande de témoins d'une
 * fin de combat, cadence auto) : elle porte l'étampe `meta.autoResolved`, que `commitStep` lit pour
 * émettre SA ligne de trace (#1281). « Tout lancer » (`resolveRemainingCascade`) ne la pose PAS : sa
 * modale reste ouverte sur le BILAN, où chaque rangée montre son dé.
 */
function rollBatchParticipants(step: CascadeStep, autoResolved = false) {
  const opp = stepOpposedFreeze(step);
  return step.participants!.map((p) => (p.result ? p : {
    ...p,
    ...(autoResolved ? { meta: { ...p.meta, autoResolved: true } } : {}),
    result: rollBatchParticipant(p, battleRng(), opp, step.evaluation),
  }));
}

/**
 * TRACES des jets d'une étape qu'AUCUNE SURFACE n'a montrés — une ligne par jet, DÉRIVÉE par le socle
 * (`traceLineOf`) : porteur — libellé : dé/cible → issue (DR). Deux formes, un seul dériveur :
 *  - BANDE : les rangées étampées `meta.autoResolved` (posée par `rollBatchParticipants(step, true)`) ;
 *  - MONO : l'étape à jet résolue par un pilote SANS fenêtre — le pilote le DÉCLARE (`unwitnessed`,
 *    `runCascadeImmediate` ; `advanceCascade` le RE-DÉRIVE de `surfaceOf(porteurDe)` pour le dé que le
 *    curseur a posé lui-même), il n'est pas déduit d'un champ d'étape (rien n'entre dans la sauvegarde).
 *
 * PARTITION : « Tout lancer » (`resolveRemainingCascade`) n'étampe rien et ne déclare rien — sa modale
 * reste ouverte sur le BILAN, où chaque rangée montre son dé. Et le journal n'est pas la SEULE surface
 * possible d'une rangée sans fenêtre : le pilote qui rend ses bandes sur un PROCÈS-VERBAL structuré
 * (traversée de mer, `rowSurface: 'pv'`) le DÉCLARE au même titre — chaque dé sur EXACTEMENT une
 * surface, jamais deux (#1291).
 *
 * Là où il l'est, le journal est la SEULE surface de ces jets — le cas nominatif que la doctrine #295
 * réserve (cf. `cascade-consequence-guard.test.ts`). Règle de CADENCE : une cadence qui réduit les
 * interruptions ne réduit jamais les TRACES.
 */
function unwitnessedTraceLines(get: Get, step: CascadeStep, unwitnessed: boolean, rowSurface?: RowSurface): string[] {
  const out: string[] = [];
  for (const row of rowSurface ? [] : step.participants ?? []) {
    if (!row.meta?.autoResolved || !row.result) continue;
    out.push(traceLineOf({
      who: actorIn(get(), row.id)?.label ?? row.id,
      label: row.label ?? step.rollLabel ?? undefined,
      ...row.result,
      // SEUIL PUR : le dériveur omet le DR quand le jet n'en porte pas — un pourcentage n'en a pas.
      ...(step.evaluation === 'seuil' ? { sl: undefined } : {}),
    }));
  }
  if (unwitnessed && !step.participants && step.result && stepInteraction(step) === 'jet') {
    out.push(traceLineOf({
      ...(step.actorId ? { who: actorIn(get(), step.actorId)?.label ?? step.actorId } : {}),
      label: step.rollLabel ?? step.label ?? undefined,
      ...step.result,
      ...(step.evaluation === 'seuil' ? { sl: undefined } : {}),
    }));
  }
  // DÉ NU (#1508) : même règle, même déclaration du pilote — le dé qu'aucune fenêtre n'a montré a le
  // journal pour SEULE surface. Le total (et son unité) y figure : c'est lui qui fait la conséquence.
  if (unwitnessed && !step.participants && step.de?.result) {
    out.push(traceDieLineOf({
      ...(step.actorId ? { who: actorIn(get(), step.actorId)?.label ?? step.actorId } : {}),
      label: step.rollLabel ?? step.label ?? undefined,
      ...step.de.result,
      ...(step.de.unite ? { unite: step.de.unite } : {}),
    }));
  }
  return out;
}

/** Pose le choix du joueur sur l'étape « choix » COURANTE (valide que `key ∈ options`). Analogue de
 *  `cascadeRoll` côté jet : prépare l'étape ; la VALIDATION (conséquence) reste à `advanceCascade`. */
export function setCascadeChoice(get: Get, set: Set, stepId: string, key: string): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId) return;
  if (!cur.options?.some((o) => o.key === key)) return;
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...x, chosen: key } : x)) } });
}

/** Pose le NOMBRE saisi sur l'étape « quantité » COURANTE — jumeau exact de `setCascadeChoice` : la
 *  valeur est ramenée dans la plage DÉCLARÉE par l'étape (`clampStepAmount`, site unique de la borne),
 *  jamais crue telle quelle ; la VALIDATION (conséquence) reste à `advanceCascade`. */
export function setCascadeAmount(get: Get, set: Set, stepId: string, n: number): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId || !cur.quantity) return;
  const amount = clampStepAmount(cur.quantity, n);
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? { ...x, amount } : x)) } });
}

/** Tire la TABLE de l'étape COURANTE (interaction `'table'`) — SEAM d'état, analogue de
 *  `setCascadeChoice`/`cascadeRoll` : pose `table.result` via le résolveur UNIQUE (`rollTableStep`,
 *  RNG de bataille) ; la VALIDATION (conséquence) reste à `advanceCascade`. No-op si l'étape n'est pas
 *  celle visée, n'a pas de table, ou est déjà tirée (un dé ne se relance pas en douce). */
export function rollCascadeTable(get: Get, set: Set, stepId: string): void {
  poseSurCourante(get, set, stepId, (s, cur) => {
    if (!cur.table || cur.table.result) return null;
    // La déclaration RÉSOLUE (modificateur vivant versé) est celle qui tire ET celle qu'on POSE sur
    // l'étape : le `mod` qui a servi reste lisible (rangée + conséquence) au lieu d'être recalculé.
    const table = liveTableDecl(s, cur);
    return tableStepResolved(cur, table, rollTableStep(table, battleRng(), { get }), get);
  });
}

/** Tire le DÉ NU de l'étape COURANTE (interaction `'de'`, #1508) — JUMEAU EXACT de `rollCascadeTable`
 *  ci-dessus, au même goulot (`poseSurCourante`) : seule la LECTURE du dé change. No-op si l'étape
 *  n'est pas celle visée, n'a pas de dé, ou est déjà tirée (un dé ne se relance pas en douce). */
export function rollCascadeDe(get: Get, set: Set, stepId: string): void {
  poseSurCourante(get, set, stepId, (s, cur) => {
    if (!cur.de || cur.de.result) return null;
    const de = liveDeDecl(s, cur);
    return deStepResolved(cur, de, roulerDe(de, specDeEtape(de), battleRng()));
  });
}

/** LES DÉS d'un dé NU — la déclaration les porte TOUJOURS : sa porte les EXIGE au type
 *  (`rollSeam.DieStepSpec.spec`). Aucun repli d100 ici, à la différence d'une TABLE (qui a le sien,
 *  `tableSpec`) : un dé nu sans dés est un montage HORS PORTE, et le deviner en d100 rendrait un
 *  tirage que personne n'a déclaré. */
export function specDeEtape(decl: CascadeDeTirage): DiceSpec {
  if (!decl.spec) throw new Error('specDeEtape : dé NU sans `spec` — déclaration montée hors porte (`rollSeam.dieStep` l\'exige).');
  return decl.spec;
}

/** Étape à dé NU RÉSOLUE : la déclaration qui a tiré + son résultat. Jumeau PUR de `tableStepPosee`
 *  (aucun enjeu à faire redescendre — un dé nu n'a pas de ligne où descendre, aucun pli non plus :
 *  rien ne se dérive d'un total qui EST la conséquence). */
export function deStepResolved(step: CascadeStep, decl: CascadeDeDecl, result: CascadeDeResult): CascadeStep {
  return { ...step, de: { ...decl, result } };
}

/**
 * GOULOT UNIQUE des quatre poseurs de dé d'étape (tirage naturel / dé posé × dé nu / table) : garde de
 * curseur (l'étape visée est bien la COURANTE), lecture de l'état, écriture du slot. `resoudre` rend
 * l'étape RÉSOLUE, ou `null` quand rien n'est à poser (dé déjà tombé, étape sans dé, étape committée)
 * — un no-op y est un refus NOMMÉ par son poseur, jamais une écriture à vide.
 */
function poseSurCourante(get: Get, set: Set, stepId: string, resoudre: (s: GameState, cur: CascadeStep) => CascadeStep | null): void {
  const p = get().pendingCascade;
  if (!p) return;
  const cur = p.participants[p.cursor];
  if (!cur || cur.id !== stepId) return;
  const resolue = resoudre(get(), cur);
  if (!resolue) return;
  set({ pendingCascade: { ...p, participants: p.participants.map((x, k) => (k === p.cursor ? resolue : x)) } });
}

/** Faces du dé d'un tirage sur table — vue de `tableSpec` pour les appelants qui ne veulent que les
 *  faces (bornes d'une saisie, libellé). */
export function tableStepDie(decl: CascadeTableDecl): number {
  return tableSpec(decl).sides;
}

/** PLAGE des dés NATURELS que CE tirage sur table peut sortir — `plageNaturelle` appliquée aux dés
 *  résolus de la déclaration (`tableSpec`). */
export function tableStepNaturalRange(decl: CascadeTableDecl): { min: number; max: number } {
  return plageNaturelle(tableSpec(decl));
}

/**
 * MODE TABLE (#942 L3) — dé NATUREL à poser pour atteindre la ligne `row` : le lookup se fait sur le
 * dé EFFECTIF (`naturel + mod`, cf. `rollTableStep`), donc le naturel est `min − mod`, ramené dans les
 * faces du dé. `null` = ligne HORS D'ATTEINTE (aucune face n'y atterrit avec ce `mod`) — l'affordance
 * est alors désactivée, jamais un dé qui glisse en silence sur la ligne voisine. PUR.
 */
export function naturalRollForTableRow(decl: CascadeTableDecl, row: TableStepRow): number | null {
  const mod = decl.mod ?? 0;
  const plage = tableStepNaturalRange(decl);
  const lo = Math.max(plage.min, row.min - mod);
  const hi = Math.min(plage.max, row.max - mod);
  return lo <= hi ? lo : null;
}

/** Ramène une SAISIE libre aux naturels que CETTE table peut résoudre (faces du dé ∩ plage couverte,
 *  `mod` compris) — sans quoi une saisie extrême sous `mod` sortirait de la plage et ferait lever
 *  `rollTableStep` en pleine modale. */
function clampTableNatural(decl: CascadeTableDecl, roll: number): number {
  const def = tableStepDef(decl.tableId);
  const mod = decl.mod ?? 0;
  const plage = tableStepNaturalRange(decl);
  const lo = def ? Math.max(plage.min, def.rows[0].min - mod) : plage.min;
  const hi = def ? Math.min(plage.max, def.rows[def.rows.length - 1].max - mod) : plage.max;
  return Math.min(Math.max(Math.floor(roll), lo), hi);
}

/**
 * MODE TABLE (#942 L3) — POSE LE DÉ de l'étape à table COURANTE : `roll` est le dé NATUREL (le `mod`
 * s'applique après, dans le résolveur UNIQUE). SEAM d'état des DEUX affordances de la modale (champ
 * « Fixer le dé » et clic sur une ligne) : une seule sémantique, un seul site. Le dé posé est TIRÉ
 * dans la foulée (`rollTableStep`) — poser le dé EST le tirage — et l'étape porte `fixed` : la marque
 * de provenance de la rangée (`RollRow.fixedMark`) et celle du journal (`fixedDieMark`, qui lit les
 * slots ouverts) en découlent sans code par site.
 *
 * AUCUNE gate de possession ici NI dans le délégué : l'option « Dés fixés » est CLIENT-SIDE (elle
 * n'arme que l'affordance de celui qui clique, `ui/forcedDieRow.ts`) et l'autorisation d'un geste reçu
 * par le réseau est celle du SIÈGE ÉMETTEUR (`netOwnership.intentAllowedFor`) — la ré-évaluer avec
 * l'état LOCAL de l'hôte ferait tomber en silence le geste légitime d'un invité (cf. le même arbitrage,
 * verbatim, sur `opSetForcedRoll`, `state/rollFlowFactory.ts`).
 *
 * Le dé se RE-POSE tant que l'étape est COURANTE (le résultat est recalculé) — même liberté que la
 * saisie post-jet d'un slot de flux : une valeur en cours de frappe n'est pas un engagement. Le
 * curseur qui avance ferme la fenêtre (`cur.id !== stepId`).
 */
export function setCascadeTableForcedRoll(get: Get, set: Set, stepId: string, roll: number): void {
  poseSurCourante(get, set, stepId, (s, cur) => {
    if (!cur.table || cur.committed) return null;
    const live = liveTableDecl(s, cur);
    const table: CascadeTableDecl = { ...live, forcedRoll: clampTableNatural(live, roll) };
    return { ...tableStepResolved(cur, table, rollTableStep(table, battleRng(), { get }), get), fixed: true };
  });
}

/** POSE LE DÉ d'une étape à DÉ NU (#1508) — JUMEAU EXACT de `setCascadeTableForcedRoll` ci-dessus
 *  (même goulot, même absence de gate de possession, même liberté de RE-POSE tant que l'étape est
 *  courante) : seule la borne change (`plageNaturelle` des dés déclarés, sans plage de table à
 *  intersecter) et la lecture reste nue. */
export function setCascadeDeForcedRoll(get: Get, set: Set, stepId: string, roll: number): void {
  poseSurCourante(get, set, stepId, (s, cur) => {
    if (!cur.de || cur.committed) return null;
    const live = liveDeDecl(s, cur);
    const spec = specDeEtape(live);
    const de: CascadeDeDecl = { ...live, forcedRoll: clampNaturel(spec, roll) };
    return { ...deStepResolved(cur, de, roulerDe(de, spec, battleRng())), fixed: true };
  });
}

/**
 * DOCTRINE UNIQUE du slot `pendingCascade` — partagée par `pushStep` et `startCascade` (#942 L1) :
 * il porte UNE séquence, et **rien n'y est jamais écrasé**.
 *  - slot LIBRE → la séquence s'ouvre ;
 *  - slot de MÊME `purpose` (en cours OU en BILAN, curseur en fin) → les étapes sont APPENDUES : le
 *    mono est le cas N=1 d'une séquence, pas un cycle distinct. Appender sur un bilan le RÉOUVRE, donc
 *    son dénouement (`travelHalt`/`combatEndBoundary`/… → `dispatchCascadeDone`) se joue au « Terminer »
 *    de la séquence FUSIONNÉE, jamais perdu — c'est pourquoi les bornes des deux fragments sont RÉUNIES
 *    et pourquoi ce dispatch est CUMULATIF (combatSlice.ts) ;
 *  - slot d'un AUTRE `purpose` → il est SUSPENDU (pile LIFO `suspendedCascades`) avant que la nouvelle
 *    séquence n'ouvre ; sa reprise est portée par la couture de CLÔTURE de cascade (`dispatchCascadeDone`,
 *    slot libre et hors combat) et par le teardown de combat.
 */

/**
 * L'ÉTAPE COURANTE pendant qu'un applier (et sa continuation) tournent — `null` hors de ce temps.
 * `apres` = l'id de l'étape en cours de validation ; `inseres` = les étapes que CE même applier a
 * poussées derrière elle ; `seqBase` = le compteur d'identité au moment de l'ouverture ; `dernier` =
 * l'id du dernier poussé (lu par la couture de continuation, qui doit confier sa suite à CETTE
 * étape-là et non à la dernière du tableau).
 *
 * Les étapes poussées pendant ce temps n'entrent PAS dans le store : elles sont COLLECTÉES ici, et
 * `commitStep` les fusionne sur SON tableau, par le chemin déjà honoré du retour d'applier
 * (`insert`). C'est ce qui les rend visibles des TROIS pilotes — l'interactif, « Tout résoudre » et
 * l'immédiat commitent sur un tableau LOCAL, et une écriture au store leur passait à côté (elle était
 * écrasée par « Tout résoudre », et jouée trop tard par l'immédiat).
 */
let fenetreInsertion: { apres: string; inseres: CascadeStep[]; seqBase: number; purpose?: PendingCascade['purpose']; dernier: string | null } | null = null;

/** Les étapes COLLECTÉES par la fenêtre en cours — la couture de continuation doit pouvoir les COMPTER
 *  et les ANNOTER avant qu'elles n'entrent dans le tableau du pilote (#1508). */
export function etapesDeLaFenetre(): readonly CascadeStep[] {
  return fenetreInsertion?.inseres ?? [];
}

/** ANNOTE une étape collectée (son `meta` de continuation) — rend `false` si elle n'est pas dans la
 *  fenêtre, auquel cas l'appelant passe par le store. */
export function annoterEtapeDeLaFenetre(id: string, meta: CascadeStepMeta): boolean {
  const f = fenetreInsertion;
  const k = f ? f.inseres.findIndex((x) => x.id === id) : -1;
  if (!f || k < 0) return false;
  f.inseres[k] = { ...f.inseres[k], meta };
  return true;
}

/**
 * ID de la DERNIÈRE étape poussée pendant l'application en cours (#1508), ou `null` hors fenêtre. La
 * couture de continuation (`state/combatEffects.differerLaSuite`) confie sa suite à CELLE-LÀ : « la
 * dernière étape ouverte » est un fait de POUSSÉE, pas de position — depuis que les étapes s'insèrent,
 * la dernière du tableau peut être une étape ANTÉRIEURE d'un autre porteur.
 */
export function idDeLaDernierePoussee(): string | null {
  return fenetreInsertion?.dernier ?? null;
}

/**
 * COMPTEUR d'identité d'une séquence. REPLI sur la longueur quand `seq` manque — une séquence
 * restaurée d'une sauvegarde ANTÉRIEURE à #1508, seul cas où elle n'en porte pas (toute séquence
 * ouverte par le code en pose un).
 *
 * Ce repli n'est PAS monotone : une longueur qui a reculé (troncature avant la sauvegarde) redonne un
 * id déjà porté, et `state/combatEffects.indexDeLEtapeQuiAttend` lève alors nommément plutôt que
 * d'accrocher la suite au mauvais porteur. Le régime des sauvegardes (MEMORY.md « SAVES : reset »,
 * 2026-08-17) ne migre pas une sauvegarde antérieure : elle se jette, le cas ne survit pas à un reset.
 */
function seqDe(p: PendingCascade): number {
  return p.seq ?? p.participants.length;
}

/**
 * La FENÊTRE qui accueille une poussée, ou `null` si elle doit aller au STORE (#1508). DEUX formes
 * d'ancrage, parce que le tableau en cours de validation n'est pas toujours dans le slot :
 *  - la séquence du STORE porte l'étape courante (pilotes interactif et « Tout résoudre ») ;
 *  - le tableau est LOCAL au pilote immédiat (`runCascadeImmediate`) : rien à trouver dans le store, et
 *    c'est le `purpose` déclaré par ce pilote qui reconnaît sa propre séquence.
 * Hors de ces deux cas il n'y a pas d'ancre, et la poussée s'appende en FIN de séquence : les dés
 * ouverts HORS applier (`ouvrirChute` d'un effondrement de passerelle, d'une chute de selle), et une
 * poussée d'un AUTRE `purpose` faite pendant une application (elle ouvre sa propre séquence, elle
 * n'est la suite de personne).
 */
function fenetrePour(same: PendingCascade | null, purpose: PendingCascade['purpose']): typeof fenetreInsertion {
  const f = fenetreInsertion;
  if (!f) return null;
  if (same?.participants.some((x) => x.id === f.apres)) return f;
  return f.purpose !== undefined && f.purpose === purpose ? f : null;
}

/**
 * LE RANG D'UNE ÉTAPE À NAÎTRE (#1852) — DÉRIVATION UNIQUE du compteur de la séquence d'accueil,
 * partagée par l'APPEND (`pushStep`, patron `pushDie`) et par tout mint qui forge son id en amont
 * (`rollSeam.idDansLaSequence` : hôtes de combat, manches de poursuite/taverne, orientation…).
 *
 * FENÊTRE-AWARE : une étape mintée PENDANT l'application d'une autre (Critique, Assaut féroce `onHit`
 * → `resolveFreeAttacks` → `maybeOpenDefense`) naît dans la fenêtre d'insertion, dont le rang part de
 * `seqBase` — lire `pendingCascade.seq` y rendrait un rang PÉRIMÉ, donc un id déjà pris (collision).
 * `purpose` absent = « la séquence en place, quelle qu'elle soit » (sous-jeux à séquence unique).
 */
export function compteurDeSequence(s: Pick<GameState, 'pendingCascade'>, purpose?: PendingCascade['purpose']): number {
  const cur = s.pendingCascade;
  const same = cur && (purpose === undefined || cur.purpose === purpose) ? cur : null;
  const p = purpose ?? same?.purpose ?? cur?.purpose;
  const fenetre = p ? fenetrePour(same, p) : null;
  if (fenetre) return fenetre.seqBase + fenetre.inseres.length;
  return same ? seqDe(same) : 0;
}

/** Pousse UNE étape déjà formée dans la séquence de `purpose` (doctrine du slot ci-dessus). Quand
 *  l'étape OUVRE la séquence, elle PRÊTE son `label`/`icon` au titre de la fenêtre (« Surprise »,
 *  « Imparfaite »…) — la situation qui l'a ouverte est le titre juste ; repli générique
 *  « Conséquences » si l'étape n'en porte pas. La variante FABRIQUE reçoit le COMPTEUR MONOTONE de la
 *  séquence (`PendingCascade.seq`), d'où elle dérive un id unique — jamais la longueur du tableau, qui
 *  recule à chaque troncature. SOURCE UNIQUE de l'append d'une étape (`pushCombatStep`
 *  = `pushStep(…, 'combat')`, `pushReveal` route par ici TOUTE révélation, #942 L8).
 *
 *  `purpose` accepte une FONCTION de l'état : un appelant qui n'a que `set` (les sites de conséquence
 *  d'attaque n'ont pas tous le `get`) doit pouvoir choisir sa séquence d'accueil SUR l'état — elle est
 *  alors évaluée DANS le même `set` atomique que l'append, donc sur l'état qui reçoit l'étape.
 *
 *  La FABRIQUE peut rendre `undefined` : un constructeur de la porte qui REFUSE sa déclaration
 *  (`rollSeam.refusePorte`) n'a aucune étape à donner, et l'index d'append n'est connu qu'ici — sans
 *  cette sortie, l'appelant devrait mimer la doctrine du slot pour décider en amont.
 *
 *  PENDANT l'application d'une étape (#1508), la poussée n'écrit PAS dans le store : elle est collectée
 *  par la fenêtre d'insertion et fusionnée par `commitStep` sur le tableau du pilote, juste derrière
 *  l'étape courante. Le store reste la destination de toute poussée faite HORS application.
 *
 *  L'invariant de possession de bande (`assertBandeDeclarePossession`, ci-dessous) s'applique à l'APPEND
 *  comme à l'ouverture : une bande sans possession glissée par cette voie échapperait sinon à la garde. */
export function pushStep(set: Set, step: CascadeStep | ((index: number) => CascadeStep | undefined), purpose: PendingCascade['purpose'] | ((s: GameState) => PendingCascade['purpose'])): void {
  set((s) => {
    const p = typeof purpose === 'function' ? purpose(s) : purpose;
    const cur = s.pendingCascade;
    const same = cur && cur.purpose === p ? cur : null;
    const fenetre = fenetrePour(same, p);
    const compteur = compteurDeSequence(s, p);
    const st = typeof step === 'function' ? step(compteur) : step;
    if (!st) return {};
    assertBandeDeclarePossession([st]);
    assertIdsUniques([st], same?.participants ?? []);
    // PENDANT une application : COLLECTÉE, pas écrite — `commitStep` la fusionnera sur le tableau du
    // pilote (le store n'est pas l'hôte du tableau tant qu'une étape se valide).
    if (fenetre) { assertIdsUniques([st], fenetre.inseres); fenetre.inseres.push(st); fenetre.dernier = st.id; return {}; }
    // L'append est une PORTE du curseur : une étape qui atterrit SOUS le curseur passe par le seam
    // (`poserLeCurseur`), comme à l'ouverture. `pushStep` n'a pas de `get` — l'état de CE `set` fait
    // office de lecture, il est celui qui reçoit l'étape.
    const g = (() => s) as Get;
    // APPEND : le curseur ne bouge QUE s'il était en bilan (`cursor === participants.length`) — sinon
    // il reste posé sur l'étape en cours, et ce n'est pas une ARRIVÉE (cf. `franchirLesHotesOrphelins`).
    if (same) return { pendingCascade: poserLeCurseur(g, { ...same, participants: [...same.participants, st], seq: compteur + 1 }, same.cursor >= same.participants.length) };
    const fresh: PendingCascade = poserLeCurseur(g, { title: st.label ?? 'Conséquences', icon: st.icon ?? 'action/attack', purpose: p, cursor: 0, log: [], participants: [st], seq: 1 });
    // Slot occupé par un AUTRE purpose : on le SUSPEND (jamais un écrasement) — même `set` atomique
    // que `suspendActiveCascade`, dont `pushStep` n'a pas le `get`.
    return cur ? { pendingCascade: fresh, suspendedCascades: [...s.suspendedCascades, cur] } : { pendingCascade: fresh };
  });
}

/**
 * INVARIANT DE POSSESSION D'UNE BANDE (#1262 V2 L4, verdict de palier) : une étape À RANGÉES DÉCLARE
 * à qui elle appartient — plus d'UN porteur ⇒ `groupOwner` (owner `'*'` : chaque siège voit la fenêtre
 * où se tient SA rangée) ; un SEUL porteur ⇒ `actorId` = ce porteur. Sans l'un des deux, l'arbitre
 * (`modalArbiter`, entrée `cascade`) rend `undefined`, donc la fenêtre à l'HÔTE SEUL — et le siège du
 * porteur ne voit jamais sa rangée (`netOwnership.ownsLocally`).
 *
 * Les mints (`rollSeam.bandStep`, `buildBatchStep`) POSENT cette possession : la garde ne corrige
 * rien, elle FERME la forme — un montage manuscrit qui la perdrait n'entre pas dans une séquence.
 *
 * PORTÉE EXACTE, dite (garde de FORME : elle lit l'étape, jamais un call-site) — les DEUX portes
 * d'ENTRÉE d'étapes dans le slot, `startCascade` et `pushStep`. Ce qu'elle ne voit PAS :
 *  - une séquence RESTAURÉE d'une sauvegarde (`store.loadGame`) écrit le slot en direct. La save
 *    chargée est toujours à `SAVE_VERSION` (toute autre version est jetée, `saves.ts`) : ses bandes
 *    sont donc celles que les FABRIQUES du jeu ont mintées avant la sauvegarde ;
 *  - `runCascadeImmediate` bloqué sur un CHOIX sans défaut authoré : il installe `pendingCascade` en
 *    direct pour surfacer l'impasse (#351) — les étapes qu'il porte viennent de son appelant ;
 *  - les REMPLACEMENTS d'étape courante en vol : insertion de conséquence (`commitStep`), reminte du
 *    `cast` partagé (`combatFlow`) et du désengagement à deux joués (`combatSlice`) — ils réécrivent
 *    une étape DÉJÀ entrée, sans repasser par une porte.
 * DEV : la violation THROW ; en PROD elle se journalise et la séquence s'ouvre (même politique).
 */
function assertBandeDeclarePossession(steps: readonly CascadeStep[]): void {
  for (const st of steps) {
    const rows = st.participants;
    if (!rows?.length) continue;
    const porteurs = new Set(rows.map((r) => r.id)).size;
    if (st.groupOwner) continue;               // possession de GROUPE : toute forme
    if (porteurs <= 1 && st.actorId) continue; // porteur UNIQUE : nommé
    const msg = `[cascade] bande « ${st.id} » (${st.kind}) : ${porteurs} porteur(s) et AUCUNE possession déclarée `
      + '(`groupOwner` au-delà d\'un porteur, `actorId` pour un seul) — la fenêtre échoirait à l\'hôte seul, '
      + 'et le siège du porteur ne verrait jamais sa rangée.';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
}

/**
 * INVARIANT D'IDENTITÉ D'ÉTAPE (#1298, #1852) : dans UNE séquence, deux étapes ne portent jamais le
 * même `id`. L'id est l'ADRESSE de l'étape — `cascadeChoose`, les grappes de dés
 * (`combatEffects.groupeDe`), les insertions de conséquence et la recette la visent par lui. Deux
 * étapes homonymes rendent la première in-adressable : c'est ainsi qu'une seconde DÉFENSE (attaque
 * gratuite) se glissait derrière la première sans que rien ne les distingue (#1852).
 *
 * PORTÉE EXACTE, dite : les DEUX portes d'entrée d'étapes dans le slot (`startCascade`, `pushStep`) —
 * ouverture, append au fragment en place, et collecte d'insertion. Elle ne voit NI une séquence
 * restaurée d'une sauvegarde, NI les remplacements d'étape en vol (mêmes exceptions que
 * `assertBandeDeclarePossession` ci-dessus, pour les mêmes raisons).
 *
 * Une porte qui appende N étapes de même nature dérive son id du COMPTEUR MONOTONE de la séquence
 * (`rollSeam.idDansLaSequence`, patron `pushDie`) — jamais de la longueur du tableau, qui recule à
 * chaque troncature.
 *
 * COUVERTURE : TOUTE collision, quel que soit le genre d'étape — un id est une ADRESSE, jamais un
 * porteur de donnée (le rang d'une manche vit sur `meta.round`, pas dans `pursuit-N`). En DEV elle
 * JETTE, en PROD elle se journalise et la séquence s'ouvre (politique de la possession de bande).
 */
function assertIdsUniques(steps: readonly CascadeStep[], dejaLa: readonly CascadeStep[]): void {
  const vus = new Set(dejaLa.map((x) => x.id));
  for (const st of steps) {
    if (!vus.has(st.id)) { vus.add(st.id); continue; }
    const msg = `[cascade] étape « ${st.id} » (${st.kind}) : une étape de CE même id est déjà dans la `
      + 'séquence — l\'id est l\'adresse d\'une étape, deux homonymes en rendent une in-adressable '
      + '(dériver l\'id du compteur `seq` : `rollSeam.idDansLaSequence`, patron `pushDie`).';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
}

/**
 * Ouvre une séquence interactive (≥ 1 étape influençable). Le curseur démarre sur la 1ʳᵉ étape.
 * Applique la DOCTRINE DU SLOT ci-dessus (append même purpose / suspension sinon) : aucun écrasement.
 * `restNights` du fragment déjà en place l'emporte (`??`) — un séjour multi-nuits porte SON compteur,
 * un fragment appendu ne le réécrit pas ; les bornes booléennes, elles, s'ADDITIONNENT (`||`).
 */
export function startCascade(
  get: Get,
  set: Set,
  opts: { title: string; icon?: string; purpose: PendingCascade['purpose']; steps: CascadeStep[]; log?: string[]; travelHalt?: boolean; roundBoundary?: boolean; combatEndBoundary?: boolean; restNights?: PendingCascade['restNights'] },
): void {
  if (!opts.steps.length) return;
  assertBandeDeclarePossession(opts.steps);
  const cur = get().pendingCascade;
  assertIdsUniques(opts.steps, cur && cur.purpose === opts.purpose ? cur.participants : []);
  if (cur && cur.purpose === opts.purpose) {
    // APPEND au fragment en place : le curseur en BILAN (`cursor === participants.length`) se retrouve
    // POSÉ sur la première étape appendue — même porte que l'ouverture (`poserLeCurseur`).
    set({
      pendingCascade: poserLeCurseur(get, {
        ...cur,
        participants: [...cur.participants, ...opts.steps],
        seq: seqDe(cur) + opts.steps.length,
        log: [...cur.log, ...(opts.log ?? [])],
        travelHalt: cur.travelHalt || opts.travelHalt,
        roundBoundary: cur.roundBoundary || opts.roundBoundary,
        combatEndBoundary: cur.combatEndBoundary || opts.combatEndBoundary,
        restNights: cur.restNights ?? opts.restNights,
      }, cur.cursor >= cur.participants.length),
    });
    return;
  }
  if (cur) suspendActiveCascade(get, set);
  set({
    pendingCascade: poserLeCurseur(get, {
      title: opts.title, icon: opts.icon, purpose: opts.purpose,
      participants: opts.steps, seq: opts.steps.length, cursor: 0, log: opts.log ?? [], travelHalt: opts.travelHalt, roundBoundary: opts.roundBoundary, combatEndBoundary: opts.combatEndBoundary, restNights: opts.restNights,
    }),
  });
}

/**
 * SEAM `onOwnTestFailed` d'une étape À PARTICIPANTS — calque EXACT du seam MONO (cf. `commitStep`
 * ci-dessous), joué PAR RANGÉE PERDANTE : le porteur est celui de la rangée (`part.id`), le DR est
 * celui de SON jet. Un effet déclenché sur ce trigger ne connaît pas la forme de la fenêtre — MSRC 16
 * l.152-158 (Crampes abdominales) verbatim : « Lorsqu'un Test se solde par un échec normal ou pire,
 * il se plie en deux de douleur […] et gagne l'État *Sonné*. » Une bande sourde le perdrait pour TOUS
 * ses héros. L'étampe `meta.noOwnTestFailed` coupe la ré-entrance, au niveau de la BANDE comme d'une
 * seule RANGÉE (`BatchParticipant.meta`, jumeau du `meta` d'étape).
 */
function batchOwnTestFailedLines(get: Get, step: CascadeStep): string[] {
  if (step.meta?.noOwnTestFailed) return [];
  const lines: string[] = [];
  for (const part of step.participants ?? []) {
    // `statuQuo` : égalité parfaite d'un Test opposé (LDB 12 l.160) — rien ne s'est passé, ce n'est pas un
    // Test raté : le trigger d'échec ne part pas.
    if (!part.result || part.result.success || part.result.statuQuo || part.meta?.noOwnTestFailed) continue;
    const actor = actorIn(get(), part.id);
    if (!actor) continue;
    lines.push(...(ownTestFailedEmitter?.(get, actor, part.result.sl) ?? []));
  }
  return lines;
}

/** Applique la conséquence d'une étape + ses insertions ; renvoie le tableau d'étapes mis à jour, les
 *  lignes de journal, et `suspended` (l'applier a fait basculer le slot ACTIF vers un AUTRE contexte —
 *  `startCombat`, cf. `suspendActiveCascade` — PENDANT sa propre exécution). Partagé par les trois
 *  pilotes (interactif, « tout résoudre », immédiat).
 *
 *  `unwitnessed` : le pilote DÉCLARE qu'aucune fenêtre n'a montré le jet de cette étape (pilote
 *  immédiat) — le goulot en dérive alors la ligne de dé (`unwitnessedTraceLines`). `rowSurface` : le
 *  même pilote DÉCLARE où ses RANGÉES de bande se montrent, quand ce n'est pas le journal (#1291). */
/**
 * CE QUE LE PILOTE DIT AU GOULOT (#1508) — `commitStep` ne devine plus rien de la séquence qu'il
 * valide : le pilote la tient, il la nomme.
 *
 * `seq` est REQUIS, et c'est le geste : le compteur d'identité vit chez le pilote (il le reçoit de
 * `commitStep` et le repose à chaque écriture du slot), donc lui seul en connaît la valeur courante.
 * Un pilote qui l'omettrait ne compile pas — mieux qu'une erreur nommée, qui se découvrirait en jeu.
 *
 * `purpose` est l'ANCRE de la fenêtre d'insertion : c'est par lui qu'une poussée faite pendant
 * l'application reconnaît la séquence à laquelle elle appartient, y compris quand cette séquence est un
 * tableau LOCAL absent du slot.
 */
interface PiloteDuCommit {
  seq: number;
  purpose?: PendingCascade['purpose'];
  /** Pilote INTERACTIF : repart des participants COURANTS (post-applier) pour préserver ses appends. */
  liveMerge?: boolean;
  /** Le jet a été posé PAR le pilote : aucune fenêtre ne l'a montré, le goulot lui donne sa ligne. */
  unwitnessed?: boolean;
  /** L'appelant DÉCLARE que les rangées de ses bandes se montrent ailleurs qu'au journal (#1291). */
  rowSurface?: RowSurface;
}

function commitStep(get: Get, set: Set, steps: CascadeStep[], i: number, pilote: PiloteDuCommit): { steps: CascadeStep[]; journal: string[]; suspended: boolean; seq: number } {
  const { liveMerge = false, unwitnessed = false, rowSurface } = pilote;
  const before = get().pendingCascade;
  // Étape « batch » (participants — seam de jet #275 Décision 4 cran 1) : AGRÈGE les contributeurs
  // (déjà tous résolus, `stepReady`) en UN `CascadeRoll` scalaire — l'applier lit `step.result` comme
  // n'importe quelle étape mono, kind-agnostique du nombre de rangées. `aggregate:'none'` (#351) : jets
  // INDÉPENDANTS — RIEN à agréger, l'applier lit CHAQUE `participants[i].result` lui-même.
  let step = steps[i];
  if (step.participants && !step.result && step.aggregate !== 'none') step = { ...step, result: aggregateBatchStep(step) };
  const hero = step.actorId ? actorIn(get(), step.actorId) : undefined;
  // TRACE des jets qu'aucune SURFACE n'a montrés — AVANT la conséquence : le dé se lit d'abord, l'effet
  // ensuite, comme dans la fenêtre qui ne s'est pas ouverte.
  const traces = unwitnessedTraceLines(get, step, unwitnessed, rowSurface);
  journaliser(get, set, traces, 'info', { actorId: step.actorId });
  // FENÊTRE D'INSERTION (#1508) ouverte le temps que l'applier — et la continuation qui le suit —
  // tournent : une étape poussée pendant ce temps est la SUITE IMMÉDIATE de celle-ci, pas la fin de la
  // séquence. Rendue à sa valeur précédente ensuite (un applier peut en déclencher un autre).
  const fenetreAvant = fenetreInsertion;
  // L'ANCRE et le COMPTEUR viennent du PILOTE, jamais d'une devinette sur le slot : le tableau en cours
  // de validation n'y est pas toujours (pilote immédiat, étape insérée sous « Tout résoudre » qui ne
  // réécrit le slot qu'à la fin). Devinés, ils redonnaient une LONGUEUR — qui recule à chaque
  // troncature — et une ancre `undefined` qui renvoyait la poussée au store, où le `set` final l'écrase.
  // Le `max` garde le compteur MONOTONE si le slot a avancé de son côté (poussée hors fenêtre).
  const enSlot = get().pendingCascade;
  const dansLeSlot = !!enSlot && enSlot.participants.some((x) => x.id === step.id);
  const seqBase = Math.max(pilote.seq, dansLeSlot ? seqDe(enSlot) : 0);
  fenetreInsertion = { apres: step.id, inseres: [], seqBase, purpose: pilote.purpose, dernier: null };
  let out: ReturnType<CascadeApplier>;
  let lines: ReturnType<typeof resultLines>;
  let insereesParLApplier: CascadeStep[];
  try {
    out = cascadeAppliers[step.kind]?.apply(get, set, step, hero, { steps, index: i });
    // `consequences` (#295 Lot 0) : rendu en LIGNES STRUCTURÉES (#349, `resultLines`) — seule voie de
    // dénouement. Le journal texte reste alimenté depuis le même texte (`l.text`), par le routage
    // UNIQUE `journaliser` : combat ouvert → `battle.log`, sinon `journal`.
    lines = out?.consequences ? resultLines(out.consequences) : [];
    journaliser(get, set, lines.map((l) => l.text), 'info', { actorId: step.actorId });
    // La CONSÉQUENCE est dite ; la CONTINUATION que l'étape porte (#1508 — le reste du lot/de la pile que
    // son dé a fait attendre) se joue MAINTENANT, jamais avant : c'est ce qui garde l'ordre de l'auteur
    // dans le journal, et ce qui laisse la conséquence se mesurer sur l'état qu'elle a elle-même produit.
    suiteApresCommit?.(get, set, step);
  } finally {
    insereesParLApplier = fenetreInsertion?.inseres ?? [];
    fenetreInsertion = fenetreAvant;
  }
  // SEAM CENTRAL `onOwnTestFailed` (tests DIFFÉRÉS d'entretien + tests déclenchés de combat en cascade) :
  // toute étape à JET RATÉ (`faim`/`recovery`/`diseaseTick`/`diseasePersist`/`traumaFracture`/`contagion`/
  // `triggeredTest`… — TOUS passent par ce `commitStep`) émet le trigger pour son acteur. L'étampe
  // `meta.noOwnTestFailed` (posée sur le FM de palier 2 des Crampes) coupe la ré-entrance. Émetteur INJECTÉ
  // (`setOwnTestFailedEmitter`, patron `testRouter`) pour éviter le cycle cascade↔triggeredEffects. Sous-Test
  // du FM résolu INLINE (pas de `set` threadé : ouvrir une cascade IMBRIQUÉE dans un commitStep serait fragile).
  // Une BANDE émet PAR RANGÉE PERDANTE (`batchOwnTestFailedLines`) : le trigger est dû au Test, pas à la
  // forme de la fenêtre — SOURCE UNIQUE ici pour les deux formes, jamais un second site par applier.
  const interaction = stepInteraction(step);
  const ownTestFailedLines = interaction === 'batch'
    ? batchOwnTestFailedLines(get, step)
    : ((interaction === 'jet' && step.result && !step.result.success && !step.result.statuQuo && hero && !step.meta?.noOwnTestFailed)
      ? (ownTestFailedEmitter?.(get, hero, step.result.sl) ?? []) : []);
  journaliser(get, set, ownTestFailedLines, 'info', { actorId: step.actorId });
  // L'étape VALIDÉE garde sa conséquence (`outcome`) pour rester LISIBLE dans la pile à l'écran. Une
  // étape d'AFFICHAGE porte son contenu d'avance (`outcome` pré-rempli) avec un applier muet → on le
  // PRÉSERVE (sinon le journal vide l'effacerait à la validation).
  const shown = lines.length ? lines : (step.outcome ?? []);
  // Pilote INTERACTIF (`liveMerge`) : l'applier d'une conséquence de combat FOLDÉE (déviation) re-déclenche
  // le reste de l'attaque, qui APPEND des étapes au pending (via pushReveal). On repart alors des
  // participants COURANTS (post-applier) pour préserver ces appends — le pending est EN PHASE ici
  // (advanceCascade). Les pilotes BATCH ne l'activent PAS (leur tableau local porte des jets/choix pas
  // encore posés dans le pending). SUSPENDUE (slot occupé par un autre contexte) → `get().pendingCascade`
  // vaut `null`, `live` retombe naturellement sur `undefined` (pas de merge, pas de crash).
  const live = liveMerge ? get().pendingCascade?.participants : undefined;
  const base = live && live.length >= steps.length && live[i]?.id === step.id ? live : steps;
  // Le MÉMO DE PLI (`foldMemo`) ne vaut que tant que l'étape est COURANTE et son dé RE-POSABLE : au
  // COMMIT, l'étape est jouée, plus rien ne se re-pose — et le mémo porte les dérivées des dés
  // EXPLORÉS PUIS ABANDONNÉS, qui n'appartiennent qu'au siège qui pose. Purgé ICI, seul site qui
  // étampe `committed` — les trois pilotes y passent.
  // La CONTINUATION (#1508) se rend au MÊME endroit et pour la MÊME raison : au commit, la suite que
  // l'étape faisait attendre vient d'être jouée — ou reportée sur le dé qu'elle a rouvert, qui en porte
  // désormais sa propre copie. La garder ici la ferait rejouer au rechargement d'une sauvegarde.
  let next = base.map((x, k) => {
    if (k !== i) return x;
    const { foldMemo: _joue, ...sansMemo } = x;
    const { apresFlow: _af, apresClotures: _ac, apresMode: _am, apresLabel: _al, ...meta } = x.meta ?? {};
    return { ...sansMemo, ...(x.meta ? { meta } : {}), ...(step.result ? { result: step.result } : {}), committed: true, outcome: shown };
  });
  // LES DEUX voies d'insertion d'un applier, fusionnées ICI et nulle part ailleurs (#1508) : ce qu'il
  // DÉCLARE en rendant la main (`insert`), et ce qu'il a POUSSÉ pendant qu'il tournait (la fenêtre) —
  // dans cet ordre, tous deux derrière l'étape courante. Le tableau rendu est celui que les TROIS
  // pilotes relisent, donc l'insertion ne dépend plus de qui pilote.
  const inseres = [...(out?.insert ?? []), ...insereesParLApplier];
  if (inseres.length) next = [...next.slice(0, i + 1), ...inseres, ...next.slice(i + 1)];
  // TRONCATURE (`stopSequence`) : les étapes restantes n'existent plus — aucun pilote n'a de « reste »
  // à résoudre, à préserver dans `suspendedCascades`, ni à rejouer. Lue ICI, une seule fois, pour les
  // trois. `insert` d'une même conséquence reste honoré : on tronque APRÈS lui (une conséquence peut
  // vouloir sa suite immédiate et rien d'autre) — et APRÈS les étapes que CETTE application a glissées
  // derrière elle (#1508 : le dé qu'elle vient d'ouvrir EST sa conséquence, pas le « reste » qu'elle
  // annule ; le tronquer le ferait tomber en silence).
  if (out?.stopSequence) next = next.slice(0, i + 1 + inseres.length);
  // NOTRE cascade a été PARQUÉE pendant l'exécution de l'applier — `suspendActiveCascade` (couture
  // universelle `startCombat`/`transitionTo`, qui vide le slot ; ou `startCascade` d'un AUTRE `purpose`,
  // #942 L1, qui le rend à la nouvelle cascade) : elle est dans `suspendedCascades`. Le retour l'expose,
  // JAMAIS écrit ici — ressusciter le slot écraserait le contexte qui l'a pris.
  // La PILE est le signe EXACT (pas la simple différence de référence du slot) : un applier qui APPEND
  // (conséquence foldée, liveMerge) ou qui rend la main à une cascade SUIVANTE de son propre flux
  // (journée de mer → jour d'après) ne parque rien et n'est pas une suspension.
  const after = get().pendingCascade;
  const parked = before !== null && get().suspendedCascades.lastIndexOf(before) >= 0;
  const suspended = before !== null && (after === null || parked);
  return { steps: next, journal: [...traces, ...lines.map((l) => l.text), ...ownTestFailedLines], suspended, seq: seqBase + insereesParLApplier.length };
}

/** Cascade EN COURS de résolution suspendue EN PLEIN VOL (`commitStep` a détecté `suspended`) : MET À
 *  JOUR dans `suspendedCascades` l'entrée poussée par `suspendActiveCascade` (référence `stale`, poussée
 *  DEPUIS le slot actif AVANT que l'applier n'y touche) — `patch` = ses étapes À JOUR (celles que
 *  `commitStep` vient de committer/insérer), `null` = on la RETIRE (séquence FINIE : plus aucune étape
 *  restante à préserver). Ne ressuscite JAMAIS le slot actif (propriété d'un AUTRE contexte désormais,
 *  ex. combat) : SEULE la pile est touchée. No-op si `stale` n'y est plus (déjà résumée entre-temps,
 *  cas extrême hors coop synchrone). */
function reconcileSuspended(get: Get, set: Set, stale: PendingCascade, patch: Partial<PendingCascade> | null): void {
  const stack = get().suspendedCascades;
  const idx = stack.lastIndexOf(stale);
  if (idx < 0) return;
  set({ suspendedCascades: patch ? stack.map((x, k) => (k === idx ? { ...x, ...patch } : x)) : stack.filter((_, k) => k !== idx) });
}

/** SUSPEND la cascade ACTIVE (si une l'est) : la pousse en tête de `suspendedCascades` (pile LIFO) et
 *  vide le slot `pendingCascade`. Primitive GÉNÉRIQUE (kind-agnostique, aucune mention de domaine) —
 *  déclenchée par la couture universelle `startCombat`/`transitionTo` (state/combatSlice.ts,
 *  state/store.ts) : un combat qui s'ouvre PENDANT une cascade active (ex. un abordage déclenché par
 *  l'applier d'une étape de voyage) ne doit ni écraser ni perdre les étapes restantes — le slot
 *  `pendingCascade` redevient disponible pour les cascades DU COMBAT (jets d'attaque…), gates d'action
 *  inchangés (`targetingModes.ts`/`combatSlice.ts` continuent de lire `pendingCascade` = la cascade
 *  ACTIVE). No-op si aucune cascade n'est active. */
export function suspendActiveCascade(get: Get, set: Set): void {
  const p = get().pendingCascade;
  if (!p) return;
  set({ pendingCascade: null, suspendedCascades: [...get().suspendedCascades, p] });
}

/** RÉSUME la tête de pile (`suspendedCascades`, LIFO) dans le slot `pendingCascade` — SEULEMENT si le
 *  slot est LIBRE (jamais un écrasement). Déclenchée par la couture universelle de teardown de combat
 *  (`dismissVictory`/`dismissDefeat`, state/store.ts). Renvoie `true` si une cascade a été résumée. */
export function resumeSuspendedCascade(get: Get, set: Set): boolean {
  if (get().pendingCascade) return false;
  const stack = get().suspendedCascades;
  if (!stack.length) return false;
  const top = stack[stack.length - 1];
  // La REPRISE est une porte du curseur : la séquence parquée revient peut-être SUR une table (son
  // applier a ouvert un combat en plein vol) — elle passe par le même seam que l'ouverture.
  set({ pendingCascade: poserLeCurseur(get, top), suspendedCascades: stack.slice(0, -1) });
  return true;
}

/**
 * PURGE les étapes d'ENTRÉE DE ZONE des cascades PARQUÉES — couture du changement de scène
 * (`transitionTo`, state/store.ts). Une carte narrative d'entrée parquée (par un combat, par une
 * autre séquence) narre la scène qu'on QUITTE : reprise plus tard, elle s'afficherait par-dessus la
 * scène SUIVANTE. La purge est bornée à CETTE classe d'étapes (`reveal.kind === 'sceneEntry'`) —
 * toute autre séquence parquée (un jour de voyage suspendu par un abordage, un Test de rencontre)
 * traverse la transition INTACTE, avec son curseur. Une séquence vidée de toutes ses étapes sort de
 * la pile ; une séquence MIXTE garde son curseur POSÉ SUR LA MÊME ÉTAPE — il est décalé du nombre
 * d'étapes purgées qui le précédaient, puis borné au reste (sinon les étapes appendues DERRIÈRE la
 * carte seraient sautées : curseur en fin = état BILAN, la modale de reprise ne les jouerait jamais).
 */
export function dropSceneEntrySteps(get: Get, set: Set): void {
  const stack = get().suspendedCascades;
  const isSceneEntry = (s: CascadeStep) => s.reveal?.kind === 'sceneEntry';
  if (!stack.some((c) => c.participants.some(isSceneEntry))) return;
  const next = stack
    .map((c) => {
      if (!c.participants.some(isSceneEntry)) return c;
      const participants = c.participants.filter((s) => !isSceneEntry(s));
      const dropped = c.participants.filter((s, i) => i < c.cursor && isSceneEntry(s)).length;
      return { ...c, participants, cursor: Math.min(Math.max(c.cursor - dropped, 0), participants.length) };
    })
    .filter((c) => c.participants.length > 0);
  set({ suspendedCascades: next });
}

/**
 * LE PORTEUR d'une étape — l'id qui route sa possession, sa surface et son affordance d'influence.
 * Une étape sans acteur nommé est portée par le MONDE (`WORLD_STEP_OWNER`, `worldOwner` posé au mint) :
 * c'est la MÊME convention que `netOwnership.seatInfluences`/`canFixDie`, jamais un cas à part.
 */
function porteurDe(st: CascadeStep): string {
  return st.actorId ?? WORLD_STEP_OWNER;
}

/**
 * LES PORTEURS d'une étape — le porteur de l'étape, ou CEUX DE SES RANGÉES quand elle en a (une bande
 * met N porteurs en jeu, et chaque siège tient la sienne). EXPORTÉ (#1479) pour la porte des jets
 * (`rollSeam.surfaceDesEtapes`) : la surface d'une séquence se dérive des MÊMES ids que sa possession.
 */
export function porteursDeLEtape(st: CascadeStep): string[] {
  return st.participants ? st.participants.map((p) => p.id) : [porteurDe(st)];
}

/**
 * L'étape est-elle un TIRAGE (table ou jet) qu'AUCUN siège ne joue ? Le seul cas où le socle tire à la
 * place d'une fenêtre (cf. `poserLeCurseur` ci-dessous) — et il se juge au MÊME appel pour TOUT
 * porteur : `rollSeam.surfaceOf(porteurDe(st))`. Un héros conduit par l'IA, un ennemi sans siège MJ,
 * un acteur inconnu ne tiennent aucune fenêtre ; le monde, lui, est toujours tenu par un siège humain
 * (`netOwnership.worldSeat`) — seule la cadence déférée à un automate l'en dessaisit.
 *
 * TABLE **ET** JET (#1479) : une étape MONO qu'aucun humain ne tient bloquait la séquence net — aucune
 * fenêtre ne la lançait, `stepReady` la refusait, `cascadeNext` restait en no-op définitif. Les BANDES
 * n'en sont pas (leurs rangées naissent déjà témoins-roulées, `rollSeam.surfaceRow`), les CHOIX non plus
 * (une décision ne se tire pas : `runCascadeImmediate` exige un défaut authoré).
 */
function tirageSansSiege(get: Get, st: CascadeStep | undefined): boolean {
  if (!st) return false;
  const interaction = stepInteraction(st);
  if (interaction !== 'table' && interaction !== 'de' && interaction !== 'jet') return false;
  if (interaction === 'jet' && (st.result || st.target == null)) return false;
  return !surfaceOf(get, porteurDe(st));
}

/**
 * HÔTE ORPHELIN AU CURSEUR (#1852) — le curseur n'arrive JAMAIS sur une étape-jet qui n'a pas de quoi
 * rendre un corps : sa fenêtre serait vide, donc invalidable, et la cadence Rapide/Auto la
 * re-conduirait sans fin (`combatAuto.JET_AUTO`).
 *
 * DEV : la violation THROW (le producteur fautif se voit au premier passage) ; en PROD elle se
 * journalise et l'étape est FRANCHIE — une partie en cours ne se fige pas sur une fenêtre morte.
 * Prédicat PUR et TOTAL (les neuf `HostJet`) : `stateFields.hoteOrphelin`.
 *
 * Joué à l'ARRIVÉE du curseur seulement (ouverture, avancée, reprise, et l'append qui tire le curseur
 * hors du bilan) : le curseur POSÉ sur l'étape dont la fenêtre vient de rendre sa donnée n'est pas un
 * orphelin — il la quittera au geste suivant (`advanceCascade`), et un append fait pendant son
 * application (Critique, Maladresse) ne le déplace pas.
 */
function franchirLesHotesOrphelins(get: Get, p: PendingCascade): PendingCascade {
  let cursor = p.cursor;
  const s = get();
  while (cursor < p.participants.length && hoteOrphelin(s, p.participants[cursor])) {
    const st = p.participants[cursor];
    const cause = `[cascade] hôte orphelin « ${st.id} » (jet:'${st.jet}') : sa donnée manque `
      + `(slot \`${String(PENDING_BY_JET[st.jet!])}\`, acteurs, donnée d'étape) — la fenêtre n'aurait aucun corps à rendre.`;
    // DEUX messages, chacun vrai : en PROD l'étape est FRANCHIE (la partie ne se fige pas sur une
    // fenêtre morte) ; en DEV rien n'est franchi — on JETTE, au premier passage du producteur fautif.
    console.error(`${cause} Étape FRANCHIE.`); // le seam tourne DANS un `set` (`pushStep`) : la ligne va au journal technique, jamais au `battle.log` (ré-entrance)
    if (import.meta.env?.DEV) throw new Error(cause);
    cursor++;
  }
  return cursor === p.cursor ? p : { ...p, cursor };
}

/**
 * LE CURSEUR SE POSE SUR UNE ÉTAPE — seam UNIQUE du pilote INTERACTIF (#1426), joué PARTOUT où le
 * curseur atteint une étape : ouverture (`startCascade`), APPEND (`pushStep`), avancée
 * (`advanceCascade`) et REPRISE d'une séquence parquée (`resumeSuspendedCascade`).
 *
 * UNE règle, quel que soit le PORTEUR de l'étape — un héros, un ennemi, le MONDE (`worldOwner`) : une
 * table se JOUE dans la fenêtre. Sa rangée s'affiche, « Lancer » est servi au siège qui la possède
 * (`modalArbiter` entrée `cascade` → `ActiveModal`), et l'option « Dés fixés » n'y ajoute que la POSE
 * du dé (`forcedDieRow.stepForcedDie`, gate `canFixDie`). Un siège possesseur DISTANT tient la
 * fenêtre : l'hôte attend, il ne tire pas à sa place.
 *
 * EXCEPTION UNIQUE, et elle n'est pas une exception au porteur : AUCUN siège humain ne tient l'étape
 * (`tirageSansSiege`, donc `rollSeam.surfaceOf`) — cadence déférée à un automate, héros conduit par l'IA,
 * ennemi sans siège MJ, porteur introuvable. Le socle tire l'étape ICI — TABLE comme JET (#1479) — et
 * `advanceCascade` la FRANCHIT dans le même geste.
 *
 * Résolveur et composition sont ceux de la modale (`liveTableDecl` + `rollTableStep` +
 * `tableStepResolved`, calque `runCascadeImmediate` ; `roulerDeEtape` pour un jet) : le dé est consommé
 * au RANG de l'étape, jamais au build, et l'étape porte son résultat — le bilan le montre.
 */
function poserLeCurseur(get: Get, p: PendingCascade, arrivee = true): PendingCascade {
  const pose = arrivee ? franchirLesHotesOrphelins(get, p) : p;
  const st = pose.participants[pose.cursor];
  if (!tirageSansSiege(get, st)) return pose;
  let resolue: CascadeStep;
  const interaction = stepInteraction(st);
  if (interaction === 'table') {
    const decl = liveTableDecl(get(), st);
    resolue = tableStepResolved(st, decl, rollTableStep(decl, battleRng(), { get }), get);
  } else if (interaction === 'de') {
    const de = liveDeDecl(get(), st);
    resolue = deStepResolved(st, de, roulerDe(de, specDeEtape(de), battleRng()));
  } else {
    resolue = { ...st, result: roulerDeEtape(st.target!, battleRng(), st.evaluation) };
  }
  return { ...pose, participants: pose.participants.map((x, k) => (k === pose.cursor ? resolue : x)) };
}

/**
 * PORTE PUBLIQUE du curseur (#1426) — poser le curseur d'une cascade OUVERTE sur l'étape `i`. Tout
 * site qui reprend la main sur une cascade hôte (fold d'incantation, re-ciblage du lanceur d'un Test)
 * passe par ICI : un `set({ pendingCascade: { …casc, cursor: i } })` écrit à la main court-circuite le
 * pilote, et une table qu'aucun siège ne joue reste alors non tirée — `cascadeNext` en no-op définitif.
 */
export function poserCurseurCascade(get: Get, set: Set, casc: PendingCascade, i: number): void {
  set({ pendingCascade: curseurPose(get, casc, i) });
}

/**
 * LA MÊME PORTE, rendue en VALEUR (#1426) — pour un site qui doit publier `pendingCascade` DANS LE
 * MÊME `set` qu'un autre champ : `store.testSetActor` change le porteur du Test ET celui de l'étape,
 * et deux `set` successifs publient entre eux un état où les deux porteurs divergent (un abonné rend
 * cet inter-état). Une seule implémentation — `poserCurseurCascade` délègue ici.
 */
export function curseurPose(get: Get, casc: PendingCascade, i: number): PendingCascade {
  return poserLeCurseur(get, { ...casc, cursor: i });
}

/**
 * Pilote INTERACTIF : valide l'étape courante (conséquence + insertions), avance le curseur. À la
 * fin, ferme le pending et RENVOIE la cascade finalisée (pour la suite propre au `purpose` — reprise
 * de voyage, bilan… — gérée par le store). Renvoie `null` tant qu'on avance encore. L'étape courante
 * influençable doit être lancée (sinon no-op : la modale force d'abord le jet).
 */
export function advanceCascade(get: Get, set: Set): PendingCascade | null {
  // BOUCLE, jamais récursion : une séquence enchaîne autant d'étapes résolues d'office que sa donnée
  // en déclare (cadence déférée, périls d'auteur, journée de voyage) — une récursion y épuise la pile
  // (`RangeError`) et laisse la cascade OUVERTE sur son curseur, sans dénouement.
  for (;;) {
    const rendu = avanceUnPas(get, set);
    if (rendu !== ENCORE) return rendu;
  }
}

/** Sentinelle « le socle a franchi l'étape lui-même, il reste du chemin » — distincte de `null` (on
 *  rend la main à la fenêtre) et d'une cascade finalisée. */
const ENCORE = Symbol('cascade.encore');

function avanceUnPas(get: Get, set: Set): PendingCascade | null | typeof ENCORE {
  const p = get().pendingCascade;
  if (!p) return null;
  const cur = p.participants[p.cursor];
  if (cur && !stepReady(cur)) return null; // jet non lancé / choix non tranché → la modale force d'abord
  let steps = p.participants;
  let suspended = false;
  // Le COMPTEUR d'identité (#1508) voyage avec le tableau : `commitStep` le rend augmenté de ce que
  // l'applier a poussé, et TOUTE écriture du slot le repose — sinon la prochaine poussée re-servirait
  // un id déjà porté.
  let seq = seqDe(p);
  // La conséquence d'une étape vit sur l'ÉTAPE (`outcome`, affichée dans la pile) — pas dupliquée
  // dans `log` (réservé aux notes hors-jet : entretien). Évite le doublon « X contracte… » écran/journal.
  // PARITÉ DE TRACE (#1479) : un dé POSÉ D'OFFICE par le curseur (`poserLeCurseur`, aucun siège ne
  // tient l'étape) n'a été montré par AUCUNE fenêtre — il reçoit donc sa ligne de journal, comme celui
  // du pilote immédiat (`runCascadeImmediate`). Le fait se RE-DÉRIVE du prédicat qui a fait poser le dé
  // (`surfaceOf(porteurDe)`), jamais d'un champ d'étape : rien n'entre dans la sauvegarde.
  // Un DÉ NU (#1508) posé d'office se lit à la MÊME condition, mais pas à la même interaction : une
  // fois tiré il n'est plus `'de'` (son `result` est là), donc c'est le PORTEUR DE DÉ qui le dit.
  const dOffice = !!cur && (stepInteraction(cur) === 'jet' || !!cur.de?.result) && !surfaceOf(get, porteurDe(cur));
  if (cur) { const r = commitStep(get, set, steps, p.cursor, { seq, purpose: p.purpose, liveMerge: true, unwitnessed: dOffice }); steps = r.steps; suspended = r.suspended; seq = r.seq; } // liveMerge : préserve les appends d'une conséquence foldée
  const next = p.cursor + 1;
  // SUSPENDUE en plein vol (`startCombat`/`transitionTo` déclenché par l'applier de l'étape courante) :
  // le slot ne nous appartient plus — jamais de ressuscite ici.
  //  - étapes RESTANTES (curseur avant la fin) : met à jour l'entrée de pile (étapes/curseur À JOUR),
  //    la séquence reprendra où elle en est (couture de reprise) ;
  //  - suspendue à la DERNIÈRE étape : plus rien à préserver — la séquence est FINIE. On la RETIRE de
  //    la pile et on rend la cascade FINALISÉE, pour que l'appelant joue son dénouement (`purpose`).
  //    Sans ça, la couture de reprise la ressusciterait EN BILAN par-dessus le contexte qui a pris le
  //    slot, et le dénouement ne serait jamais joué.
  if (suspended) {
    if (next >= steps.length) { reconcileSuspended(get, set, p, null); return { ...p, participants: steps, seq, log: p.log }; }
    reconcileSuspended(get, set, p, { participants: steps, seq, cursor: Math.min(next, steps.length) });
    return null;
  }
  if (next >= steps.length) {
    set({ pendingCascade: null });
    return { ...p, participants: steps, seq, log: p.log };
  }
  const suite = poserLeCurseur(get, { ...p, participants: steps, seq, cursor: next });
  set({ pendingCascade: suite });
  // Tirage résolu D'OFFICE par le seam — aucun siège humain ne le tient (`tirageSansSiege` : cadence
  // déférée, héros conduit par l'IA, ennemi sans siège MJ, porteur introuvable), donc aucune fenêtre ne
  // le joue : la séquence le FRANCHIT au même geste, comme le « Suivant » du joueur l'aurait fait.
  if (suite.participants[next] !== steps[next]) return ENCORE;
  return null;
}

/** « Tout lancer » : RÉSOUT d'office les étapes restantes (RNG, sans influence) — on ne peut pas
 *  « dé-dormir », les conséquences subies s'appliquent quand même — puis place le curseur EN FIN
 *  (`cursor === participants.length`) = état BILAN. La modale RESTE ouverte pour montrer TOUTES les
 *  conséquences ; c'est `finalizeCascade` (« Terminer ») qui ferme et enchaîne la suite — on rend alors
 *  `null`. SEULE exception : la DERNIÈRE étape a SUSPENDU la séquence en plein vol (`startCombat`/
 *  `transitionTo` depuis son applier) — aucun BILAN n'est montrable (le slot appartient au nouveau
 *  contexte) et il ne reste AUCUNE étape à préserver : on retire l'entrée de la pile et on rend la
 *  cascade FINALISÉE pour que l'appelant joue son dénouement (même distinction qu'`advanceCascade`). */
export function resolveRemainingCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  let steps = p.participants;
  let log = p.log;
  let seq = seqDe(p);
  for (let i = p.cursor; i < steps.length; i++) {
    const st = steps[i];
    if (stepInteraction(st) === 'jet' && !st.result) {
      const result = roulerDeEtape(st.target!, battleRng(), st.evaluation);
      steps = steps.map((x, k) => (k === i ? { ...x, result } : x));
    }
    // SÉQUENTIELS, jamais exclusifs : une étape porte une table ET un choix (la sévérité d'un Critique
    // se tire DANS la fenêtre de Déviation) — `stepInteraction` est une chaîne de PRIORITÉ, donc la
    // même étape se présente en `'table'` puis, une fois le dé tombé, en `'choix'`. Un `else if` la
    // laisserait avec son choix non tranché.
    if (stepInteraction(steps[i]) === 'table') {
      // TIRAGE SUR TABLE sans influence (« Tout lancer ») : mêmes résolveur ET composition de
      // déclaration que la modale (`liveTableDecl` — modificateur vivant au moment du jet).
      const table = liveTableDecl(get(), steps[i]);
      const rolled = rollTableStep(table, battleRng(), { get });
      steps = steps.map((x, k) => (k === i ? tableStepResolved(x, table, rolled, get) : x));
    }
    // DÉ NU sans influence (#1508) : même résolveur ET même composition de déclaration que la modale.
    if (stepInteraction(steps[i]) === 'de') {
      const de = liveDeDecl(get(), steps[i]);
      steps = steps.map((x, k) => (k === i ? deStepResolved(x, de, roulerDe(de, specDeEtape(de), battleRng())) : x));
    }
    if (stepInteraction(steps[i]) === 'batch') {
      steps = steps.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(steps[i]) } : x));
    }
    if (stepInteraction(steps[i]) === 'choix' && steps[i].chosen == null) {
      // « Tout résoudre » ne TRANCHE pas un CHOIX du joueur (dévier/subir, piéger…) : on s'arrête dessus.
      set({ pendingCascade: { ...p, participants: steps, seq, cursor: i, log } });
      return null;
    } // affichage : rien à résoudre avant la conséquence
    const r = commitStep(get, set, steps, i, { seq, purpose: p.purpose });
    steps = r.steps;
    seq = r.seq;
    log = [...log, ...r.journal];
    // SUSPENDUE en plein vol (l'applier a déclenché `startCombat`/`transitionTo`) : le slot ne nous
    // appartient plus — jamais de ressuscite/écrase du slot actif.
    if (r.suspended) {
      if (i + 1 >= steps.length) { reconcileSuspended(get, set, p, null); return { ...p, participants: steps, seq, log }; }
      reconcileSuspended(get, set, p, { participants: steps, seq, cursor: Math.min(i + 1, steps.length), log });
      return null;
    }
  }
  set({ pendingCascade: { ...p, participants: steps, seq, cursor: steps.length, log } });
  return null;
}

/** « Terminer » du BILAN (curseur en fin) : ferme la cascade et RENVOIE la cascade finalisée (suite
 *  propre au `purpose` — reprise de voyage… — gérée par le store). */
export function finalizeCascade(get: Get, set: Set): PendingCascade | null {
  const p = get().pendingCascade;
  if (!p) return null;
  set({ pendingCascade: null });
  return p;
}

/**
 * Pilote IMMÉDIAT (sans modale) : lance chaque étape (RNG) et applique sa conséquence dans l'ordre,
 * insertions comprises. Pour les repos de plusieurs jours, la reprise automatique et la triche de
 * recette. Renvoie les étapes RÉSOLUES (pour un éventuel bilan en lecture seule) — PEUT être un
 * PRÉFIXE du tableau d'entrée (combat ouvert en plein vol, OU choix sans défaut authoré, cf. ci-dessous) :
 * l'appelant DOIT vérifier `get().battle` / `get().pendingCascade` avant d'enchaîner une finalisation.
 *
 * `ctx` (optionnel) : titre/`purpose` du fragment — SEULEMENT nécessaire pour un appelant qui résout
 * un tableau DE PLUSIEURS étapes dont l'une peut ouvrir un combat en plein vol (`startCombat`, ex. la
 * cascade auto-pilotée d'un jour de voyage routine) : si le combat s'ouvre AVANT la fin du tableau, les
 * étapes RESTANTES (non encore committées) sont poussées en pile (`suspendedCascades`) — jamais perdues
 * ni résolues À L'AVEUGLE pendant que le combat tourne. Sans `ctx` (mono-étape, l'immense majorité des
 * appels), rien à préserver : la boucle s'arrête simplement (comportement historique).
 *
 * CHOIX sans `defaultChoice` authoré : jamais tranché en silence (`options[0]`) — la cascade s'arrête
 * PENDANTE, surfacée via `pendingCascade` (patron `resolveRemainingCascade`, #351).
 *
 * `ctx.rowSurface` : l'appelant DÉCLARE que les rangées de ses BANDES se montrent ailleurs qu'au
 * journal (procès-verbal structuré de traversée) — le socle n'en trace alors pas les dés (#1291). Les
 * étapes MONO du même tableau gardent leur ligne : elles n'ont pas de rangée au PV.
 */
export function runCascadeImmediate(get: Get, set: Set, steps: CascadeStep[], ctx?: { title: string; purpose: PendingCascade['purpose']; log?: string[]; rowSurface?: RowSurface }): CascadeStep[] {
  let cur = steps;
  let seq = steps.length; // ce pilote résout un tableau à LUI : son compteur part de sa longueur

  for (let i = 0; i < cur.length; i++) {
    const st = cur[i];
    // Jet POSÉ PAR CE PILOTE : aucune fenêtre ne s'ouvrira dessus — le goulot (`commitStep`) en dérive
    // sa ligne de dé. Une étape qui ARRIVE déjà résolue (jet montré ailleurs) n'en reçoit pas.
    let unwitnessed = false;
    if (stepInteraction(st) === 'jet' && !st.result) {
      const result = roulerDeEtape(st.target!, battleRng(), st.evaluation);
      cur = cur.map((x, k) => (k === i ? { ...x, result } : x));
      unwitnessed = true;
    }
    // SÉQUENTIELS, jamais exclusifs (même raison qu'à `resolveRemainingCascade`) : table PUIS choix
    // sur la MÊME étape, sinon la table résolue partirait au commit avec son choix non tranché.
    if (stepInteraction(cur[i]) === 'table') {
      const table = liveTableDecl(get(), cur[i]); // même composition de déclaration que la modale
      const rolled = rollTableStep(table, battleRng(), { get });
      cur = cur.map((x, k) => (k === i ? tableStepResolved(x, table, rolled, get) : x));
    }
    // DÉ NU posé PAR CE PILOTE (#1508) : aucune fenêtre ne s'ouvrira dessus — comme pour un jet, le
    // goulot (`commitStep`) en dérive sa ligne de dé.
    if (stepInteraction(cur[i]) === 'de') {
      const de = liveDeDecl(get(), cur[i]);
      cur = cur.map((x, k) => (k === i ? deStepResolved(x, de, roulerDe(de, specDeEtape(de), battleRng())) : x));
      unwitnessed = true;
    }
    if (stepInteraction(cur[i]) === 'batch') {
      cur = cur.map((x, k) => (k === i ? { ...x, participants: rollBatchParticipants(cur[i], true) } : x)); // résolue d'office → étampe de trace (#1281)
    }
    if (stepInteraction(cur[i]) === 'choix' && cur[i].chosen == null) {
      const choix = cur[i];
      if (choix.defaultChoice == null) {
        // Aucun défaut AUTEURISÉ (patron `resolveRemainingCascade` l.317-320) : on ne tranche PAS en
        // silence — la cascade s'arrête PENDANTE, surfacée (`pendingCascade`) pour que l'appelant/la
        // modale la reprenne (devtools `advanceRiverDay`/`skipToArrival`, cadence commandée, tout
        // futur appelant immédiat).
        set({
          pendingCascade: { title: ctx?.title ?? choix.label ?? 'Choix', purpose: ctx?.purpose ?? 'test', participants: cur, seq, cursor: i, log: ctx?.log ?? [] },
        });
        return cur;
      }
      cur = cur.map((x, k) => (k === i ? { ...x, chosen: choix.defaultChoice! } : x));
    } // affichage / quantité : rien à résoudre avant la conséquence — une étape de quantité naît avec
      // son nombre d'ouverture (`quantityStep`), qu'aucun pilote n'a donc à trancher à l'aveugle.
    const r = commitStep(get, set, cur, i, { seq, purpose: ctx?.purpose, unwitnessed, rowSurface: ctx?.rowSurface });
    cur = r.steps;
    seq = r.seq;
    // Un combat s'est ouvert PENDANT cette résolution immédiate (l'applier a appelé `startCombat` —
    // no-op de suspension ici puisque CE tableau n'était PAS dans le slot actif) : le reste du tableau
    // ne doit PAS continuer à se résoudre en silence pendant que le combat tourne — on le préserve.
    if (get().battle && i + 1 < cur.length) {
      if (ctx) set({ suspendedCascades: [...get().suspendedCascades, { title: ctx.title, purpose: ctx.purpose, participants: cur.slice(i + 1), seq, cursor: 0, log: ctx.log ?? [] }] });
      return cur;
    }
  }
  return cur;
}

/** Un groupe de conséquences déjà calculées (lignes prêtes à afficher) — brique d'entrée pour
 *  rapatrier les conséquences d'un jet INLINE dans la modale. */
export interface ConsequenceGroup {
  kind: string;
  label: string;
  lines: string[];
  icon?: string;
  actorId?: string;
}

/** Construit une SÉQUENCE d'étapes d'AFFICHAGE à partir de groupes de conséquences (imparfaite/colère,
 *  critique, Assommante…) — pour les montrer INLINE dans la séquence. Les groupes
 *  vides sont ignorés (pas de bruit). Les mutations restent appliquées par le moteur ; ces étapes ne
 *  font qu'AFFICHER (applier muet → `commitStep` préserve l'`outcome` pré-posé). */
export function buildConsequenceSteps(groups: ConsequenceGroup[]): CascadeStep[] {
  return groups
    .filter((g) => g.lines.length > 0)
    .map((g, i): CascadeStep => ({
      id: `cons-${g.kind}-${i}`,
      kind: g.kind,
      actorId: g.actorId,
      icon: g.icon,
      label: dataLabel(g.label),
      outcome: toRecapLines(g.lines),
    }));
}
