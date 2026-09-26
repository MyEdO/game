/**
 * EXÉCUTEUR DE FLOW cadence-aware « aucun jet de héros en silence » — résout un nœud `test` d'un Flow
 * selon le CONTEXTE (scène / combat × cadence) et reprend la CONTINUATION `after` (le reste du `seq`).
 *
 * Module FEUILLE (chargé par effet de bord depuis combatFlow, qui le `export *`) : il n'importe RIEN
 * de combatFlow. Il REJOINT la voie unifiée existante (`pushCombatStep` → cascade `purpose:'combat'`
 * influençable + `registerCascadeApplier` + `runPureFlowLines`) au lieu d'inventer un système.
 *
 * Trois entrées, UN résolveur :
 *  - `resolveFlowTest(ctx, node, after)` — point de décision unique sur un nœud `test` :
 *    · scène → `openSkillTest` (modale `pendingTest`, source unique) ;
 *    · combat + héros MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE (suspend) ;
 *    · combat sinon (ennemi / cadence auto) → jet INLINE (`rollTest`) + branche + `after`, lignes
 *      poussées dans la file de journal différée (`pendingLogQueue`, déversée au rendu).
 *  - `runCombatFlow(ctx, flow)` — exécuteur à PILE d'un Flow EN COMBAT (calque `runFlow` côté scène) :
 *    porte la continuation `after` (sur un `test`, `after = reste de la pile`).
 *  - `routeTriggeredTest` — l'entrée des triggers portant un nœud `test` (Mâchoires `onGainCondition`,
 *    Venin/Hurlement/2 enchants `onHit`) : délègue à `runCombatFlow` (test top-level = IDENTIQUE au Lot 0 ;
 *    test enfoui = suspendu avec `after`).
 *
 * Les branches `onSuccess`/`onFail` + la continuation `after` voyagent dans le `meta` (sérialisable,
 * coop) ; l'applier `triggeredTest` les rejoue (branche PUIS `after`) — l'`ExecCtx` est RECONSTRUIT
 * depuis `get()`/`hero`, jamais capturé (zéro closure dans le pending).
 */
import { rollTest, resolveOpposed, opposedBranchSuccess, type TestResult } from '../../engine/tests';
import { combatTestPenalty } from '../../engine/conditions';
import { testValue, rawCombatTestBase, skillBaseValue } from '../../engine/skills';
import { type OpsCtx, nomDeSource } from '../../engine/ops';
import { traceLineOf, testTraceLabel } from '../../engine/traceLine';
import { CHAR_LABELS } from '../../engine/types';
import type { CharKey, Combatant, Difficulty, EffectSource } from '../../engine/types';
import { refLabel, derivedStake } from '../../data';
import { type Flow, type FlowTest, type ConditionCtx, evalCondition, flowHasImpureOp, flowHasOpADe, flowHasTest, poserEnjeu, resolveTestDifficulty, EMPTY_FLOW } from '../flow';
import { condCtx } from '../bourseFlow';
import { buildActorView, combatConditionCtx, flowTestGated } from './flowEval';
import type { Get, Set as SetFn } from '../flowTypes';
import type { FreeAttackFreeze, BladeTrapFreeze, BatchParticipant, OpposedFreeze, PendingTest } from '../pendings';
import { battleRng } from '../battleRng';
import { runPureFlowLines, runFlow, pushCombatStep, openSkillTest, applyLeafOps, drainPendingLog,
  differerLaSuite, jouerFlowEntier, comptePasDifferes, OPS_DIFFEREES, type Applique } from '../combatEffects';
import { journaliser } from '../combatLog';
import { registerCascadeApplier } from '../cascade';
import { freeCons, rollLine, rollStep, surfaceOf, bandStep, monoStep, choiceStep, pushChoice, pousseSi, opposedAttackerLabel, type BuiltCascadeStep } from '../rollSeam';
import { recoveryGeometry, effectSourcesOf, fireOwnTestFailed } from '../triggeredEffects';
import { emitCombatEvent } from '../combatEvents';
import { inBattleId, actorIn, coqueParId } from '../combatants';
import { campSpend, spendableAdvantage } from './advantagePool';
import { dataLabel } from '../../data';
import { t } from '../../i18n';

/** Reflète la mutation EN PLACE d'un combattant (États retirés) dans les références party/battle pour
 *  un re-rendu React (clone des tableaux) — mirroir de `syncCombatant` des appliers d'upkeep. */
function syncCombatant(get: Get, set: SetFn): void {
  set({ party: [...get().party] });
  if (get().battle) set({ battle: { ...get().battle!, combatants: [...get().battle!.combatants] } });
}

/** Pousse des lignes de journal d'un effet inline dans la file différée (déversée au rendu) — un hook
 *  profond fire AVANT le `set(battle.log)` final → on passe par la file (`drainPendingLog`, §5). */
function queueLines(get: Get, set: SetFn, lines: string[], cid: string): void {
  if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid }))] });
}

/**
 * Environnement d'exécution d'un Flow — état (get/set) + MODE (scène vs combat) et, en combat, les
 * combattants en jeu (`target`/`caster`) + le contexte d'incantation (`opsCtx` : sl/durée/location…).
 * Reconstruit à chaque besoin (jamais sérialisé) : porte uniquement des références vivantes + le mode.
 */
export interface ExecCtx {
  mode: 'scene' | 'combat';
  get: Get;
  set: SetFn;
  /** Cible du sous-Flow (combat) — porteur par défaut des feuilles `on:'target'` et référent du Test. */
  target?: Combatant;
  /** Lanceur/porteur (combat) — référent des feuilles `on:'caster'` et des formules « (X) ». */
  caster?: Combatant;
  /** Libellé de source (journal / ActiveEffect). */
  label: string;
  /** Contexte d'incantation des ops (combat) : sl/durée/location/woundsDealt… (cf. `OpsCtx`). */
  opsCtx?: OpsCtx;
  /** Jet d'ATTAQUANT DÉJÀ FIGÉ pour les nœuds `test` OPPOSÉS de ce Flow : le producteur l'a jeté
   *  lui-même (`rollFrozenOpposedAttacker`) parce qu'UNE opposition vaut pour N défenseurs — l'embuscade
   *  oppose le MÊME Test de Discrétion à tous les guetteurs (LDB 13 l.77). Absent ⇒ `resolveFlowTest`
   *  jette l'attaquant pour ce défenseur-là (comportement des oppositions à un seul défenseur). */
  opposedFreeze?: TestResult;
  /** Contexte d'une ATTAQUE GRATUITE de talent (op `grantFreeAttack`) : la CIBLE de la frappe (un TIERS —
   *  le chargeur pour Frappe réactive `onCharged`, la victime touchée pour Assaut féroce `onHit` — distinct
   *  de `target`/`caster` qui sont le porteur), + le plafond /Round (`cap` = niveau du talent) et la `key`
   *  d'imputation (`freeAttacksThisTurn`). Threadé par `resolveFreeAttacks` ; le hook `freeAttack`
   *  (couche combatFlow) l'emploie quand `runCombatFlow` rencontre un `do` portant `grantFreeAttack`. Tout
   *  est sérialisable (ids/nombres) → mirroir dans `meta.freeAttack` pour la voie cascade (héros manuel). */
  freeAttack?: FreeAttackFreeze;
  /** Contexte de la CONSÉQUENCE d'un Test opposé de Piège-lame GAGNÉ (op `breakBlade`) : l'attaquant désarmé,
   *  la lame visée, le bonus de DR de la défense et le DR figé de l'attaquant — le hook `bladeTrap` (couche
   *  combatFlow) l'emploie quand `runCombatFlow` rencontre un `do` portant `breakBlade`. Tout est sérialisable
   *  (ids/nombres) → mirroir dans `meta.bladeTrap` pour la voie cascade (héros manuel). */
  bladeTrap?: BladeTrapFreeze;
}

/** HOOK de résolution d'une ATTAQUE GRATUITE (`grantFreeAttack`, op IMPURE) — injecté par le store
 *  (`setFreeAttackHook` dans `createCombatSlice`), pointe sur `applyTalentFreeAttack` (combatFlow). Appelé
 *  par `runCombatFlow` lorsqu'un `do`/`ops` porte un `grantFreeAttack` : il ouvre la VRAIE frappe (motif
 *  aiAvailableFreeAttack — instantanée, Action préservée). Inversion de dépendance (cette brique reste sans import
 *  de combatFlow → pas de cycle). Absent (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`).
 *  REND sa SUSPENSION (#1852) : une frappe qui ouvre une fenêtre arrête le dispatch des frappes suivantes
 *  — une attaque gratuite est un Test d'attaque COMPLET (LDB 85 l.41-43). */
type FreeAttackHook = (
  get: Get, set: SetFn, actor: Combatant, op: Extract<import('../../engine/ops').GameOp, { op: 'grantFreeAttack' }>,
  fa: FreeAttackFreeze,
) => boolean;
let freeAttackHook: FreeAttackHook | undefined;
export function setFreeAttackHook(fn: FreeAttackHook): void { freeAttackHook = fn; }

/** HOOK de la branche d'ÉCHEC du Test de Calme d'interruption de Focalisation (op `interruptFocus`, IMPURE)
 *  — injecté par le store (`setFocusInterruptHook` dans `createCombatSlice`), pointe sur
 *  `applyFocusInterruption` (combatFlow). Appelé par `runCombatFlow` lorsqu'un `do`/`ops` porte un
 *  `interruptFocus` : la cible perd ses DR focalisés (couverts par son composant) + subit une Imparfaite
 *  Mineure (LDB 46 l.144). Inversion de dépendance (cette brique reste sans import de combatFlow → pas de
 *  cycle). Absent (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`). */
type FocusInterruptHook = (get: Get, set: SetFn, focuser: Combatant) => void;
let focusInterruptHook: FocusInterruptHook | undefined;
export function setFocusInterruptHook(fn: FocusInterruptHook): void { focusInterruptHook = fn; }

/** HOOK de la branche de VICTOIRE d'un Test opposé de Piège-lame (op `breakBlade`, IMPURE) — injecté par le
 *  store (`setBladeTrapHook` dans `createCombatSlice`), pointe sur `applyBladeTrap` (combatFlow). Appelé par
 *  `runCombatFlow` lorsqu'un `do`/`ops` porte un `breakBlade` : l'attaquant ciblé (`bt.attackerId`) est
 *  désarmé de la lame `bt.weaponUid` ; marge nette `(DR défenseur + bt.defSL) − bt.attackerSL` ≥ 6 → lame
 *  BRISÉE sauf Incassable (LDB 62 l.280). Le DR du défenseur vient du Test résolu (`defSL` ci-dessous = celui
 *  du jet). Inversion de dépendance (cette brique reste sans import de combatFlow → pas de cycle). Absent
 *  (hors store) ⇒ no-op (l'op reste inerte, comme dans `applyOps`). */
type BladeTrapHook = (get: Get, set: SetFn, defender: Combatant, bt: BladeTrapFreeze, defenderSL: number) => void;
let bladeTrapHook: BladeTrapHook | undefined;
export function setBladeTrapHook(fn: BladeTrapHook): void { bladeTrapHook = fn; }

/**
 * SOURCE UNIQUE du `ConditionCtx` d'un nœud `if` : scène → `condCtx(get)` (drapeaux/horloge/
 * groupe/bourse) ; combat → vues des acteurs (`target`/`caster`) + sl/location/woundsDealt/attackKind
 * du contexte d'incantation. Utilisée par `runCombatFlow` (et, côté scène, identique à `runFlow`).
 */
export function condCtxFor(ctx: ExecCtx): ConditionCtx {
  if (ctx.mode === 'scene') return condCtx(ctx.get);
  const o = ctx.opsCtx ?? {};
  return {
    flags: {}, gameTime: o.now ?? 0, party: ctx.target ? [ctx.target] : [], sl: o.sl,
    location: o.location, woundsDealt: o.woundsDealt, engagedAdvantageGap: o.engagedAdvantageGap, attackKind: o.attackKind, startleCause: o.startleCause,
    foeInLoS: o.foeInLoS, hiddenFromFoes: o.hiddenFromFoes, engaged: o.engaged, nearestFoeDist: o.nearestFoeDist,
    target: buildActorView(ctx.target), caster: buildActorView(ctx.caster),
  };
}

/** Conséquence PARTAGÉE des deux branches (héros cascade ⇄ ennemi/auto inline) : exécute la branche
 *  `onSuccess`/`onFail` sur `c` (référent = lui-même), `ctx.sl = t.sl` alimentant les échelles `valuePerSL`
 *  (« chaque DR supprime un État Sonné supplémentaire »). Renvoie le journal de la BRANCHE (string[] tissé
 *  au bon canal : return cascade `{ journal }` / file inline).
 *  - Branche PURE (Mâchoires/Venin : feuilles `do`/`if`) → `runPureFlowLines` (string[] rendu inline).
 *  - Branche IMPURE (op adossée à un hook : `grantFreeAttack` → frappe gratuite, `interruptFocus` →
 *    interruption de Focalisation, `breakBlade` → désarmement/bris de Piège-lame) → `runCombatFlow` (le
 *    do-loop y résout les hooks injectés), qui EMPILENT leur propre conséquence (frappe / Imparfaite / étape
 *    d'affichage « lame brisée ») → return vide. Détectée par `flowHasImpureOp` (≠ « freeAttack présent » :
 *    tout marqueur à hook). Le contexte `exec` (get/set [+ freeAttack/bladeTrap pour cibler le TIERS]) est
 *    requis. La continuation `after` est jouée À PART (`playAfter`), APRÈS les lignes de branche → ordre correct.
 *  - Branche à SECOND JET (nœud `test` enfoui — la Vigilance interposée par l'échec de la Surprise, LDB 13
 *    l.67) → `runCombatFlow` AUSSI : lui seul route un `test` en jet cadence-aware (`resolveFlowTest`, qui
 *    APPEND son étape à la MÊME cascade). `runPureFlowLines` LÈVE sur un tel nœud (garde anti-jet-silencieux) —
 *    l'y envoyer serait une exception en pleine résolution. */
export function applyTriggeredTestBranch(
  c: Combatant, t: Pick<TestResult, 'success' | 'sl'>, branches: { onSuccess: Flow; onFail: Flow },
  exec?: { get: Get; set: SetFn; caster?: Combatant; hull?: Combatant; source?: EffectSource; freeAttack?: ExecCtx['freeAttack']; bladeTrap?: ExecCtx['bladeTrap'] },
): string[] {
  const branch = t.success ? branches.onSuccess : branches.onFail;
  // Référent des Formules (« votre Force Mentale » — Forêt d'épines LDB 48 l.749) : le LANCEUR d'origine
  // (`exec.caster`) quand il est connu et DIFFÈRE de `c` (zone de Sort posée par un tiers), sinon `c`
  // lui-même (Mâchoires/Contrôle de la Frénésie : effet auto-porté, comportement inchangé).
  const caster = exec?.caster ?? c;
  // TROIS raisons de passer par le walker de COMBAT plutôt que par le chemin PUR : une op IMPURE
  // (adossée à un hook), un Test imbriqué (cadence-aware), et — #1508 — une op qui DEMANDE UN DÉ à la
  // porte. Le chemin pur applique par `applyOps` : il tirerait hauteur et Dégâts en silence, alors que
  // le walker passe par `applyLeafOps`, qui les ANNONCE et défère. C'est ici, et nulle part ailleurs,
  // que la branche d'un Test déclenché choisit son chemin : les quatre appelants (bande d'équipage,
  // mono déclenché, traversée de zone, fin de Round) y convergent déjà.
  if (exec && (flowHasImpureOp(branch) || flowHasTest(branch) || flowHasOpADe(branch))) {
    // L'ENTITÉ PORTEUSE (`source`) voyage dans la branche : un SECOND Test qui y est enfoui dérive son
    // enjeu de la même entité que le premier (#1262 V2 L6d) — sans ce relais, la branche perdrait le porteur.
    runCombatFlow({ mode: 'combat', get: exec.get, set: exec.set, target: c, caster, label: 'Effet', opsCtx: { sl: t.sl, ...(exec.source ? { source: exec.source } : {}), ...(exec.hull ? { hull: exec.hull } : {}) }, ...(exec.freeAttack ? { freeAttack: exec.freeAttack } : {}), ...(exec.bladeTrap ? { bladeTrap: exec.bladeTrap } : {}) }, branch);
    return [];
  }
  // L'ENTITÉ PORTEUSE voyage AUSSI par la branche pure : un effet actif y est posé comme partout
  // ailleurs (`condition` récurrente d'une rangée de Colère, `LDB 40 l.75`), et sans son ancrage la
  // pastille du joueur s'afficherait nue — les deux branches relaient le MÊME contexte.
  return runPureFlowLines(c, caster, branch, { rng: battleRng(), caster, sl: t.sl, ...(exec?.source ? { source: exec.source } : {}), ...(exec?.hull ? { hull: exec.hull } : {}) });
}

/** IDENTITÉ d'une étape `triggeredTest` — SOURCE UNIQUE des deux fabriques. La SITUATION entre dans
 *  l'id quand elle diffère de la Compétence lancée : une branche peut APPENDRE à la même cascade un
 *  second Test de la MÊME Compétence sur le MÊME acteur (Surprise → Vigilance, deux Tests de
 *  Perception, LDB 13 l.67), et deux étapes homonymes rendraient la seconde inatteignable
 *  (`cascadeRoll(id)` retrouve la première, déjà résolue). */
function triggeredTestStepId(c: Combatant, label: string | undefined, skillLabel: string): string {
  return `triggeredTest-${c.id}-${label && label !== skillLabel ? `${label}-${skillLabel}` : skillLabel}`;
}

/** Ids du Test au format du MONTEUR CANONIQUE (`RollLineSpec.test`) — un `FlowTest` nomme sa
 *  Caractéristique `characteristic`, le monteur `char` : la traduction se fait ICI, une fois, pour les
 *  quatre producteurs d'étapes de ce module. */
function testIds(ft: FlowTest): { skill?: string; char?: CharKey; spec?: string } {
  return { skill: ft.skill?.id, char: ft.characteristic, spec: ft.skill?.spec };
}

/**
 * ENJEU d'un `FlowTest`, en DEUX ÉTAGES (#1262 V2 L6d, arbitrage user 2026-08-12) :
 *  1. DÉCLARÉ — le producteur a nommé son dataset (`combatStakeRef`…) ou le document a écrit sa
 *     phrase (`AuthoredStake`) : il PRIME, toujours ;
 *  2. DÉRIVÉ du PORTEUR — à défaut, l'entité qui exige le jet (`OpsCtx.source`, taguée par
 *     `withSource` au dispatcher) EST ce qui se joue, et sa fiche Codex est le foyer de règle.
 * Le transport n'invente toujours rien : il LIT l'entité (ids seulement), le libellé étant résolu à
 * l'affichage par `resolveStake`. Sans porteur résoluble, le `FlowTest` ressort inchangé.
 */
export function withDerivedStake(ft: FlowTest, source: EffectSource | undefined): FlowTest {
  return poserEnjeu(ft, derivedStake(source));
}

/** SOURCE UNIQUE du squelette d'étape `triggeredTest` d'un Test SIMPLE (non opposé) : ligne montée par
 *  le MONTEUR CANONIQUE (`rollSeam.rollStep`, canal `combat`/`test`) — `base` = Niveau de Compétence NU
 *  (`LDB 09 l.17`), États et autres composantes en lignes NOMMÉES (`mods`), Difficulté en donnée de ligne.
 *  Partagée par la voie « push » (`resolveFlowTest`, porteur surfacé mid-cascade) ET le collecteur de fin de
 *  Round (`collectHeroRoundEndUpkeep` : récupération d'États) → héros et ennemi récupèrent à l'identique.
 *  `extraMeta` porte le contexte sérialisable d'une réaction (Frappe réactive `freeAttack`, Piège-lame
 *  `bladeTrap`) ; absent pour une récupération. La possession (`actorId`) et la surface de l'étape sont
 *  posées par le mint `monoStep`, qui refuse une cible non calculable (`undefined` : aucun jet fantôme). */
export function simpleTriggeredTestStep(
  c: Combatant, ft: FlowTest, branches: { onSuccess: Flow; onFail: Flow }, after: Flow, difficulty: Difficulty, extraMeta: Record<string, unknown> = {},
): BuiltCascadeStep | undefined {
  const skillLabel = ft.skill ? refLabel('skills', ft.skill) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  return monoStep({
    id: triggeredTestStepId(c, ft.label, skillLabel),
    kind: 'triggeredTest', icon: 'nav/dice', rollLabel: skillLabel,
    actor: c, ligne: { test: testIds(ft), combat: { kind: 'test' } },
    difficulty, label: dataLabel(ft.label, skillLabel),
    // ENJEU du Flow (#1117/#1262 V2 L6d) : déjà résolu par `withDerivedStake` chez l'appelant (déclaré,
    // sinon dérivé du porteur) — cette fabrique le TRANSMET, elle ne devine rien.
    stake: ft.stake,
    meta: { onSuccess: branches.onSuccess, onFail: branches.onFail, after, ...extraMeta },
    // Tag de DONNÉE (`FlowTest.menace` — Venin/lames empoisonnées : 'Poison') → l'étape offre
    // l'auto-succès du talent Résistance (Menace) (LDB 10, verbe `cascadeResist`).
    ...(ft.menace ? { menace: ft.menace } : {}),
  });
}

/** PRÉ-JET FIGÉ de l'ATTAQUANT d'un Test opposé (`FlowTest.opposed`) — SOURCE UNIQUE des deux voies.
 *  L'attaquant subit la MÊME Difficulté que le défenseur (LDB 12 l.166), et son bonus de DR propre
 *  (`attackerBonusSL` — Furtif sur la Discrétion, LDB 85) est baké dans le `sl` figé, si bien que la
 *  voie cascade (`meta.opposed.aT`) et la voie inline ré-opposent à l'identique. Le producteur d'une
 *  opposition à N défenseurs l'appelle LUI-MÊME, une fois, et passe le résultat en `ctx.opposedFreeze`.
 *  Ligne montée par le MONTEUR CANONIQUE (HORS canal combat, comme le défenseur qu'il affronte) : le
 *  jet porte donc sa valeur NUE (`base`), grandeur du départage à DR égal (`LDB 12 l.160`). Le d100 est
 *  jeté sur la cible DÉJÀ composée par le monteur, d'où la Difficulté neutre passée à `rollTest`.
 *  Un `TestResult` n'a PAS de canal de modificateurs NOMMÉS : les composantes que `rollLine` a
 *  produites (États de l'attaquant, passifs) ne franchissent pas ce retour — une rangée d'affichage
 *  reconstruite depuis ce seul jet en réconcilierait l'écart en chip « autres » (#1153, ticket ouvert). */
export function rollFrozenOpposedAttacker(attacker: Combatant, opp: NonNullable<FlowTest['opposed']>, difficulty: Difficulty): TestResult {
  const line = rollLine({ actor: attacker, test: { skill: opp.attackerSkill, char: opp.attacker }, difficulty });
  const r = rollTest(line.target, 'intermediaire', battleRng());
  return { ...r, base: line.base, sl: r.sl + (opp.attackerBonusSL ?? 0), ...(line.clamped ? { clamped: line.clamped } : {}) };
}

/**
 * LE CÔTÉ ATTAQUANT tel qu'il voyage dans le GEL d'un Test opposé : la STRUCTURE de son Test — CELLE
 * QU'IL A JETÉE (`rollFrozenOpposedAttacker` ci-dessus) — dont le rendu DÉRIVE le libellé de la
 * ligne ; et, seulement quand la donnée en AUTHORE un, le libellé qu'aucune structure ne peut porter
 * (`FlowTest.opposed.attackerLabel` : « Force/Athlétisme », une alternative). Aucun libellé n'est
 * composé ici : un flux déclare, le renderer écrit.
 */
function opposedAttackerFreeze(opp: NonNullable<FlowTest['opposed']>): Pick<OpposedFreeze, 'test' | 'attackerLabel'> {
  return {
    test: { char: opp.attacker, ...(opp.attackerSkill ? { skill: opp.attackerSkill } : {}) },
    ...(opp.attackerLabel ? { attackerLabel: opp.attackerLabel } : {}),
  };
}

/**
 * Étape BATCH d'un Test OPPOSÉ à opposition UNIQUE — UN seul jet d'attaquant FIGÉ (`aT`) contre N
 * défenseurs, une RANGÉE par défenseur dans la MÊME fenêtre (LDB 13 l.77 : « un Test opposé de
 * Discrétion/Perception […] entre le Personnage ayant la Discrétion la plus faible et tous les
 * guetteurs potentiels […] chaque Personnage vaincu subit alors l'État Surpris »).
 *
 * `aggregate:'none'` (le défaut de `bandStep`) : les rangées sont INDÉPENDANTES — rien à agréger,
 * chacune porte SA conséquence
 * (l'applier `triggeredBatchTest` rejoue la branche `onSuccess`/`onFail` par rangée, la branche
 * pouvant appendre à la cascade le second Test du SEUL défenseur concerné). Ligne montée par le MONTEUR
 * CANONIQUE (`rollSeam.rollStep`) HORS canal combat, comme la voie MONO opposée : la valeur testée est
 * `testValue`. GÉNÉRIQUE : aucune entité nommée ; défenseurs, `FlowTest` et branches viennent du
 * producteur. Les défenseurs dont la gate du Test est fermée sont écartés (même décision que
 * `resolveFlowTest`) ; `undefined` s'il ne reste personne.
 *
 * La POSSESSION est celle du socle (`bandStep`) : plusieurs défenseurs → `groupOwner` ; un seul → SON
 * `actorId` (une opposition à un seul défenseur EST la sienne). L'opposition figée voyage dans le
 * `meta`, recopié tel quel par le socle — `stepOpposedFreeze` et les résolveurs de rangée y lisent la
 * même chose qu'avant.
 */
export function frozenOpposedBatchStep(
  defenders: Combatant[], ft: FlowTest, branches: { onSuccess: Flow; onFail: Flow }, after: Flow,
  difficulty: Difficulty, attacker: Combatant, aT: TestResult,
): BuiltCascadeStep | undefined {
  const opp = ft.opposed;
  if (!opp) throw new Error('frozenOpposedBatchStep : le FlowTest doit déclarer son opposition (`opposed`).');
  // Test tagué `menace` : la rangée batch porte le tag ELLE-MÊME (comme l'étape mono), donc le verbe
  // `resist` (Résistance (Menace), LDB 10 l.1016-1020) s'y joue PAR RANGÉE — `FLOWS.cascadeBatch.caps`.
  const skillLabel = ft.skill ? refLabel('skills', ft.skill) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const participants: BatchParticipant[] = [];
  for (const c of defenders) {
    if (flowTestGated(ft, c, combatConditionCtx(c, { caster: attacker }))) continue;
    participants.push({
      id: c.id, interactive: true, result: null, difficulty,
      ...rollStep({ actor: c, test: testIds(ft), difficulty }),
      ...(ft.menace ? { menace: ft.menace } : {}),
      ...(ft.skill ? { skillId: ft.skill.id } : {}), ...(ft.skill?.spec ? { spec: ft.skill.spec } : {}),
    });
  }
  return bandStep({
    id: `triggeredBatchTest-${attacker.id}-${ft.label ?? skillLabel}`,
    kind: 'triggeredBatchTest', icon: 'nav/dice', label: dataLabel(ft.label, skillLabel),
    ...(ft.stake ? { stake: ft.stake } : {}),
    ...(ft.menace ? { menace: ft.menace } : {}),
    meta: {
      onSuccess: branches.onSuccess, onFail: branches.onFail, after, casterId: attacker.id,
      opposed: { aT, attackerId: attacker.id, attackerName: attacker.label, ...opposedAttackerFreeze(opp), difficulty, ...(opp.bonusSL ? { bonusSL: opp.bonusSL } : {}), ...(opp.defenderMustWin ? { defenderMustWin: true } : {}) },
    },
  }, participants);
}

/**
 * Étape BATCH d'un Test SIMPLE (non opposé) — N testeurs appelés par la MÊME entrée de règle, une
 * RANGÉE par testeur dans la MÊME fenêtre (#1117 : une situation = une fenêtre). Jumelle de
 * `frozenOpposedBatchStep` sans opposition, et calque de la voie MONO simple pour sa ligne : montée par
 * le MONTEUR CANONIQUE (`rollSeam.rollStep`, canal `combat`/`test`), exactement comme
 * `simpleTriggeredTestStep`. `aggregate:'none'` (le défaut de `bandStep`) — les rangées sont
 * INDÉPENDANTES, l'applier `triggeredBatchTest` rejoue la branche `onSuccess`/`onFail` par rangée.
 * GÉNÉRIQUE : aucune entité nommée ; testeurs, `FlowTest`, branches et `id` viennent du producteur
 * (c'est lui qui connaît la CLÉ de sa bande). Les testeurs dont la gate du Test est fermée sont
 * écartés (même décision que `resolveFlowTest`) ; `undefined` s'il ne reste personne.
 *
 * La POSSESSION est celle du socle (`bandStep`) : plusieurs testeurs → `groupOwner` ; un seul → SON
 * `actorId`. Sans elle, la fenêtre échoyait à l'hôte seul, et le siège qui tient le testeur ne voyait
 * jamais la rangée où se joue son jet.
 */
export function simpleBatchTestStep(
  testers: Combatant[], ft: FlowTest, branches: { onSuccess: Flow; onFail: Flow }, after: Flow,
  difficulty: Difficulty, id: string, hullId?: string,
): BuiltCascadeStep | undefined {
  const skillLabel = ft.skill ? refLabel('skills', ft.skill) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const participants: BatchParticipant[] = [];
  for (const c of testers) {
    if (flowTestGated(ft, c, combatConditionCtx(c, { caster: c }))) continue;
    participants.push({
      id: c.id, interactive: true, result: null, difficulty, label: skillLabel,
      ...rollStep({ actor: c, test: testIds(ft), difficulty, combat: { kind: 'test' } }),
      ...(ft.menace ? { menace: ft.menace } : {}),
      ...(ft.skill ? { skillId: ft.skill.id } : {}), ...(ft.skill?.spec ? { spec: ft.skill.spec } : {}),
    });
  }
  return bandStep({
    id, kind: 'triggeredBatchTest', icon: 'nav/dice', label: dataLabel(ft.label, skillLabel),
    ...(ft.stake ? { stake: ft.stake } : {}),
    ...(ft.menace ? { menace: ft.menace } : {}),
    meta: { onSuccess: branches.onSuccess, onFail: branches.onFail, after, ...(hullId ? { hullId } : {}) },
  }, participants);
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredBatchTest` — le pendant MULTI de l'applier `triggeredTest` :
 * la MÊME conséquence partagée (`applyTriggeredTestBranch`) est jouée POUR CHAQUE RANGÉE, contre le
 * résultat de CETTE rangée. Une branche qui porte un second Test (Vigilance, LDB 13 l.67) est routée
 * par `runCombatFlow` et n'APPEND son étape que pour le défenseur concerné. Le seam `onOwnTestFailed`
 * est émis par `commitStep` PAR RANGÉE PERDANTE (source unique des deux formes, mono et bande).
 */
registerCascadeApplier('triggeredBatchTest', (get, set, step) => {
  const onSuccess = step.meta?.onSuccess;
  const onFail = step.meta?.onFail;
  if (!onSuccess || !onFail || !step.participants) return;
  const casterId = typeof step.meta?.casterId === 'string' ? step.meta.casterId : undefined;
  const caster = casterId ? actorIn(get(), casterId) : undefined;
  const hullId = typeof step.meta?.hullId === 'string' ? step.meta.hullId : undefined;
  const hull = hullId ? coqueParId(get(), hullId) : undefined;
  // La COQUE que l'étape DÉCLARE a disparu de l'état entre le mint et la résolution — une cascade
  // suspendue (`suspendActiveCascade`) et reprise après la fin du voyage : `travelPlan.vehicle` n'est
  // plus là, la file de combat non plus. La branche d'échec ne peut pas être calculée (la hauteur de
  // chute se lit sur la Taille du bateau) : le refus est JOURNALISÉ et NOMMÉ, jamais joué à moitié —
  // même régime que les gardes d'entrée ci-dessus (l'applier ne lève pas en pleine résolution).
  if (hullId && !hull) return { consequences: freeCons([t('cascade.coqueDisparue', { label: step.label ?? '' })]) };
  const journal: string[] = [];
  for (const part of step.participants) {
    const hero = actorIn(get(), part.id);
    if (!hero || !part.result) continue;
    journal.push(...applyTriggeredTestBranch(hero, part.result, { onSuccess, onFail }, { get, set, ...(caster ? { caster } : {}), ...(hull ? { hull } : {}) }));
    syncCombatant(get, set);
    playAfter(get, set, hero, step.meta?.after, nomDeSource(step));
  }
  return { consequences: freeCons(journal) };
});

/** Étapes de cascade des Tests de FIN DE ROUND en DONNÉES pour un porteur SURFACÉ (`surfaceOf` — un
 *  siège humain QUELCONQUE le tient, cadence manuelle) : pour chaque SOURCE d'effets déclenchés
 *  (États : récupération d'Empoisonné/Brisé LDB 16 ; TALENTS : Contrôle de la
 *  Frénésie LDB 10 ; Traits/psy demain) dont un `effects: onRoundEnd` porte un nœud `test`, une étape
 *  INFLUENÇABLE bâtie depuis la MÊME donnée (`simpleTriggeredTestStep`) que la voie inline (ennemi/auto)
 *  et la voie hors-combat. GÉNÉRIQUE (aucune entité nommée). Un effet OPT-IN (`optional`, RAW « Vous
 *  pouvez… ») devient une étape de CHOIX `triggeredChoice` (Oui → le Test est poussé par l'applier ;
 *  Renoncer par défaut), émise APRÈS les Tests obligatoires (du plus mécanique au plus optionnel).
 *  `after` vide : un Test de fin de Round est top-level. Jumeau du dispatcher (`effectSourcesOf` —
 *  MÊME énumération que `fireTriggers`, qui a lui SAUTÉ ces porteurs via `deferInteractiveTest`). */
export function collectRoundEndTestSteps(get: Get, c: Combatant): BuiltCascadeStep[] {
  const steps: BuiltCascadeStep[] = [];
  const optional: BuiltCascadeStep[] = [];
  // `ConditionCtx` de combat (géométrie d'arène : caché/Engagé/proximité du Brisé) — MÊME géométrie que
  // celle injectée par le dispatcher dans la voie inline, pour évaluer GATE et difficulté DYNAMIQUE.
  const cc = combatConditionCtx(c, { caster: c, ...recoveryGeometry(get, c) });
  for (const src of effectSourcesOf(c)) {
    for (const eff of src.effects) {
      if (eff.trigger !== 'onRoundEnd' || eff.flow.kind !== 'test') continue;
      const ft = eff.flow.test;
      if (flowTestGated(ft, c, cc)) continue; // gate fermée (Brisé caché/Engagé ; pas en Frénésie) → pas d'étape
      if (eff.optional) {
        // « Vous pouvez… » : étape de CHOIX (applier générique `triggeredChoice`) — le Oui pousse le
        // Test influençable dans la MÊME cascade (runCombatFlow → resolveFlowTest, liveMerge).
        const prompt = ft.label ?? src.label;
        const choix = choiceStep({
          id: `triggeredChoice-${c.id}-${prompt}`, kind: 'triggeredChoice', actorId: c.id,
          icon: 'ui/think', label: dataLabel(prompt),
          options: [{ key: 'yes', label: dataLabel(prompt) }, { key: 'no', label: t('opt.renoncer') }],
          defaultChoice: 'no',
          // ENTITÉ PORTEUSE (ids) : le OUI ouvre LE Test — il en dérive son enjeu (#1262 V2 L6d).
          meta: { choiceYes: eff.flow, choiceNo: EMPTY_FLOW, after: EMPTY_FLOW, ...(eff.source ? { sourceKind: eff.source.kind, sourceEntityId: eff.source.id } : {}) },
        });
        pousseSi(optional, choix);
        continue;
      }
      // L'ENTITÉ SOURCE voyage dans le `meta` (déjà estampillée par `withSource`) : c'est la
      // coordonnée `entryId` du contrat d'enjeu (#1117) — le renvoi d'un Test déclenché doit viser
      // l'État/le Trait/le Talent/le symptôme qui l'exige, jamais une fiche générique. C'est AUSSI
      // l'entité dont l'étape DÉRIVE son enjeu quand la donnée n'en déclare pas (#1262 V2 L6d).
      const step = simpleTriggeredTestStep(c, withDerivedStake(ft, eff.source), { onSuccess: eff.flow.success, onFail: eff.flow.fail }, EMPTY_FLOW, resolveTestDifficulty(ft, cc),
        eff.source ? { sourceKind: eff.source.kind, sourceEntityId: eff.source.id } : {});
      pousseSi(steps, step);
    }
  }
  return [...steps, ...optional];
}

/** Rejoue la CONTINUATION `after` d'un `test` (le reste du `seq`) sur `c` EN COMBAT (peut ré-appender
 *  une étape `triggeredTest` à la cascade). No-op pour un `after` vide (Test top-level = Mâchoires). */
function playAfter(get: Get, set: SetFn, c: Combatant, after: Flow | undefined, label: string, source?: EffectSource): void {
  // L'ENTITÉ PORTEUSE suit la continuation : un `test` resté dans le `seq` dérive son enjeu de la même
  // entité que celui qui vient d'être joué (#1262 V2 L6d).
  if (after && after !== EMPTY_FLOW) runCombatFlow({ mode: 'combat', get, set, target: c, caster: c, label, ...(source ? { opsCtx: { source } } : {}) }, after);
}

/**
 * EXÉCUTEUR à PILE d'un Flow EN COMBAT — calque `runFlow` (côté scène) pour porter la CONTINUATION : un
 * nœud `test` enfoui suspend en empaquetant le reste de la pile dans `after` puis délègue à
 * `resolveFlowTest`. `do` ops → `applyOps` sur la bonne cible (`on:'caster'`/`target`) ; `if` → branche
 * sur `condCtxFor`. Le journal part dans la file différée (`pendingLogQueue`). Pas de boucle → termine.
 */
export function runCombatFlow(ctx: ExecCtx, flow: Flow): void {
  const stack: Flow[] = [flow];
  const label = ctx.label;
  const oc: OpsCtx = { rng: battleRng(), caster: ctx.caster, ...ctx.opsCtx };
  while (stack.length) {
    const node = stack.shift()!;
    switch (node.kind) {
      case 'seq': stack.unshift(...node.steps); break;
      case 'do': {
        if (node.effect.type === 'ops') {
          const unit = node.effect.on === 'caster' ? ctx.caster : ctx.target;
          if (unit) {
            // Ops IMPURES `grantFreeAttack` : résolues par le hook injecté (couche combatFlow) — la frappe
            // vise le TIERS de `ctx.freeAttack` (chargeur/victime), pas `unit` (le porteur). `applyOps` les
            // laisse inertes → on les passe quand même (no-op) pour garder le journal des autres ops.
            // Une frappe qui SUSPEND (fenêtre de défense ouverte) arrête le dispatch : la suivante se
            // déclarera à la fermeture, jamais par-dessus la fenêtre (#1852).
            if (freeAttackHook && ctx.freeAttack) for (const op of node.effect.ops) if (op.op === 'grantFreeAttack' && freeAttackHook(ctx.get, ctx.set, unit, op, ctx.freeAttack)) break;
            // Op IMPURE `interruptFocus` (LDB 46 l.144) : le hook injecté (combatFlow) résout l'interruption
            // sur `unit` (le focaliseur) — perte des DR + Imparfaite Mineure (qui peut appender sa propre étape).
            if (focusInterruptHook) for (const op of node.effect.ops) if (op.op === 'interruptFocus') focusInterruptHook(ctx.get, ctx.set, unit);
            // Op IMPURE `breakBlade` (LDB 62 l.280) : le hook injecté (combatFlow) désarme/brise la lame de
            // l'attaquant ciblé (`ctx.bladeTrap`). `unit` = le défenseur piégeur ; son DR final (`ctx.opsCtx.sl`)
            // alimente la marge nette (= victoire Stupéfiante → bris). Le hook EMPILE sa conséquence comme étape
            // d'affichage propre (mirroir du Coup Critique) → rien à journaliser ici.
            if (bladeTrapHook && ctx.bladeTrap) for (const op of node.effect.ops) if (op.op === 'breakBlade') bladeTrapHook(ctx.get, ctx.set, unit, ctx.bladeTrap, ctx.opsCtx?.sl ?? 0);
            // `applyLeafOps` = SOURCE UNIQUE d'application d'une feuille : contexte de FEUILLE
            // (untilTime/label bakés — consommable) + programmation des ops IMPURES `delayed`.
            const lines = applyLeafOps(ctx.get, ctx.set, unit, node.effect, oc);
            // Feuille partie à la PORTE (#1508) : le reste de la pile est SA continuation — MÊME geste
            // que `case 'test'` ci-dessous, et pour la même raison. Poursuivre ici appliquerait les
            // nœuds suivants AVANT la conséquence qui attend son dé, inversant l'ordre de l'auteur.
            if (lines === OPS_DIFFEREES) {
              differerLaSuite(ctx.set, { kind: 'seq', steps: stack.splice(0) }, 'combat', label);
              return;
            }
            syncCombatant(ctx.get, ctx.set); queueLines(ctx.get, ctx.set, lines, unit.id);
          }
        }
        break;
      }
      case 'if': {
        const branch = evalCondition(node.cond, condCtxFor(ctx)) ? node.then : node.else;
        if (branch) stack.unshift(branch);
        break;
      }
      case 'test': {
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        resolveFlowTest(ctx, node, after);
        return;
      }
      case 'choice': {
        const after: Flow = { kind: 'seq', steps: stack.splice(0) };
        resolveFlowChoice(ctx, node, after);
        return;
      }
    }
  }
}

/**
 * POINT DE DÉCISION UNIQUE sur un nœud `test`. `target` = le combattant qui jette (référent = la cible
 * du sous-Flow) ; `after` = continuation reprise APRÈS la branche.
 *  - scène → `openSkillTest` (modale, source unique) ; aucun héros ne peut tenter → on saute au `after`.
 *  - combat + héros MANUEL → étape de cascade `triggeredTest` INFLUENÇABLE (Chance/Pacte/Résilience) ;
 *    on ne touche QUE `pendingCascade` (jamais `battle.log` depuis ce hook profond).
 *  - combat sinon (ennemi / cadence auto) → jet INLINE + branche + `after`, lignes → file différée.
 *
 * Test OPPOSÉ (`ft.opposed`, Assommante LDB 62 l.235) : l'ATTAQUANT (`ctx.caster`, le porteur) est
 * PRÉ-JETÉ et FIGÉ (`aT`) AVANT que le défenseur (`c`) ne jette — l'issue success/sl du défenseur vient
 * de `resolveOpposed(jetDéfenseur, aT)` (PAS `roll ≤ target`). Côté héros manuel, `aT` voyage dans
 * `meta.opposed` (sérialisable, coop) et la cascade re-oppose à chaque influence (calque `recover`/
 * `disengage`) ; côté ennemi/auto, on re-oppose INLINE. Le défenseur RÉSISTE (branche `success`) si
 * l'attaquant ne l'emporte PAS (défenseur OU ÉGALITÉ).
 */
export function resolveFlowTest(ctx: ExecCtx, node: Extract<Flow, { kind: 'test' }>, after: Flow): void {
  // ENJEU du Test, résolu ICI pour TOUTES les voies en aval (étape mono, jet inline, modale de scène) :
  // celui DÉCLARÉ par la donnée prime, sinon celui DÉRIVÉ de l'entité porteuse (#1262 V2 L6d).
  const ft = withDerivedStake(node.test, ctx.opsCtx?.source);
  if (ctx.mode === 'scene') {
    // Source unique de modale. Personne ne peut tenter (aucun héros vivant) → on reprend directement la
    // continuation de scène via `runFlow` (mirroir du `runFlow.case 'test'` côté combatEffects).
    if (!openSkillTest(ctx.get, ctx.set, ft, node.success, node.fail, after)) jouerFlowEntier(runFlow(ctx.get, ctx.set, after, ctx.label));
    return;
  }
  const c = ctx.target!;
  // Gates de l'op `test` reportées sur le nœud (sémantique IDENTIQUE) — évaluées AVANT de poser l'étape /
  // jeter : la cible est connue (combat). Gate non passée ⇒ no-op (ni étape ni branche, comme l'op
  // `break`) MAIS la continuation `after` est jouée (= ops suivantes du `do` d'origine).
  const cc = condCtxFor(ctx); // contexte d'évaluation (géométrie d'arène + ActorView) pour gate/difficultyBy
  // Gates op-level (immunité/groupes) + GATE générique de Condition (`gate`, Brisé : « pas Engagé OU Cœur
  // vaillant, ET pions restants ») — SOURCE UNIQUE partagée avec la voie inline (`resolveInlineFlowTest`).
  if (flowTestGated(ft, c, cc)) { playAfter(ctx.get, ctx.set, c, after, ctx.label, ctx.opsCtx?.source); return; }
  const opp = ft.opposed;
  // Valeur TESTÉE du jet INLINE (le squelette d'étape, lui, vient du monteur canonique) — pénalité d'État
  // comptée UNE seule fois (RAW : −10 d'Empoisonné/Sonné/… au Test, LDB 16, pas deux) :
  //  · Test SIMPLE → `base` BRUT (`rawCombatTestBase`, sans pénalité d'État) + `combatTestPenalty` (ci-dessous).
  //  · Test OPPOSÉ → `base` = `testValue` (porte déjà la pénalité d'État) + aucune pénalité ajoutée (penalty 0).
  const base = opp ? testValue(c, ft.skill?.id, ft.characteristic, ft.skill?.spec) : rawCombatTestBase(c, ft.skill?.id, ft.characteristic, ft.skill?.spec);
  const difficulty: Difficulty = resolveTestDifficulty(ft, cc); // dynamique (Brisé : caché/proche/loin), sinon ft.difficulty
  const skillLabel = ft.skill ? refLabel('skills', ft.skill) : (ft.characteristic ? CHAR_LABELS[ft.characteristic] : 'Test');
  const label = dataLabel(ft.label, skillLabel);
  // Test SIMPLE : `combatTestPenalty` (sur le `base` BRUT → −10 d'État compté une fois). Test OPPOSÉ : 0
  // (l'op `opposedTest` jetait `testValue` brut des deux côtés ; `testValue` porte déjà la pénalité d'État).
  const penalty = opp ? 0 : combatTestPenalty(c);
  // Test OPPOSÉ : PRÉ-JET de l'attaquant (porteur), FIGÉ, AVANT le jet du défenseur — même ordre RNG que
  // `opposedTest()` (attaquant puis défenseur). Référent = `ctx.caster` (Force du porteur).
  const attacker = opp ? ctx.caster : undefined;
  // Un freeze FOURNI par le producteur (`ctx.opposedFreeze`) n'est jamais re-jeté : c'est l'opposition
  // UNIQUE de la situation (N défenseurs, un seul jet d'attaquant — LDB 13 l.77).
  const aT: TestResult | undefined = opp && attacker
    ? (ctx.opposedFreeze ?? rollFrozenOpposedAttacker(attacker, opp, difficulty))
    : undefined;
  // Piège-lame : on COMPLÈTE le freeze avec le DR de l'attaquant que CE Test jette (`aT`), pour que la
  // conséquence `breakBlade` recompose la marge nette sans re-jeter l'attaquant.
  const btFreeze = ctx.bladeTrap && aT ? { ...ctx.bladeTrap, attackerSL: aT.sl } : ctx.bladeTrap;
  // La SURFACE est le seul critère de cette porte : un porteur hors d'action reçoit son étape (un Test
  // déclenché le vise LUI, il ne demande pas d'agir — le gate d'Action du tour, lui, filtre ; #1265).
  if (surfaceOf(ctx.get, c.id)) {
    // Porteur SURFACÉ (un siège humain QUELCONQUE le tient, cadence manuelle) : étape INFLUENÇABLE,
    // suspendue dans la cascade et routée à SON siège. Branche + `after` (et,
    // pour une réaction, le contexte sérialisable `freeAttack`/`bladeTrap`) voyagent dans le meta → rejoués
    // par l'applier. Test OPPOSÉ : squelette minté ICI (`monoStep`) — ligne montée par le MONTEUR CANONIQUE
    // HORS canal combat (convention `testValue`) + `aT` figé dans le meta pour ré-opposer à
    // chaque influence. Test SIMPLE : `simpleTriggeredTestStep` (source unique).
    // `noOwnTestFailed` : ce Test est LUI-MÊME un effet d'un `onOwnTestFailed` (FM de palier 2 des Crampes,
    // MSRC 16) — l'étampe empêche `commitStep` de ré-émettre le trigger à sa résolution (garde de ré-entrance
    // qui survit à la cadence asynchrone du héros).
    // L'ENTITÉ PORTEUSE voyage aussi dans le `meta` (ids, sérialisable) : la BRANCHE rejouée par
    // l'applier peut porter un second Test, qui dérive alors son enjeu de la MÊME entité (#1262 V2 L6d).
    const src = ctx.opsCtx?.source;
    const extraMeta = { ...(ctx.caster && ctx.caster.id !== c.id ? { casterId: ctx.caster.id } : {}), ...(src ? { sourceKind: src.kind, sourceEntityId: src.id } : {}), ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}), ...(btFreeze ? { bladeTrap: btFreeze } : {}), ...(ctx.opsCtx?.noReentryOwnTestFailed ? { noOwnTestFailed: true } : {}) };
    const step = aT && attacker
      ? monoStep({
        id: triggeredTestStepId(c, ft.label, skillLabel), kind: 'triggeredTest', icon: 'nav/dice', rollLabel: skillLabel,
        actor: c, ligne: { test: testIds(ft) }, label, difficulty,
        stake: ft.stake,
        meta: { onSuccess: node.success, onFail: node.fail, after, opposed: { aT, attackerId: attacker.id, attackerName: attacker.label, ...opposedAttackerFreeze(opp!), difficulty, ...(opp!.bonusSL ? { bonusSL: opp!.bonusSL } : {}), ...(opp!.defenderMustWin ? { defenderMustWin: true } : {}) }, ...extraMeta },
        ...(ft.menace ? { menace: ft.menace } : {}),
      })
      : simpleTriggeredTestStep(c, ft, { onSuccess: node.success, onFail: node.fail }, after, difficulty, extraMeta);
    if (step) pushCombatStep(ctx.set, step);
    return;
  }
  // `exec` (get/set [+ freeAttack/bladeTrap]) TOUJOURS fourni : une branche IMPURE (à hook : interruptFocus /
  // la success freeAttack / le breakBlade de Piège-lame) est routée vers `runCombatFlow` par
  // `applyTriggeredTestBranch` (cf. flowHasImpureOp) ; une branche PURE retombe sur `runPureFlowLines`
  // (inchangé). `freeAttack`/`bladeTrap` ne sont joints que s'ils existent.
  const exec = { get: ctx.get, set: ctx.set, ...(ctx.caster ? { caster: ctx.caster } : {}), ...(ctx.opsCtx?.hull ? { hull: ctx.opsCtx.hull } : {}), ...(ctx.opsCtx?.source ? { source: ctx.opsCtx.source } : {}), ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}), ...(btFreeze ? { bladeTrap: btFreeze } : {}) };
  // Ennemi OU héros rapide/auto : jet INLINE + branche + continuation ; ligne de parité.
  // `skillLabel` = la Compétence/Caractéristique RÉELLE (cadre de jet), distincte du `label` de situation.
  const t = rollTest(base, difficulty, battleRng(), penalty);
  if (opp && aT && attacker) {
    // Test OPPOSÉ inline : l'attaquant figé (1ʳᵉ position) vs le jet du défenseur. `t.success`/`t.sl` du
    // jet simple sont REMPLACÉS par l'issue opposée ; la BRANCHE se lit au socle (`opposedBranchSuccess`
    // — statu quo à l'égalité parfaite, LDB 12 l.160), jamais recomposée ici. Le bonus de DR du défenseur
    // (Piège-lame, LDB 62 l.280) s'AJOUTE à son `sl` AVANT l'opposition (vainqueur ET marge nette).
    const bonusSL = opp.bonusSL ?? 0;
    // Départage à DR égal (LDB 12 l.160) : les DEUX camps portent leur valeur NUE — l'attaquant depuis
    // son pré-jet (`rollFrozenOpposedAttacker`), le défenseur posée ICI (le `t` de `rollTest` n'en a pas).
    const o = resolveOpposed(aT, { ...t, sl: t.sl + bonusSL, base: skillBaseValue(c, ft.skill?.id, ft.skill?.spec, ft.characteristic) });
    const branchSuccess = opposedBranchSuccess(o, opp.defenderMustWin);
    // Chemin INLINE (défenseur non piloté par un humain — l.358) : ni l'attaquant ni le défenseur
    // n'ont de rangée `CascadeModal`/RollLine — le journal de combat est la SEULE surface des DEUX
    // jets de ce Test opposé, il les PORTE : la ligne se DÉRIVE (`traceLineOf`, forme OPPOSÉE). Le
    // côté attaquant y est nommé par la MÊME source que la fenêtre (`opposedAttackerFreeze`) et dans
    // le MÊME ordre : le libellé AUTHORÉ d'abord, la STRUCTURE au catalogue ensuite.
    const gel = opposedAttackerFreeze(opp);
    queueLines(ctx.get, ctx.set, [traceLineOf({
      attacker: { who: attacker.label, label: opposedAttackerLabel(gel) ?? '', roll: aT.roll, target: aT.target, sl: aT.sl },
      defender: { who: c.label, label: skillLabel, roll: t.roll, target: t.target, sl: t.sl, ...(bonusSL ? { slBonus: bonusSL } : {}) },
      winner: o.winner,
    })], c.id);
    const lines = applyTriggeredTestBranch(c, { success: branchSuccess, sl: t.sl }, { onSuccess: node.success, onFail: node.fail }, exec);
    // SEAM `onOwnTestFailed` (combat, jet inline ennemi/auto — Test OPPOSÉ PERDU par le porteur). Une
    // égalité parfaite n'est pas un échec (statu quo) : le trigger ne part que si l'attaquant l'emporte.
    if (o.winner === 'attacker') lines.push(...fireOwnTestFailed(ctx.get, c, { sl: t.sl }));
    syncCombatant(ctx.get, ctx.set);
    queueLines(ctx.get, ctx.set, lines, c.id);
    playAfter(ctx.get, ctx.set, c, after, ctx.label, ctx.opsCtx?.source);
    return;
  }
  queueLines(ctx.get, ctx.set, [traceLineOf({ who: c.label, label: testTraceLabel(skillLabel, difficulty), ...t })], c.id);
  const lines = applyTriggeredTestBranch(c, t, { onSuccess: node.success, onFail: node.fail }, exec);
  // SEAM `onOwnTestFailed` (combat, jet inline ennemi/auto — Test SIMPLE raté par le porteur).
  if (!t.success) lines.push(...fireOwnTestFailed(ctx.get, c, { sl: t.sl }));
  syncCombatant(ctx.get, ctx.set); // les combattants ont muté (États retirés)
  queueLines(ctx.get, ctx.set, lines, c.id);
  playAfter(ctx.get, ctx.set, c, after, ctx.label, ctx.opsCtx?.source); // continuation APRÈS la branche (ordre du journal)
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredTest` — UN applier pour TOUTE mécanique (zéro applier par
 * talent). Lit `step.result` (succès/DR posés par `FLOWS.cascade`) + les Flows `meta.onSuccess/onFail`
 * (sérialisables) et exécute la MÊME conséquence partagée `applyTriggeredTestBranch`, PUIS la
 * continuation `meta.after` (l'`ExecCtx` est RECONSTRUIT depuis get()/hero — jamais capturé).
 */
registerCascadeApplier('triggeredTest', (get, set, step, hero) => {
  if (!hero || !step.result) return;
  const onSuccess = step.meta?.onSuccess;
  const onFail = step.meta?.onFail;
  if (!onSuccess || !onFail) return;
  // `exec` (get/set) TOUJOURS fourni : une branche IMPURE à hook (interruptFocus / la success freeAttack /
  // le breakBlade de Piège-lame) est routée vers `runCombatFlow` par `applyTriggeredTestBranch` (cf.
  // flowHasImpureOp). `freeAttack` sérialisé (Frappe réactive) → joint pour cibler le TIERS (chargeur) ;
  // `bladeTrap` sérialisé → joint pour cibler la lame de l'attaquant ; absents → branche sur soi.
  const fa = step.meta?.freeAttack;
  const bt = step.meta?.bladeTrap;
  // Référent des Formules (`casterId`, cf. `CascadeStepMeta`) — combat OU groupe (`actorIn`, pas
  // `inBattleId` seul) : un lanceur qui a quitté la file de combat (fui/KO retiré) mais reste vivant
  // dans le groupe garde SON référent (Forêt d'épines LDB 48 l.749 : « qui utilise VOTRE Force
  // Mentale », pas celle du traverseur) ; absent/introuvable ⇒ `applyTriggeredTestBranch` retombe sur `hero`.
  const casterId = typeof step.meta?.casterId === 'string' ? step.meta.casterId : undefined;
  const caster = casterId ? actorIn(get(), casterId) : undefined;
  // ENTITÉ PORTEUSE recomposée du `meta` (ids sérialisés au mint) : un second Test enfoui dans la
  // branche dérive son enjeu de la MÊME entité que celui qui vient d'être joué (#1262 V2 L6d).
  const sk = step.meta?.sourceKind;
  const sid = step.meta?.sourceEntityId;
  const exec = {
    get, set,
    ...(caster ? { caster } : {}),
    ...(typeof sk === 'string' && typeof sid === 'string' ? { source: { kind: sk as EffectSource['kind'], id: sid } } : {}),
    ...(fa && typeof fa === 'object' && 'targetId' in fa ? { freeAttack: fa } : {}),
    ...(bt && typeof bt === 'object' && 'attackerId' in bt ? { bladeTrap: bt } : {}),
  };
  const journal = applyTriggeredTestBranch(hero, step.result, { onSuccess, onFail }, exec);
  // (SEAM `onOwnTestFailed` d'une étape de cascade : centralisé dans `commitStep` — jamais ici, sinon
  //  double-émission ; l'étampe `meta.noOwnTestFailed` y garde la ré-entrance du FM de palier 2.)
  syncCombatant(get, set); // refléter la mutation du héros (États) dans party/battle
  // Continuation `after` (le reste du `seq` qui suivait le `test`) — peut ré-appender une étape
  // `triggeredTest` à la MÊME cascade (commitStep `liveMerge` repart des participants courants).
  playAfter(get, set, hero, step.meta?.after, nomDeSource(step), exec.source);
  return { consequences: freeCons(journal) };
});

/** Le coût d'Avantage d'un nœud `choice` est-il payable par le décideur ? (Coût absent ⇒ gratuit ⇒ oui.)
 *  L'Avantage disponible est lu par `spendableAdvantage` — source unique des gardes d'abordabilité, qui
 *  rend la réserve du CAMP en mode Avantage de groupe (`AA 11 l.30`) et l'Avantage individuel en LDB. */
function choiceAffordable(get: Get, decider: Combatant | undefined, advantageCost?: number): boolean {
  return advantageCost == null || (decider ? spendableAdvantage(get, decider) : 0) >= advantageCost;
}

/**
 * POINT DE DÉCISION d'un nœud `choice` (décision joueur opt-in) — FRÈRE de `resolveFlowTest`. Le DÉCIDEUR
 * est `ctx.caster` (le porteur de l'effet : Frappe réactive = le héros Chargé). `after` = continuation
 * reprise APRÈS la branche choisie.
 *  - DÉCIDEUR SURFACÉ (`surfaceOf` : un siège humain QUELCONQUE le tient, cadence manuelle) → étape de
 *    CHOIX `triggeredChoice` dans la cascade de combat (`options` yes/no, `defaultChoice:'no'`, la
 *    possession posée par le mint `choiceStep`) ; les Flows `yes`/`no`, le `cost`, l'`after` et le
 *    contexte `freeAttack` voyagent dans le `meta` (sérialisable). On ne touche QUE `pendingCascade`.
 *  - ENNEMI / cadence auto → décision AUTO inline : oui si le coût est payable (heuristique simple — l'IA
 *    saisit la réaction quand elle le peut), sinon non. La branche choisie est jouée par `runCombatFlow`
 *    (qui enchaîne sur le Test `yes` cadence-aware en aval), suivie de la continuation `after`.
 */
export function resolveFlowChoice(ctx: ExecCtx, node: Extract<Flow, { kind: 'choice' }>, after: Flow): void {
  const decider = ctx.caster ?? ctx.target;
  if (typeof node.advantageCost === 'string') {
    // Coût resté TEMPLATE (`$indice` non substitué : l'instance porteuse n'a pas d'Indice) — le nœud n'est
    // PAS offert, et surtout jamais rendu GRATUIT. On joue la branche `no` et la continuation, comme un refus.
    runCombatFlow({ ...ctx }, node.no ?? EMPTY_FLOW);
    if (after !== EMPTY_FLOW) runCombatFlow({ ...ctx }, after);
    return;
  }
  if (ctx.mode === 'combat' && decider && surfaceOf(ctx.get, decider.id)) {
    // Décideur surfacé : étape de CHOIX influençable (rendue par le chemin CHOIX générique de CascadeModal),
    // routée au siège qui tient le décideur — l'hôte ne tranche ni ne dépense l'Avantage d'autrui.
    // Le coût (en libellé) est joint au « Oui » ; l'option est tranchée par `cascadeChoose`.
    const yesLabel = node.advantageCost != null ? `${node.prompt} (${node.advantageCost} Av)` : node.prompt;
    // Coût hors de portée : l'option reste PRÉSENTE et porte SA cause (rendue au survol/focus/tap par
    // `OptionChooser`, jamais inline) — l'applier refuse déjà la dépense, l'écran cesse de le taire.
    const abordable = choiceAffordable(ctx.get, decider, node.advantageCost);
    // CIBLE de la branche : quand la branche vise une AUTRE unité que le décideur (`on:'victim'` —
    // Déstabilisante : le porteur décide, le Test opposé vise la VICTIME), on sérialise son id pour le
    // restaurer en `ctx.target` côté applier (sinon la branche viserait le décideur → Test sur soi-même).
    const branchTargetId = ctx.target && ctx.target.id !== decider.id ? ctx.target.id : undefined;
    pushChoice(ctx.set, {
      id: `triggeredChoice-${decider.id}-${node.prompt}`,
      kind: 'triggeredChoice', actorId: decider.id, icon: node.icon ?? 'ui/think', label: dataLabel(node.prompt),
      options: [{ key: 'yes', label: dataLabel(yesLabel), ...(abordable ? {} : { refus: t('opt.avantageInsuffisant', { n: node.advantageCost ?? 0, dispo: spendableAdvantage(ctx.get, decider) }) }) }, { key: 'no', label: t('opt.renoncer') }],
      defaultChoice: 'no',
      meta: {
        choiceYes: node.yes, choiceNo: node.no ?? EMPTY_FLOW, after,
        ...(node.advantageCost != null ? { choiceCost: node.advantageCost } : {}),
        ...(branchTargetId ? { choiceTargetId: branchTargetId } : {}),
        // ENTITÉ PORTEUSE (ids) : la branche `yes` porte souvent LE Test (« Vous pouvez… » → jet) — sans
        // ce relais, le Test ouvert par le OUI perdrait son porteur et n'aurait plus d'enjeu (#1262 V2 L6d).
        ...(ctx.opsCtx?.source ? { sourceKind: ctx.opsCtx.source.kind, sourceEntityId: ctx.opsCtx.source.id } : {}),
        ...(ctx.freeAttack ? { freeAttack: ctx.freeAttack } : {}),
      },
    });
    return;
  }
  // Ennemi / héros rapide-auto : décision INLINE (oui si payable). Dépense le coût puis joue la branche.
  const yes = choiceAffordable(ctx.get, decider, node.advantageCost);
  if (yes && node.advantageCost != null && decider) campSpend(ctx.get, decider, node.advantageCost); // débite la réserve du camp (mode groupe) / le combattant (LDB)
  runCombatFlow({ ...ctx }, yes ? node.yes : (node.no ?? EMPTY_FLOW));
  if (after !== EMPTY_FLOW) runCombatFlow({ ...ctx }, after);
}

/**
 * Étape de cascade GÉNÉRIQUE `triggeredChoice` — UN applier pour TOUTE décision opt-in (zéro applier par
 * mécanique). Reconstruit le décideur depuis get()/hero ; sur `chosen==='yes'` ET coût payable, dépense le
 * coût + joue la branche `yes` (via `runCombatFlow` — peut empiler une étape `triggeredTest` cadence-aware,
 * Frappe réactive) ; sinon joue `no`. Puis la continuation `after`. L'`ExecCtx` est RECONSTRUIT (jamais
 * capturé) ; le contexte `freeAttack` sérialisé rejoint l'exécution pour la frappe contre le tiers.
 */
registerCascadeApplier('triggeredChoice', (get, set, step, hero) => {
  if (!hero) return;
  const yes = step.chosen === 'yes';
  const cost = typeof step.meta?.choiceCost === 'number' ? step.meta.choiceCost : undefined;
  const yesFlow = step.meta?.choiceYes;
  const noFlow = step.meta?.choiceNo;
  const fa = step.meta?.freeAttack;
  const freeAttack = fa && typeof fa === 'object' && 'targetId' in fa ? fa : undefined;
  const can = yes && choiceAffordable(get, hero, cost);
  if (yes && can && cost != null) { campSpend(get, hero, cost); syncCombatant(get, set); } // débite la réserve du camp (mode groupe) / le combattant (LDB)
  // Le DÉCIDEUR (`hero`) est le `caster` (porteur). La branche vise `choiceTargetId` (la VICTIME, Déstabilisante)
  // si présent, sinon le décideur lui-même (Frappe réactive : Test sur soi). Reconstruit depuis get() — jamais capturé.
  const tid = typeof step.meta?.choiceTargetId === 'string' ? step.meta.choiceTargetId : undefined;
  const branchTarget = (tid ? inBattleId(get().battle, tid) : undefined) ?? hero;
  // ENTITÉ PORTEUSE recomposée du `meta` : le Test de la branche `yes` en dérive son enjeu (#1262 V2 L6d).
  const sk = step.meta?.sourceKind;
  const sid = step.meta?.sourceEntityId;
  const source = typeof sk === 'string' && typeof sid === 'string' ? { kind: sk as EffectSource['kind'], id: sid } : undefined;
  const ctx: ExecCtx = { mode: 'combat', get, set, target: branchTarget, caster: hero, label: step.label ?? 'Réaction', ...(source ? { opsCtx: { source } } : {}), ...(freeAttack ? { freeAttack } : {}) };
  if (can) runCombatFlow(ctx, yesFlow ?? EMPTY_FLOW);
  else if (noFlow) runCombatFlow(ctx, noFlow);
  playAfter(get, set, hero, step.meta?.after, step.label ?? 'Réaction', source);
});

/**
 * ROUTEUR d'un Flow de trigger PORTANT un nœud `test` vers la voie cadence-aware — installé dans
 * `triggeredEffects` (inversion de dépendance) par le STORE au runtime (`createCombatSlice`, comme le
 * hook `onGainCondition`), PAS au top-level de ce module : l'injecteur `setTriggeredTestRouter` vit en
 * amont d'un cycle d'imports (`triggeredEffects`→`combatEffects`→…→`combatFlow`→ce module) → l'appeler à
 * l'init donnerait une TDZ. Délègue au `runCombatFlow` à PILE (after-aware) : un `test` top-level
 * (Mâchoires, `onGainCondition`) est traité IDENTIQUEMENT au Lot 0 (`after` = pile vide) ; un `test`
 * ENFOUI (Venin sous `if`, Hurlement dans un `seq`) suspend en empaquetant le reste de la pile dans
 * `after`. Le `caster`/référent = `actor` (le porteur de l'effet : Force de la source pour les formules) ;
 * `target` = la cible de l'effet (qui jette le Test). `opsCtx` porte le contexte de la touche
 * (`woundsDealt`/`sl`/`location`/`attackKind`) lu par les Conditions `if` du Flow (Venin sur PB perdus).
 */
export function routeTriggeredTest(get: Get, set: SetFn, target: Combatant, actor: Combatant, flow: Flow, opsCtx?: OpsCtx): void {
  // HORS COMBAT, un Test SUBI par un HÉROS passe par la MODALE de jet CANONIQUE (`openSkillTest` →
  // `pendingTest`, Chance/Résilience), jamais inline (doctrine « un jet = une modale » — elle vaut
  // hors combat comme en combat). Gate `slThreshold` évaluée d'abord (openSkillTest ne la connaît pas) ;
  // `noOwnTestFailed` tamponne la ré-entrance (resolveTest ne ré-émet pas).
  if (!get().battle && flow.kind === 'test' && target.kind === 'hero') {
    const cc = combatConditionCtx(target, opsCtx ?? {});
    if (flowTestGated(flow.test, target, cc)) return; // gate fermée → no-op (identique à la voie inline)
    // Un Test SUBI (effet déclenché : Venin, Hurlement, Crampes, zone franchie…) n'est pas soutenu —
    // LDB 12 l.197. Défaut de la VOIE, tri-état : la donnée peut le rouvrir (`noSupport:false`).
    // Enjeu DÉRIVÉ du porteur si la donnée n'en déclare pas (#1262 V2 L6d) — la modale HORS COMBAT dit
    // ce qui se joue exactement comme l'étape de cascade : même porte, même deux étages.
    const ft = { ...withDerivedStake(flow.test, opsCtx?.source), noSupport: flow.test.noSupport ?? true };
    // Le pending porte le VOCABULAIRE de la branche (`target`/`caster`) : c'est lui qui, à la reprise,
    // envoie branche et continuation au marcheur d'ACTEUR (`reprendreTestSubi`) plutôt qu'à celui de
    // scène. Ids seuls, même prédicat que l'`extraMeta` de l'étape de cascade (`runCombatFlow`,
    // `case 'test'`) : le lanceur n'entre que lorsqu'il DIFFÈRE du sujet. Le libellé de la source voyage
    // avec : la reprise la nomme comme la porte en combat (`nomDeSource`, ci-dessous).
    const subi = {
      ...(actor.id !== target.id ? { casterId: actor.id } : {}),
      ...(opsCtx?.label ? { label: opsCtx.label } : {}),
      ...(opsCtx?.source ? { source: opsCtx.source } : {}),
    };
    openSkillTest(get, set, ft, flow.success, flow.fail, EMPTY_FLOW, { actorId: target.id, noOwnTestFailed: opsCtx?.noReentryOwnTestFailed, subi });
    return;
  }
  runCombatFlow({ mode: 'combat', get, set, target, caster: actor, label: nomDeSource(opsCtx), opsCtx }, flow);
}

/**
 * REPRISE de la branche d'un Test SUBI (`PendingTest.subi`, posé par la porte ci-dessus) — le pendant
 * de `rejouerLaSuite` en mode `'combat'` (`combatEffects.ts`) pour la modale de Test : la branche et
 * la continuation d'un Test SUBI parlent `target`/`caster`, vocabulaire que seul `runCombatFlow`
 * honore (`case 'do'` : `on === 'caster'` → lanceur, sinon cible). Le contexte est RECONSTRUIT depuis
 * `get()` par ids — jamais capturé : entre l'ouverture et la reprise il y a une modale, donc
 * potentiellement une save, un rechargement ou un relais coop. La source se nomme comme à la porte en
 * combat (`nomDeSource`).
 *
 * Sujet MORT ou introuvable : la branche n'est PAS jouée, et la conséquence perdue se DIT
 * (`cascade.cibleDisparue`, comme l'applier `opsDe`). Lanceur irrésoluble : on retombe sur le sujet,
 * parité avec le combat (`applyTriggeredTestBranch` : `exec?.caster ?? c`).
 */
export function reprendreTestSubi(get: Get, set: SetFn, pt: PendingTest, success: boolean): Applique {
  const { casterId, ...gele } = pt.subi ?? {};
  const label = nomDeSource(gele);
  const sujet = actorIn(get(), pt.actorId);
  if (!sujet || sujet.dead) {
    journaliser(get, set, [t('cascade.cibleDisparue', { label })]);
    return undefined;
  }
  const caster = (casterId ? actorIn(get(), casterId) : undefined) ?? sujet;
  const branche = success ? pt.onSuccess : pt.onFailure;
  const avant = comptePasDifferes(get());
  runCombatFlow({
    mode: 'combat', get, set, target: sujet, caster, label, opsCtx: { ...gele, sl: pt.sl },
  }, { kind: 'seq', steps: [branche ?? EMPTY_FLOW, pt.after ?? EMPTY_FLOW] });
  // Les lignes de la branche partent dans la file différée (SOURCE UNIQUE des hooks profonds) ; leur
  // destination est choisie par le ROUTAGE UNIQUE `journaliser` (`combatLog.ts`, #1881), jamais par une
  // écriture nue de `battle.log` ici.
  journaliser(get, set, drainPendingLog(get, set).map((e) => e.text), 'condition');
  // Une feuille partie à la PORTE (#1508) a reçu la suite : l'appelant n'a plus à jouer ses clôtures
  // devant le dé — même compte canonique que `rejouerLaSuite`.
  return comptePasDifferes(get()) > avant ? OPS_DIFFEREES : undefined;
}

/**
 * MÊME PORTE, N TESTEURS (#1657 B3-2) — `routeTriggeredTest` généralisé : un SEUL nœud `test` que N
 * porteurs subissent en même temps (le coup à l'ÉQUIPAGE d'un Critique de coque, MSRC 07 l.78 « Toute
 * personne présente sur le pont »). La forme MÉCANIQUE se DÉRIVE de la situation, elle ne se déclare
 * pas : les testeurs SURFACÉS (`surfaceOf` — un siège humain les tient) prennent UNE bande de N
 * rangées, une par siège (`simpleBatchTestStep`, possession posée par `bandStep`) ; les autres
 * (marins PNJ, cadence auto) passent par la voie INLINE de la porte (`runCombatFlow` →
 * `resolveFlowTest`), qui journalise. Le mono EST le cas N=1 — aucune seconde forme.
 *
 * Rend l'étape à INSÉRER (`undefined` si personne n'est surfacé) : la couture décide où elle atterrit
 * (combat → `pushCombatStep` ; voyage → `insert` de l'applier ou `pushStep(…, 'travelDay')`), et
 * DRAINE elle-même les lignes inline (`drainPendingLog`) dans SON journal.
 */
export function bandeTriggeredTest(
  get: Get, set: SetFn, testeurs: Combatant[], node: Extract<Flow, { kind: 'test' }>, id: string, opsCtx?: OpsCtx,
): BuiltCascadeStep | undefined {
  const surfaces: Combatant[] = [];
  for (const c of testeurs) {
    if (surfaceOf(get, c.id)) { surfaces.push(c); continue; }
    runCombatFlow({ mode: 'combat', get, set, target: c, caster: c, label: nomDeSource(opsCtx), ...(opsCtx ? { opsCtx } : {}) }, node);
  }
  if (!surfaces.length) return undefined;
  const ft = withDerivedStake(node.test, opsCtx?.source);
  return simpleBatchTestStep(
    surfaces, ft, { onSuccess: node.success, onFail: node.fail }, EMPTY_FLOW,
    resolveTestDifficulty(ft, combatConditionCtx(surfaces[0], opsCtx ?? {})), id, opsCtx?.hull?.id,
  );
}

/** Implémentation du hook `setZoneCrossTestHook` (combatGeometry.ts, #500) — un `crossTest` de zone
 *  (Forêt d'épines, LDB 48 l.749) EST un `test` de Flow comme un autre : délègue à `routeTriggeredTest`,
 *  aucune machinerie propre. Injectée par le store (`createCombatSlice`), calque `freeAttackHookImpl`.
 *  `applyZoneCrossings` (l'appelant, combatGeometry.ts) n'a PAS accès à `drainPendingLog`
 *  (combatEffects.ts, cycle) : on draine ICI la voie INLINE (ennemi/auto — `resolveFlowTest` y pousse
 *  ses lignes dans `pendingLogQueue`, SOURCE UNIQUE) — no-op pour la voie cascade (héros manuel, aucune
 *  ligne encore produite au retour de `routeTriggeredTest`, elle en poussera à la résolution du jet). */
export function zoneCrossTestHookImpl(get: Get, set: SetFn, mover: Combatant, caster: Combatant, flow: Flow, label: string, source?: EffectSource): void {
  routeTriggeredTest(get, set, mover, caster, flow, { label, ...(source ? { source } : {}) });
  const battle = get().battle;
  if (!battle) return;
  const drained = drainPendingLog(get, set);
  if (drained.length) set({ battle: { ...get().battle!, log: [...get().battle!.log, ...drained] } });
}

/** Combattants en cours de notification `onGainCondition` — garde ANTI-RÉCURSION : un `onSuccess` qui
 *  ajoute un État (« tous Sonné retirés → Exténué ») ne doit pas re-déclencher le hook sur le même
 *  combattant en boucle. `WeakSet` (jamais sérialisé — pure mécanique de réentrance). */
const notifying = new WeakSet<Combatant>();

/**
 * Hook `onGainCondition` rempli par le store (`setConditionGainedHook`) : quand un combattant gagne un
 * État EN COMBAT, déclenche ses effets `onGainCondition` (Mâchoires d'acier). Gardes : combat actif +
 * combattant DANS la file de combat (pas un membre du groupe hors combat) + anti-récursion. Un Test
 * routé suspend (cascade) ou résout inline (la brique gère le journal) ; d'éventuelles lignes
 * NON-Test (futurs effets) sont mises dans la file de journal différée (§5).
 */
export function handleConditionGained(get: Get, set: SetFn, c: Combatant, name: string): void {
  const battle = get().battle;
  if (!battle || !battle.combatants.some((x) => x.id === c.id)) return; // hors combat / non-combattant → silence
  if (notifying.has(c)) return; // réentrance (un onSuccess ajoute un État) → on ne re-fire pas
  notifying.add(c);
  try {
    const lines: string[] = [];
    emitCombatEvent('onGainCondition', { get, set, battle, self: c, sink: (line) => lines.push(line), triggerCtx: { conditionName: name, rng: battleRng() } });
    if (lines.length) set({ pendingLogQueue: [...get().pendingLogQueue, ...lines.map((line) => ({ line, cid: c.id }))] });
  } finally {
    notifying.delete(c);
  }
}
