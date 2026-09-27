/**
 * SEAM DE JET UNIQUE (#275) — LA porte déclarative de tout dé du jeu : le call-site DÉCRIT, la porte
 * décide du surfaçage. Extension de la fabrique existante (`makeRollFlow`/`FLOWS`,
 * `rollFlowFactory.ts`) + `cascade.ts` (séquenceur) — RIEN de parallèle.
 *
 * `openRoll` DÉCRIT un jet (`RollRequest`) et une CONTINUATION enregistrée par `kind`
 * (`registerCascadeApplier`, `cascade.ts:57`) ; la porte DÉRIVE la surface des PORTEURS RÉELS du jet
 * (#1479) via les prédicats EXISTANTS (`surfaceOf`/`cadenceAuto`/`seaAutoResolves`) :
 *   M = modale influençable (`startCascade`, propriétaire = l'acteur humain) ;
 *   V = étape visible-lançable MJ (`startCascade`, propriétaire = le siège `gmSeat` — un `actorId`
 *       d'ennemi EN BATAILLE via `seatOwns` (`netOwnership.ts:19`), un côté `worldSide` sans acteur via
 *       le marqueur `CascadeStep.worldOwner` + le sentinel `WORLD_STEP_OWNER` (`pendings.ts`), Ronde 1) ;
 *   I = inline-PV (`runCascadeImmediate`, aucune influence, conséquence appliquée d'office).
 * Consommé (mesure du 2026-08-04) par SIX flux : `innFlow`, `landMarketFlow`, `merchantFlow`,
 * `portFlow`, `seaVoyageFlow`, `tavernFlow`. Les autres flux hors-combat — activités d'interlude,
 * entretien, voyage terrestre et fluvial — n'appellent PAS la porte : leur population est inventoriée
 * dans `docs/registre-jets.md` (#1066). La garde d'exclusivité `roll-seam-exclusivity-guard.test.ts`
 * (#274) verrouille l'usage.
 *
 * ÉCARTS documentés vs le doc de conception (justifiés, à réconcilier aux rondes suivantes) :
 *  1. **`worldSide` → propriétaire MJ.** FERMÉ Ronde 1 : `buildMonoStep` marque `worldOwner:true` sur
 *     une étape `worldSide` sans `actorId` ; `modalArbiter.ts` (entrée `cascade`) route ce marqueur vers
 *     le sentinel `WORLD_STEP_OWNER`, que `netOwnership.seatOwns` résout au siège `gmSeat` (existant) ou
 *     à l'hôte (sinon) — couture la PLUS PETITE (aucune extension d'`intentAllowedFor`, le repli
 *     générique `seatOwns(s, seat, owner)` suffit déjà). `batch` (agrégat, pas de `worldOwner`) reste
 *     hors de cet écart — cf. 2.
 *  2. **`batch` utilise `CascadeStep.participants`.** FERMÉ Ronde 2 cran 2, DÉ-NAVALISÉ Ronde batch
 *     (#328) : `buildBatchStep` pose une étape À PARTICIPANTS GÉNÉRIQUES (`BatchParticipant`, flux
 *     `cascadeBatch`) — l'AGRÉGAT (`step.aggregate`) est calculé GÉNÉRIQUEMENT par
 *     `cascade.aggregateBatchStep` à la VALIDATION, kind-agnostique du nombre de contributeurs. Les
 *     paramètres de formule que `RollRequest` ne porte pas (Moral, Manque de bras, sabotage) transitent
 *     DÉJÀ CHIFFRÉS par le flux propriétaire via `meta` NEUTRE (`aggregateFlatDR`/`aggregateCapTo`/
 *     `aggregateOpposeSl`, `CascadeStepMeta`) ; par défaut 0/absent.
 */
import type { Get, Set } from './flowTypes';
import type { GameState } from './store';
import type { Combatant, CharKey, Difficulty, Weapon } from '../engine/types';
import { DIFFICULTY_MODIFIERS, CHAR_LABELS } from '../engine/types';
import type { PairedSense, GameOp } from '../engine/ops';
import type {
  CascadeStep, CascadeStepMeta, BatchParticipant, CascadeAggregate, CascadeSecondRead, PendingCascade, CascadeTableDecl, CascadeTableResult, RevealEntry,
  PendingDeviation, PendingBladeTrap, PendingCritSeverity, PendingMiscastStep, PendingMutationStep,
  StepEvaluation, SeuilDeSauvegarde, PendingWardSave,
} from './pendings';
import type { BuiltCascadeStep } from './stepBrand';
import type { PlayerText } from '../i18n/playerText';
import { PENDING_BY_JET, type HostJet } from './stateFields';
import type { OupsResolved } from '../engine/oups';
import type { RecapLine, RecapTone } from './recapLine';
import type { ModLine } from '../engine/combat';
import { combatBaseValue, combatValueModParts, conditionModLines, combatCharKey, combineMods, composeDifficulty } from '../engine/combat';
import { volatileCharLines } from '../engine/characteristics';
import { startCascade, runCascadeImmediate, rollBatchParticipant, pushStep, tableStepPosee, cascadeTableFolds, clampStepAmount, porteursDeLEtape, compteurDeSequence } from './cascade';
import { testValue, partyBest, partyAssisted, testValueSplit, testValueParts, skillBaseValue, supportSplit, type SupportDetail } from '../engine/skills';
import { testStatePenaltyParts, testStatePenalty } from '../engine/conditions';
import { tenuParUnHumain, porteurParId, seatOwns, conduitParLeSiegeDuMonde, WORLD_STEP_OWNER } from './netOwnership';
import { cadenceAuto } from '../engine/cadence';
import { seaAutoResolves } from './voyageCadence';
import { byId, conditionLabel, dataLabel, type StakeRef } from '../data';
import { t, type OutKey, type OutVars } from '../i18n';
import { rollTest, clampTarget } from '../engine/tests';
import { defaultRNG, type RNG, type DiceSpec } from '../engine/dice';
import type { TestResult } from '../engine/tests';
import { battleRng } from './battleRng';

/** Agrégation d'un jet multi (porte/contresort/équipage) — SEULE variation de la famille multi.
 *  Canonique dans `pendings.ts` (`CascadeAggregate`, ré-exportée ici pour compat des call-sites du
 *  seam) : `CascadeStep.participants` (Décision 4 cran 1) porte la MÊME union. */
export type RollAggregate = CascadeAggregate;

/** DESCRIPTION déclarative d'un jet. Le call-site remplit ceci et RIEN d'autre. */
export interface RollRequest {
  /** Le côté qui teste : un acteur DÉJÀ désigné (héros/PNJ), le MEILLEUR PJ du groupe pour une
   *  compétence/carac (« le plus qualifié tente », résolu ICI via `partyAssisted`/`partyBest` —
   *  jamais recalculé au call-site), le siège MONDE (ennemi/subi sans acteur), ou des participants (batch). */
  side:
    | { actorId: string }
    | { partyBest: { skill?: string; char?: CharKey; assisted?: boolean } }
    | { worldSide: 'enemy' | 'world' }
    | { participants: BatchParticipant[] };
  /** Le NOM DE L'ACTION SEUL (« Forcer le rythme », « Prière », « Désertion »…) — CHAMP STRUCTURÉ
   *  DISTINCT de `test` (fix de classe #352 : l'ancien `test.label` texte-libre pouvait se confondre
   *  avec la compétence). Rendu UNIQUEMENT en position de TITRE (`rollTitle`) — jamais recomposé avec
   *  le nom de l'acteur/la compétence/la difficulté au call-site. */
  actionLabel: string;
  /** Le TEST déclaré — SEULE source des ids compétence/carac (réf structurée, passe telle quelle à
   *  `testValue`). AUCUN champ de texte ici : le libellé de compétence affiché est TOUJOURS DÉRIVÉ de
   *  `skill`/`char` par `testSkillLabel` (catalogue `byId('skill', …)`/`CHAR_LABELS`) — insurchargeable,
   *  un call-site ne peut plus injecter de texte en position de compétence. */
  /** `noSupport` : Test de résistance (maladie/poison/peur/danger…) — coupe le Soutien du côté
   *  `partyBest` (LDB 12 l.197), pour éviter qu'un futur appelant câble un Soutien interdit. */
  test: { skill?: string; char?: CharKey; spec?: string; sense?: PairedSense; menace?: string; noSupport?: boolean };
  difficulty: Difficulty;
  /** Requis pour un côté `participants` ; défaut `summed-dr` (Test d'équipage, MDG 14). */
  aggregate?: RollAggregate;
  /** COMMENT le dé se LIT (#1426) — `'seuil'` = pourcentage pur (`dé ≤ nombre visé`, ni bande ni DR ni
   *  écrêtage), tel que le RAW l'écrit pour la recherche d'acheteur (MSRC 13 l.146 / MDG 15 l.362) et
   *  les chances d'auteur. Absent = `'test'` : rien ne change pour les appelants existants. */
  evaluation?: StepEvaluation;
  /** ENJEU du jet (#1117) — RÉFÉRENCE de donnée produite par une porte d'enjeu (`combatStakeRef`,
   *  `nightStakeRef`, `voyageStakeRef`…), jamais un texte : la porte du seam la POSE telle quelle sur
   *  l'étape qu'elle construit (mono comme batch). C'est ici que le flux appelant dit ce qu'il met en
   *  jeu — `buildMonoStep` est générique et n'a aucun moyen de le deviner. */
  stake?: StakeRef;
}

/** Trois surfaces (Décision 3) : Modale influençable / Visible-lançable MJ / Inline-PV. */
type Surface = 'M' | 'V' | 'I';

/** Cible EFFECTIVE d'un Test skill/char AVEC l'écrêtage RÉELLEMENT subi — même arithmétique que
 *  `rollTest`, par la primitive PARTAGÉE `clampTarget` (`engine/tests.ts`, plus de `clamp` recopié
 *  ici). L'écrêtage est RENDU, pas jeté : une base SOUTENUE peut franchir le plafond, et l'écart
 *  doit se NOMMER sur la ligne (« plafond 99 ») au lieu d'être avoué « autres » (#1117).
 *  `baseOverride` couvre les côtés SANS acteur (`worldSide` — via `meta.baseValue`) ou dont la valeur
 *  EST l'acteur+valeur choisis par la porte (`partyBest`) — RÉSERVÉ à ces deux cas (extension mandat
 *  coordinateur) : un côté `actorId` calcule TOUJOURS `testValue` ICI, jamais un `meta.baseValue`. */
export function effectiveTargetClamped(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): { target: number; clamped?: number } {
  const value = baseOverride ?? (actor ? testValue(actor, test.skill, test.char, test.spec, test.sense) : 0);
  return clampTarget(value + DIFFICULTY_MODIFIERS[difficulty]);
}

/** Cible EFFECTIVE seule — pour les sites dont la base ne peut pas franchir les bornes. */
export function effectiveTarget(actor: Combatant | undefined, test: RollRequest['test'], difficulty: Difficulty, baseOverride?: number): number {
  return effectiveTargetClamped(actor, test, difficulty, baseOverride).target;
}

/** Libellé de COMPÉTENCE/carac d'un Test DÉCLARÉ — DÉRIVÉ des ids `skill`/`char` (catalogue
 *  `byId('skill', …)`/`CHAR_LABELS`) uniquement, jamais d'un texte libre : `RollRequest['test']` ne porte
 *  aucun champ texte (fix de classe #352), donc AUCUN call-site ne peut se substituer à cette
 *  dérivation. `undefined` si le Test ne porte ni compétence ni caractéristique (ex. Désertion —
 *  cible posée par `meta.baseValue`). */
export function testSkillLabel(test: RollRequest['test']): string | undefined {
  return test.skill ? (byId('skill', test.skill)?.label ?? test.skill) : test.char ? CHAR_LABELS[test.char] : undefined;
}

/**
 * LE LIBELLÉ DU CÔTÉ ATTAQUANT d'un Test opposé à jet FIGÉ (`meta.opposed`) — SOURCE UNIQUE des trois
 * surfaces qui le nomment : la rangée témoin et l'en-tête A→B de la fenêtre (`CascadeModal`), et la
 * ligne de JOURNAL (jet inline de combat, manche de séquence). Un ordre, une vérité :
 *  1. le libellé AUTHORÉ, quand la donnée en porte un qu'aucune structure n'exprime (« Force/
 *     Athlétisme », une alternative — `FlowTest.opposed.attackerLabel` ; le nom d'une manœuvre) ;
 *  2. sinon la STRUCTURE figée du Test (`opposed.test`), passée au catalogue (`testSkillLabel`).
 * Dériver d'abord écraserait l'authoré à chaque fois : un `FlowTest.opposed` nomme TOUJOURS sa
 * Caractéristique (`attacker` est requis).
 */
export function opposedAttackerLabel(opp: { test?: RollRequest['test']; attackerLabel?: string } | undefined): string | undefined {
  return opp?.attackerLabel ?? (opp?.test ? testSkillLabel(opp.test) : undefined);
}

/** COMPOSE l'affichage détaillé d'une étape mono depuis les ids déclarés — SOURCE UNIQUE (mandat
 *  coordinateur) : plus un call-site n'assemble `${actor.name} — ${action} (${skill})` à la main.
 *  `action` = `req.actionLabel` (nom seul) ; le détail (compétence/carac) est omis si le Test ne porte
 *  ni compétence ni caractéristique. Position : `step.label` (sous-titre d'étape) — JAMAIS le titre de
 *  cascade (`rollTitle`, plus court, pas de duplication).
 *  La DIFFICULTÉ n'est PAS ici (#1072) : elle vit sur la LIGNE du jet (`CascadeStep.difficulty` →
 *  `RollLine`). L'écrire aussi dans ce sous-titre serait le double rendu de classe #352.
 *
 *  MINTEUR (c) de `PlayerText` (#1318 V8a₀) — la FABRIQUE DE FORME du seam : elle est déjà l'unique
 *  composeur de ce sous-titre, elle en devient donc l'unique origine typée. Le texte `action` qu'on
 *  lui passe reste `string` pour ce lot : c'est lui que V8a₁ marque à son tour, minteur par minteur. */
export function composeRollLabel(actor: Combatant | undefined, action: string, test: RollRequest['test']): PlayerText {
  const detail = testSkillLabel(test);
  return `${actor ? `${actor.label} — ` : ''}${action}${detail ? ` (${detail})` : ''}` as PlayerText;
}

/*
 * FABRIQUES DE FORME du libellé d'étape (#1318 V8a₁) — minteur (c), la famille de `composeRollLabel`.
 * Chacune rend un GABARIT du catalogue (`step.*`, `i18n/messages/fr.ts`) : une étape N+1 d'une forme
 * déjà connue est UN appel, ZÉRO clé neuve. Les parties variables sont elles-mêmes des `PlayerText` —
 * un littéral FR ne s'y glisse pas, et une 2ᵉ langue réordonne le gabarit sans toucher aux call-sites.
 */

/** « {sujet} — {detail} » : le sujet d'une étape et la précision qui le qualifie. */
export function stepDetail(sujet: PlayerText, detail: PlayerText): PlayerText {
  return t('step.sujetDetail', { sujet, detail });
}

/** « {sujet} ({precision}) » : le sujet d'une étape et sa parenthèse (localisation, source, variante). */
export function stepPrecision(sujet: PlayerText, precision: PlayerText): PlayerText {
  return t('step.sujetPrecision', { sujet, precision });
}

/** « Manche {n} — {quoi} » : une étape d'un sous-système à manches numérotées (poursuite, jeu). */
export function stepManche(n: number | string, quoi: PlayerText): PlayerText {
  return t('step.manche', { n, quoi });
}

/** « {n}/{m} » : un RANG dans un total (phase courante, lancer d'une volée). Purement numérique — le
 *  gabarit ne porte AUCUN mot, il porte le séparateur, qui est ce qu'une 2ᵉ langue déplace. C'est la
 *  raison d'être d'une fabrique ici plutôt que d'un gabarit au flux : sans elle, chaque site qui
 *  compte « n sur m » écrirait sa propre barre oblique hors du catalogue. */
export function stepFraction(n: number | string, m: number | string): PlayerText {
  return t('step.fraction', { n, m });
}

/** « Prolonger {quoi} [?] » : reconduire un effet en cours — la variante interrogative est la DÉCISION,
 *  l'affirmative le Test qui la suit. */
export function stepProlonger(quoi: PlayerText, question = false): PlayerText {
  return t(question ? 'step.prolongerQ' : 'step.prolonger', { quoi });
}

/** « Terreur/Peur {indice} » : l'entrée de psychologie affrontée, nommée par son type et son Indice. */
export function stepPsych(kind: 'terreur' | 'peur' | string, indice: number | string): PlayerText {
  return t('step.psychIndice', { kind: t(kind === 'terreur' ? 'step.terreur' : 'step.peur'), indice });
}

/**
 * TITRE d'un jet — SOURCE UNIQUE (#295 Lot 0, Décision 1a ; réduit au fix de classe #352). C'est
 * `req.actionLabel` SEUL — jamais recomposé avec acteur/compétence/difficulté : ce détail vit DÉJÀ
 * dans `step.label` (`buildMonoStep`, via `composeRollLabel`), rendu en SOUS-TITRE par `CascadeModal`.
 * Un titre composé comme `step.label` produirait un DOUBLE RENDU exact (#352 — bug rapporté : la même
 * ligne « Héros — Action (Compétence Difficulté) » deux fois dans la modale).
 */
export function rollTitle(get: Get, req: RollRequest): string {
  void get;
  return req.actionLabel;
}

/**
 * Conséquence d'une étape DÉJÀ appliquée (#295 Lot 0, Décision 1b) — soit un effet mécanique (`ops`,
 * montant RÉEL rendu depuis le `GameOp` appliqué), soit une note narrative (`say`, clé `out.*` SANS
 * placeholder de jet — cf. garde i18n `i18n.test.ts`). AUCUN accès à roll/target/sl/won : la
 * duplication d'outcome (`${roll}/${target}`, « réussi (DR X) ») est INEXPRIMABLE par construction.
 * `tone`/`icon` (#349) habillent l'affichage de la ligne — `RecapTone` = vocabulaire UNIQUE, celui de
 * `NightEntry.tone`/`RecapLine.tone` (`state/recapLine.ts`), jamais un second jeu de valeurs.
 */
export type Consequence =
  | { ops: GameOp[]; tone?: RecapTone }
  | { say: OutKey; vars?: OutVars; tone?: RecapTone; icon?: string };

/** Ligne d'un `GameOp` DÉJÀ appliqué — le montant est un LITTÉRAL résolu par l'applier (jamais une
 *  `Formula` à re-tirer ici : `resultLine` ne reçoit ni cible ni RNG, cf. Décision 1b). Étend au fil
 *  des Lots de migration (#295 Lot 1) — un `op` sans formatteur reste silencieux (`''`), jamais un crash. */
function opConsequenceLine(op: GameOp): string {
  switch (op.op) {
    case 'wounds': return typeof op.amount === 'number' && op.amount > 0 ? t('out.consWounds', { n: op.amount }) : '';
    case 'heal': return typeof op.amount === 'number' && op.amount > 0 ? t('out.consHeal', { n: op.amount }) : '';
    case 'condition': return typeof op.id === 'string' ? t('out.consCondition', { cond: conditionLabel(op.id) }) : '';
    default: return '';
  }
}

/** Ton PAR DÉFAUT d'une conséquence `ops` sans `tone` explicite — dérivé du GameOp lui-même (soin =
 *  positif, Blessures/État = négatif), jamais deviné au call-site. */
function defaultOpsTone(ops: GameOp[]): RecapTone {
  if (ops.some((o) => o.op === 'heal')) return 'ok';
  if (ops.some((o) => o.op === 'wounds' || o.op === 'condition')) return 'bad';
  return 'info';
}

/**
 * Rend la ou les conséquences d'une étape DÉJÀ dénouée en LIGNES STRUCTURÉES (#349) — LA forme
 * consommée par le renderer partagé (`ui/RecapLine.tsx`) : `CascadeStep.outcome`, `TravelRecapDay.
 * lines`. Une entrée VIDE (`text` vide) est filtrée — `cons` vide ⇒ `[]`.
 *
 * Le TON reste celui qui a été AUTHORÉ (#1078 LOT B2) : une conséquence `say` sans `tone` n'en reçoit
 * pas — dans le cadre d'issue d'une modale de jet, elle se rend donc à PLEINE couleur, comme les
 * lignes de `recapLineOfEvent`. L'atténuation (`tone: 'info'`) est une décision de site, jamais un
 * défaut technique. Une conséquence `ops`, elle, DÉRIVE son ton de l'op appliquée (soin/dégâts).
 */
export function resultLines(cons: Consequence[]): RecapLine[] {
  return cons
    .map((c): RecapLine => ('say' in c
      ? { text: t(c.say, c.vars), ...(c.tone ? { tone: c.tone } : {}), ...(c.icon ? { icon: c.icon } : {}) }
      : { text: c.ops.map(opConsequenceLine).filter(Boolean).join(' '), tone: c.tone ?? defaultOpsTone(c.ops) }))
    .filter((l) => l.text.length > 0);
}

/**
 * Rend la ou les conséquences d'une étape DÉJÀ dénouée EN UNE CHAÎNE — repli pour les ~100 call-sites
 * NON convertis au rendu structuré (journal texte, `get().log()`) : joint `resultLines` (#349, source
 * UNIQUE — ne recalcule rien). Le verdict ✓/✗ ±DR reste porté par la rangée de jet (`RollLine`) seule.
 */
export function resultLine(cons: Consequence[]): string {
  return resultLines(cons).map((l) => l.text).join(' ');
}

/** Une entrée `freeCons` : un texte SIMPLE (repli neutre) ou une ligne déjà TONÉE/ICÔNÉE (#349, dette
 *  1 — le flux DÉRIVE le ton depuis ce qu'il vient de résoudre, ex. `step.result.success`, au lieu de
 *  composer une chaîne muette). */
export type FreeConsLine = string | { text: string; tone?: RecapTone; icon?: string };

/** Enveloppe des lignes de conséquence DÉJÀ composées (sans roll/target/sl du jet visible) en
 *  `Consequence[]` (#295 Lot 1, `out.free` passthrough) — SOURCE UNIQUE, réutilisée par tous les
 *  appliers de cascade migrés (river/travel/sea/shipwreck/pursuit/combat/rest/embrigadement). */
export const freeCons = (texts: FreeConsLine[]): Consequence[] => texts
  .map((x): { text: string; tone?: RecapTone; icon?: string } => (typeof x === 'string' ? { text: x } : x))
  .filter((x) => x.text.length > 0)
  .map(({ text, tone, icon }) => ({ say: 'out.free' as OutKey, vars: { text }, tone, icon }));

/** Résout le côté d'un jet MONO (`hero-test`/`enemy`/`subi` non-`batch`) en acteur + éventuelle valeur
 *  DÉJÀ CALCULÉE (mandat coordinateur — le call-site ne calcule plus rien) :
 *   - `actorId` : l'acteur désigné, valeur = `testValue` (calculée par `effectiveTarget`, pas ici) ;
 *   - `partyBest` : le meilleur PJ du groupe pour la compétence/carac (`partyAssisted` par défaut —
 *     LDB 12, soutien — `assisted:false` pour `partyBest` nu), valeur DÉJÀ résolue (inclut le soutien) ;
 *   - `worldSide` : aucun acteur — `meta.baseValue` (seuil posé par le call-site, ex. désertion d100). */
function resolveMonoSide(get: Get, req: RollRequest, meta?: CascadeStepMeta): { actorId?: string; actor?: Combatant; baseValue?: number; support?: SupportDetail } {
  if ('actorId' in req.side) {
    return { actorId: req.side.actorId, actor: porteurParId(get(), req.side.actorId) };
  }
  if ('partyBest' in req.side) {
    const { skill, char, assisted } = req.side.partyBest;
    // La SPÉCIALISATION et le SENS déclarés sur le Test entrent dans le choix du meneur ET dans sa
    // valeur : sans eux, `partyBest`/`partyAssisted` liraient une AUTRE instance de la compétence
    // (Métier (Charpentier) vs Métier (Serrurier)) et la valeur du meneur divergerait de celle que
    // `rollLine` décompose ensuite — la garde d'exactitude le refuserait, à raison.
    // `noSupport` (LDB 12 l.197) : Test de résistance déclaré sur le spec → jamais de Soutien, même si
    // `assisted` n'a pas été mis à `false` au call-site.
    if (assisted === false || req.test.noSupport) {
      const solo = partyBest(get().party, skill, char, undefined, req.test.spec, req.test.sense);
      return solo ? { actorId: solo.actor.id, actor: solo.actor, baseValue: solo.value } : {};
    }
    const picked = partyAssisted(get().party, skill, char, undefined, req.test.spec);
    if (!picked) return {};
    // Le DÉTAIL du Soutien remonte avec la valeur : la porte le pose sur l'étape (`buildMonoStep`),
    // la modale l'affiche en ligne de mod — un Soutien fondu sans détail est un bonus invisible.
    return { actorId: picked.actor.id, actor: picked.actor, baseValue: picked.value, support: picked.support };
  }
  return { baseValue: typeof meta?.baseValue === 'number' ? meta.baseValue : undefined };
}

/**
 * LES PORTEURS d'une requête — les ids dont la TENUE décide de la surface (#1479) : les contributeurs
 * d'un côté à participants, ou l'unique porteur du mono (l'acteur nommé/élu, ou la SENTINELLE du monde
 * `WORLD_STEP_OWNER` pour un côté `worldSide` — un id de porteur comme un autre).
 */
function porteursDeLaRequete(get: Get, req: RollRequest): (string | undefined)[] {
  if ('participants' in req.side) return req.side.participants.map((p) => p.id);
  if ('worldSide' in req.side) return [WORLD_STEP_OWNER];
  return [resolveMonoSide(get, req).actor?.id];
}

/**
 * LA SURFACE D'UN JET, DÉRIVÉE DE SES PORTEURS (#1479) — il n'existe plus de CLASSE de jet : « on n'a
 * pas 36 types de jets différents dans l'application ; à partir du moment où je dois faire un jet, il
 * doit apparaître » (utilisateur, 2026-08-24). Trois queues, dans cet ordre, toutes adossées aux
 * prédicats EXISTANTS :
 *  1. cadence déférée à un automate (`cadenceAuto`, GLOBALE) → I — posée par l'appelant qui la subit
 *     (`surfaceDesPorteurs` ; une SÉQUENCE ne la subit pas, cf. `surfaceDesEtapes`) ;
 *  2. politique d'ORDRES d'une traversée (`seaAutoResolves` sur CHAQUE `kind` poussé — commandée =
 *     « sans fenêtre », attendu validé en recette #1426) → I ;
 *  3. sinon la TENUE des porteurs (`surfaceOf`, donc `netOwnership.tenuParUnHumain`) : aucun porteur
 *     tenu par un humain → I (le socle résout d'office, le bilan le montre) ; sinon la fenêtre s'ouvre
 *     — V quand le siège MJ tient ET CONDUIT tous les porteurs surfacés (monde, ennemi de bac-à-sable :
 *     il la voit et la lance), M sinon (le porteur a son propre joueur, ici ou à un autre siège).
 * Aucune branche par TYPE de porteur ni par situation : un héros, un ennemi, le monde, un Test subi
 * face à une maladie passent par CE calcul.
 */
function surfaceDesTenus(s: GameState, tenus: readonly (string | undefined)[], kinds: readonly string[], partage = false): Surface {
  // Politique d'ORDRES d'une traversée : COMMANDÉE, les `kind` qu'elle couvre se résolvent d'office
  // (attendu validé en recette #1426 « Traversée commandée sans fenêtre »). Une séquence MIXTE garde
  // sa fenêtre — un seul jet hors des ordres suffit à la rouvrir (patron `riverAutoResolves`).
  if (kinds.length > 0 && kinds.every((k) => seaAutoResolves(s.travelPlan?.orders, k))) return 'I';
  // MOMENT PARTAGÉ (cf. `surfaceDesEtapes`) : la possession DÉCLARÉE est « tous les sièges » — la
  // fenêtre est à la table entière, donc jamais celle du seul MJ.
  if (partage) return 'M';
  if (!tenus.length) return 'I';
  const gmSeat = s.net.gmSeat ?? null;
  // V : le siège MJ tient TOUS les porteurs surfacés ET les CONDUIT (monde, ennemi de bac-à-sable —
  // `netOwnership.conduitParLeSiegeDuMonde`, la route de possession, pas le TYPE lu au call-site) : il
  // voit et lance. Un héros est ATTRIBUÉ à un siège par `net.ownership` : il garde SA fenêtre (M) même
  // quand ce siège est aussi le siège MJ (hôte-MJ solo, `gmSeat === ownership[héros]`) — c'est son
  // joueur qui la roule.
  if (gmSeat != null && tenus.every((id) => seatOwns(s, gmSeat, id) && conduitParLeSiegeDuMonde(s, id))) return 'V';
  // SURFACE, pas affordance locale (#1262) : le héros d'un AUTRE siège garde sa fenêtre — c'est SON
  // joueur qui la roulera. `pilotedByHuman`/`humanControlled` répondent « qui a la main ICI » et
  // volaient donc le jet de l'invité, résolu en silence chez l'hôte.
  return 'M';
}

export function surfaceDesPorteurs(get: Get, porteurs: readonly (string | undefined)[], kinds: readonly string[]): Surface {
  if (cadenceAuto()) return 'I';
  return surfaceDesTenus(get(), porteurs.filter((id) => surfaceOf(get, id)), kinds);
}

/** La surface d'une REQUÊTE : ses porteurs réels passés au calcul unique ci-dessus. */
export function resolveSurface(get: Get, req: RollRequest, kind: string): Surface {
  return surfaceDesPorteurs(get, porteursDeLaRequete(get, req), [kind]);
}

/**
 * LA SURFACE D'UNE SÉQUENCE DÉJÀ MINTÉE (#1479) — MÊME calcul, porteurs et `kind` lus sur les étapes
 * elles-mêmes (`porteursDeLEtape`, rangées de bande comprises) : un émetteur POUSSE ce qu'il met en
 * jeu, il ne tranche plus.
 *
 * SEULE différence avec la surface d'une requête, et elle est la divergence 2 ASSUMÉE de la famille de
 * bandes (cf. `openBand`) : la cadence déférée (`cadenceAuto`) n'y entre pas — une séquence de
 * nuit/voyage garde sa fenêtre, que le pilote d'auto-cadence DÉROULE en montrant son bilan
 * (`combatAuto.willAutoResolve`), au lieu de l'effacer. La TENUE, elle, est le même prédicat
 * (`netOwnership.tenuParUnHumain`).
 */
export function surfaceDesEtapes(get: Get, steps: readonly CascadeStep[]): Surface {
  const s = get();
  const tenus = steps.flatMap(porteursDeLEtape).filter((id) => tenuParUnHumain(s, id));
  // MOMENT PARTAGÉ : une étape qui DÉCLARE `groupOwner` SANS rangées (l'incantation d'un ennemi,
  // `combatFlow.openCastCascade`) est possédée par TOUS les sièges (`modalArbiter` → `'*'`) : elle est
  // tenue par construction, quel que soit son porteur. Une BANDE, elle, répond par ses rangées.
  const partage = steps.some((st) => st.groupOwner && !st.participants);
  return surfaceDesTenus(s, tenus, steps.map((st) => st.kind), partage);
}

/**
 * LA DÉFINITION DE SURFACE (#1262) — un jet se surface (fenêtre/rangée à jouer) quand un siège humain
 * TIENT son porteur (`netOwnership.tenuParUnHumain`, SEAT-AGNOSTIQUE) ET que la cadence n'est pas déférée
 * à un automate (`cadenceAuto`, cadence GLOBALE : il n'existe pas de cadence par siège — #1264).
 *
 * SOURCE UNIQUE pour le MONO (`resolveSurface`, `rollSansPilote`) comme pour les RANGÉES
 * (`surfaceRow`) et pour les TIRAGES d'étape (`cascade.tirageSansSiege`). Ce qu'elle N'EST PAS : un
 * prédicat d'affordance LOCALE (`pilotedByHuman`, `humanControlled`) — ceux-là disent « qui a la main
 * devant CET écran », et bâtir le surfaçage dessus fait rouler en silence, chez l'hôte, le jet du
 * héros d'un invité.
 *
 * ELLE EST KEYÉE PAR LE PORTEUR (#1426), jamais par son TYPE — un héros (en combat comme hors
 * combat), un ennemi, le MONDE passent par le MÊME appel, et la RÉSOLUTION du porteur comme celle du
 * siège qui le tient appartiennent au module de possession (`netOwnership.tenuParUnHumain`, qui y
 * route la sentinelle du monde). Cette fonction n'ajoute donc QUE la cadence : la fenêtre s'ouvre si
 * un siège humain tient le porteur et que la cadence n'est pas déférée à un automate. L'option de
 * confort « Dés fixés » n'entre PAS dans la surface : elle ne gate que la POSE du dé
 * (`netOwnership.canFixDie`, au site unique de la pose `ui/forcedDieRow`), jamais le fait de VOIR le jet.
 *
 * `isOutOfAction` n'entre PAS ici : « le sujet peut-il encore jouer » est un critère MÉTIER, tranché
 * au site ; les sites divergent (#1265).
 */
export function surfaceOf(get: Get, porteurId: string | undefined): boolean {
  if (cadenceAuto()) return false;
  return tenuParUnHumain(get(), porteurId);
}

/**
 * CONSTRUCTEUR de rangée surfacée ou TÉMOIN (#1262) — patron possédé par le socle (calque
 * `pursuitFlow.pursuitRow`) : une rangée qu'aucun siège ne tient NAÎT roulée (`interactive:false` +
 * son `result`), sinon elle naît à jouer (`interactive:true`, `result` encore nul). Un témoin né sans
 * résultat suspendrait sa bande (`stepReady` n'attend jamais un témoin, mais l'agrégat le compte).
 *
 * Une rangée qui porte DÉJÀ un résultat (bande restaurée d'une sauvegarde) le garde : pas de second
 * dé, pas de seconde voie de témoin.
 */
export function surfaceRow(get: Get, porteurId: string | undefined, row: BatchParticipant): BatchParticipant {
  if (surfaceOf(get, porteurId)) return { ...row, interactive: true, result: row.result ?? null };
  return { ...row, interactive: false, result: row.result ?? rollBatchParticipant(row, battleRng()) };
}

/** La marque d'étape mintée vit dans un module FEUILLE (`stepBrand.ts`) : `revealStep.ts` minte lui
 *  aussi et ne peut pas tirer ce fichier. Ré-exportée ici, où vit la famille d'ouvertures. */
export type { BuiltCascadeStep };

/** DÉCLARATION d'une bande : ce que l'appelant sait de la SITUATION (l'entrée de règle mise en jeu).
 *  La POSSESSION (`groupOwner`) n'y est pas — c'est `bandStep` qui la pose. */
export interface BandSpec {
  /** Id de l'étape. Dédoublé en `#n` par `bandStepId` quand la même clé revient dans une séquence. */
  id: string;
  kind: string;
  /** Intitulé de la SITUATION. Absent : l'étape n'en porte pas, et la fenêtre qui l'accueille prend
   *  son repli (`cascade.ts` : « Conséquences »). Une chaîne VIDE, elle, s'affiche vide. */
  label?: PlayerText;
  icon?: string;
  /** Défaut `'none'` : les rangées d'une bande sont des jets INDÉPENDANTS (#351). */
  aggregate?: RollAggregate;
  stake?: StakeRef;
  menace?: string;
  /** CHARGES d'applier — l'entrée de règle affrontée (type, source, cible, Indice) dont chaque rangée
   *  joue le Test : « Psychologie de combat » (`combatFlow`) et « Psychologie de rencontre »
   *  (`encounterPsychFlow`). Recopiées telles quelles — une charge n'est pas une forme : elle ne rend
   *  rien et ne change pas l'interaction de la bande, elle est ce que l'applier LIT pour chaque rangée
   *  résolue. */
  combatPsych?: CascadeStep['combatPsych'];
  encounterPsych?: CascadeStep['encounterPsych'];
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR DE BANDE (#1262) — UNE fenêtre, une RANGÉE par porteur, et la POSSESSION posée ICI.
 *
 * L'arbitre (`modalArbiter`, entrée `cascade`) prend l'owner de l'étape : `'*'` si `groupOwner`, sinon
 * son `actorId`, sinon `undefined` — et `undefined` rend la fenêtre à l'HÔTE SEUL
 * (`netOwnership.ownsLocally`). Une bande doit donc TOUJOURS dire à qui elle appartient :
 *  - plus d'UN porteur (seul cas où plus d'un siège peut être concerné) → `groupOwner` ;
 *  - un SEUL porteur → `actorId` = ce porteur (une bande d'un seul porteur EST son porteur) ; sans
 *    lui, le siège qui possède ce porteur ne voit jamais la fenêtre où se tient sa rangée.
 * L'influence reste routée rangée par rangée (`netOwnership.seatInfluences`) : un siège ne dépense
 * jamais les ressources d'autrui, même sous owner `'*'`.
 *
 * `groupOwner` ne se DÉCLARE que sur une étape HÔTE (`hostStep`, moment PARTAGÉ) ; partout ailleurs il
 * se DÉDUIT des rangées, ici.
 *
 * `undefined` sans rangée : il n'y a pas de fenêtre à ouvrir sur zéro jet.
 */
export function bandStep(spec: BandSpec, rows: readonly BatchParticipant[]): BuiltCascadeStep | undefined {
  if (!rows.length) return undefined;
  const porteurs = new Set(rows.map((r) => r.id));
  return {
    id: spec.id,
    kind: spec.kind,
    ...(spec.label !== undefined ? { label: spec.label } : {}),
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(porteurs.size > 1 ? { groupOwner: true } : { actorId: rows[0].id }),
    aggregate: spec.aggregate ?? 'none',
    participants: [...rows],
    ...(spec.stake ? { stake: spec.stake } : {}),
    ...(spec.menace ? { menace: spec.menace } : {}),
    ...(spec.combatPsych ? { combatPsych: spec.combatPsych } : {}),
    ...(spec.encounterPsych ? { encounterPsych: spec.encounterPsych } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/**
 * DÉDOUBLEMENT de CLÉ de bande (#1262) — pli commun des fabriques (calque `nightBands`) : deux jets de
 * MÊME clé pour le MÊME porteur (deux Convalescences échéant le même jour) ne peuvent pas cohabiter
 * dans une bande, les surfaces de rangée keyant par id NU — ils ouvrent une bande de PLUS.
 * Rend la clé libre pour ce porteur (`clé`, `clé#2`, `clé#3`…) ; `bandes` est la Map en cours de
 * construction, keyée par cette même clé.
 *
 * PORTÉE : la clé de REGROUPEMENT, pas l'`id` de l'étape produite. Ce qu'une fabrique fait du rang de
 * dédoublement lui appartient — et si elle le remplace par un autre discriminant (`nightBands` pose le
 * JOUR quand il existe), deux bandes distinctes peuvent ressortir sous le MÊME id.
 *
 * DETTE OUVERTE, mesurable : l'unicité des ids dans une séquence n'est tenue par AUCUN type ni aucune
 * garde générale — la classe #1277 n'est fermée que pour la clé de regroupement des bandes de NUIT
 * (`nightBands.ts`, deux espaces de noms séparés, mesuré par `night-bands.test.ts`). Toute autre
 * fabrique qui dérive un id de cette clé reste libre de produire une collision.
 */
export function bandStepId<T extends { readonly rows: readonly BatchParticipant[] }>(
  bandes: ReadonlyMap<string, T>,
  cle: string,
  porteurId: string,
): string {
  let key = cle;
  let n = 1;
  while (bandes.get(key)?.rows.some((r) => r.id === porteurId)) key = `${cle}#${++n}`;
  return key;
}

/**
 * `meta` COMMUN à N rangées d'une bande (#1262) — second pli des fabriques, jumeau de `bandStepId` :
 * l'entrée de RÈGLE mise en jeu (ce que TOUTES les rangées partagent) remonte sur la bande, ce qui
 * DIVERGE d'un porteur à l'autre reste sur la rangée. `undefined` quand rien n'est commun.
 *
 * Comparaison par forme sérialisée : le `meta` d'une étape est JSON-sûr par contrat (`CascadeStepMeta`
 * — un pending est snapshoté), donc deux valeurs de même JSON sont la même charge.
 */
export function bandCommonMeta(metas: readonly (CascadeStepMeta | undefined)[]): CascadeStepMeta | undefined {
  const first = metas[0];
  if (!first) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(first)) {
    const j = JSON.stringify(v);
    if (metas.every((m) => m && JSON.stringify(m[k]) === j)) out[k] = v;
  }
  return Object.keys(out).length ? (out as CascadeStepMeta) : undefined;
}

/** Champs du jet MONO qui DESCENDENT sur la rangée quand une bande regroupe des étapes déjà montées —
 *  le reste (icône, enjeu, libellé de situation) appartient à la bande : c'est l'entrée de règle qui
 *  les porte. Les champs de JEU DÉJÀ POSÉ (influences, issue) descendent aussi : vides sur une étape
 *  fraîchement construite, peuplés sur une étape venue d'une sauvegarde. */
const ROW_DEPUIS_ETAPE = [
  'base', 'target', 'mods', 'clamped', 'difficulty', 'menace',
  'rerolled', 'forced', 'fixed', 'outcome',
] as const;

/** RANGÉE dérivée d'une étape MONO — le jet descend, la situation reste à la bande. Le `meta` ENTIER
 *  voyage sur la rangée : ce qui diverge d'un porteur à l'autre n'est lisible que là. SOURCE UNIQUE
 *  des fabriques qui bandifient des étapes (nuit, fin de combat, poursuite). */
export function bandRowOfStep(step: CascadeStep): BatchParticipant {
  const row: Record<string, unknown> = { id: step.actorId, interactive: true, result: step.result ?? null, label: step.rollLabel };
  for (const f of ROW_DEPUIS_ETAPE) if (step[f] !== undefined) row[f] = step[f];
  if (step.meta) row.meta = step.meta;
  return row as unknown as BatchParticipant;
}

/** DÉCLARATION d'une FABRIQUE DE BANDES (#1262) — ce qu'une famille sait de son regroupement. */
export interface BandFactoryDecl<I> {
  /** Item HORS périmètre : l'étape à rendre TELLE QUELLE, à sa place (identité préservée — une
   *  migration de sauvegarde compare les références pour savoir si rien n'a bougé). `null` = l'item
   *  entre en bande. Absent : tous les items entrent (la fabrique ne reçoit que du dû). */
  passe?: (item: I) => BuiltCascadeStep | null;
  /** CLÉ de regroupement — l'ENTRÉE DE RÈGLE mise en jeu : deux items de même clé font UNE fenêtre. */
  cle: (item: I) => string;
  /** RANGÉE de cet item (son porteur = `row.id`, qui sert aussi au dédoublement de clé). */
  rangee: (item: I) => BatchParticipant;
  /** SITUATION de la bande, DÉCLARÉE par le premier item de sa clé. `rang` = rang de dédoublement de
   *  la clé (`bandStepId` : 1, 2, 3…), `index` = ordinal de la bande dans la sortie. */
  situation: (item: I, rangs: { rang: number; index: number }) => BandSpec;
  /** `meta` de la bande dérivé de TOUS ses items (typiquement `bandCommonMeta`). Absent : la situation
   *  porte le sien. */
  meta?: (items: readonly I[]) => CascadeStepMeta | undefined;
}

/**
 * FABRIQUE DE BANDES (#1262) — le pli que CINQ familles réécrivaient (nuit, fin de combat, poursuite,
 * Psychologie de rencontre, Psychologie de combat) : la Map keyée par entrée de règle, le
 * DÉDOUBLEMENT de clé (`bandStepId` : deux jets de même clé pour le même porteur ouvrent une bande de
 * PLUS — deux rangées de même id seraient injoignables, les surfaces keyant par id nu), l'ORDRE de
 * PREMIÈRE émission (place réservée), et la SORTIE par le mint (`bandStep`, qui pose la POSSESSION).
 *
 * Chaque famille DÉCLARE seulement ce qui lui est propre (clé, rangée, situation, `meta` commun) :
 * la possession et l'invariant d'unicité de rangée ne sont plus refaits à la main, donc plus
 * oubliables — c'est ce qui manquait à la Psychologie de rencontre et aux manches de poursuite
 * restaurées (fenêtres HÔTE SEUL, classe #1268).
 */
export function makeBandFactory<I>(decl: BandFactoryDecl<I>): (items: readonly I[]) => BuiltCascadeStep[] {
  return (items: readonly I[]): BuiltCascadeStep[] => {
    const out: (BuiltCascadeStep | undefined)[] = [];
    const bandes = new Map<string, { spec: BandSpec; rows: BatchParticipant[]; items: I[]; at: number }>();
    for (const item of items) {
      const intacte = decl.passe?.(item) ?? null;
      if (intacte) { out.push(intacte); continue; }
      const row = decl.rangee(item);
      const cle = decl.cle(item);
      const key = bandStepId(bandes, cle, row.id);
      const tenue = bandes.get(key);
      if (tenue) { tenue.rows.push(row); tenue.items.push(item); continue; }
      const rang = key === cle ? 1 : Number(key.slice(cle.length + 1));
      bandes.set(key, { spec: decl.situation(item, { rang, index: bandes.size }), rows: [row], items: [item], at: out.length });
      out.push(undefined); // place RÉSERVÉE : la bande la prend une fois toutes ses rangées connues
    }
    for (const { spec, rows, items: siens, at } of bandes.values()) {
      const meta = decl.meta?.(siens);
      out[at] = bandStep(meta ? { ...spec, meta } : spec, rows);
    }
    return out.filter((s): s is BuiltCascadeStep => !!s);
  };
}

/** Ajoute une étape SI son mint l'a acceptée (#1262) — une déclaration REFUSÉE (`refusePorte` a déjà
 *  crié) ne laisse pas de trou dans la journée, et l'idiome ne se réécrit pas d'un flux à l'autre. */
export function pousseSi(out: BuiltCascadeStep[], st: BuiltCascadeStep | undefined): void {
  if (st) out.push(st);
}

/** Ce qui est VRAI de tout jet : qui teste quoi, à quelle Difficulté, et ce qui pèse SUR LA CIBLE. */
interface RollLineBase {
  /** Le jeteur. Absent (côté MONDE : seuil d100 posé par l'appelant) ⇒ `valeur` tient lieu de base. */
  actor?: Combatant;
  /** Ids du Test — MÊME forme que `RollRequest['test']` (aucun texte : la ligne se NOMME depuis le catalogue). */
  test?: { skill?: string; char?: CharKey; spec?: string; sense?: PairedSense };
  difficulty: Difficulty;
  /** Modificateurs NOMMÉS qui s'ajoutent À LA CIBLE et que la valeur ne contient PAS (dérive MSRC 7
   *  l.38, hors de contrôle l.41, −5 cumulatif du redressement l.40, km déjà au pas de course EDOC 7
   *  l.229). Les déclarer ici les compte UNE fois — dans la cible et sur la ligne. */
  surLaCible?: ModLine[];
  /** PLAFONNEMENT des `surLaCible` (`LDB 14 l.91-96`) : le monteur combine lui-même les
   *  modificateurs (`combineMods`, plafonds data-driven `combat-diff-cap-bonus`/`-malus`, appliqués
   *  aux seules `famille: 'circonstance'`) et, quand la combinaison diffère de la somme brute, ÉMET
   *  l'écart en ligne NOMMÉE « plafond Difficultés » liée à sa fiche de règle. Sans ce mode, un
   *  appelant qui plafonnait sa cible à la main laissait l'amputation en chip « autres ». Réservé aux
   *  jets de COMBAT : valeur MAISON (`LDB 12` silencieux sur le cumul ; `l.137`
   *  est permissif hors combat ; la combinaison vit au chapitre Combat, `LDB 14 l.48` et `l.95`). */
  plafond?: 'difficultes';
}

/**
 * CANAL de valeur d'un jet de COMBAT (#1153 L1a) — le combat ne se calcule pas avec `testValue` :
 *  - `'melee'`/`'ranged'` : valeur d'ATTAQUE/de tir — base `combatBaseValue` (`engine/combat.ts`,
 *    Caractéristique + Spé du Groupe de l'arme) et composantes `combatValueModParts` ;
 *  - `'test'` : Test de combat NON-attaque (gate d'Action, Résistance de fin de rencontre) — base
 *    `rawCombatTestBase` (`engine/skills.ts` : `testValue` privée de la pénalité d'États HORS combat)
 *    et pénalité d'États en version COMBAT (`conditionModLines` → `combatTestPenaltyParts`), comptée
 *    une seule fois. Le contrat des deux grandeurs est celui du moteur, pas de ce monteur.
 *
 * BRANCHÉ à `volatileCharLines` (`engine/characteristics.ts:68`) sur `'melee'`/`'ranged'` (#1153 L3a) :
 * ces lignes décomposent l'intérieur de la CARACTÉRISTIQUE (`effectiveChar`), donc de la valeur NUE.
 * Le canal les SORT de la base autant qu'il les pose en lignes — la valeur de combat et la cible
 * restent identiques au point près, seule la répartition base/chips change.
 */
export type RollLineCombat = { kind: 'melee' | 'ranged'; weapon?: Weapon } | { kind: 'test'; weapon?: never };

/** LA valeur du jet — trois régimes EXCLUSIFS, et le compilateur tient l'exclusion :
 *  - DÉRIVÉE de l'acteur (`testValue`) : rien d'autre à déclarer ;
 *  - DÉRIVÉE du COMBAT (`combat`) : la valeur suit le canal, l'appelant peut la fournir FONDUE
 *    (`valeur`, ex. Soutien des servants d'une pièce) — l'oracle du canal vérifie qu'elle s'y réduit ;
 *  - FOURNIE par l'appelant (`valeur`) : alors, et alors seulement, il peut dire ce qu'il a fondu
 *    dedans (`soutien`, `dansLaValeur`) ou DÉCLARER une valeur d'une AUTRE formule (`valeurEtrangere`).
 *  Un `soutien` sans `valeur` est INEXPRIMABLE : le Soutien n'existe que fondu dans une valeur. */
type RollLineValeur =
  | {
    /** Valeur FONDUE dont la cible dérive : valeur SOUTENUE de `partyAssisted`, seuil `meta.baseValue`. */
    valeur: number;
    /** Détail du Soutien (LDB 12) DÉJÀ fondu dans `valeur` — il ressort en ligne NOMMÉE. */
    soutien?: SupportDetail;
    /** Parts que l'appelant a lui-même fondues dans `valeur` et qu'il NOMME (−10 du réparateur de
     *  substitution `MSRC 5 l.113-117`) : elles SORTENT de la base pour prendre leur place de ligne.
     *  Les déclarer sans les avoir fondues fausse la base — la garde d'exactitude le refuse. */
    dansLaValeur?: ModLine[];
    /** La valeur vient d'une AUTRE formule que `testValue` (soigneur PNJ sans fiche, seuil de table) :
     *  la décomposition est alors IMPOSSIBLE et le drapeau la DÉCLARE — la base rendue n'est PAS un
     *  Niveau de Compétence. Sans lui, une reconstruction ratée est un BUG. Une valeur de COMBAT ne
     *  relève PLUS de ce drapeau : elle a son canal (`combat`). */
    valeurEtrangere?: true;
    combat?: never;
  }
  | {
    /** Canal COMBAT : la base et les composantes viennent des jumelles de `engine/combat.ts`. */
    combat: RollLineCombat;
    /** Valeur de combat DÉJÀ fondue par l'appelant (Soutien des servants) — omise, elle est dérivée. */
    valeur?: number;
    soutien?: SupportDetail;
    dansLaValeur?: ModLine[];
    valeurEtrangere?: never;
  }
  | { valeur?: never; soutien?: never; dansLaValeur?: never; valeurEtrangere?: never; combat?: never };

/** DÉCLARATION d'une ligne de jet — le CONTRAT d'entrée du monteur canonique `rollLine`. Aucun calcul
 *  chez l'appelant : il DIT l'acteur, le Test, la Difficulté, sa valeur et ses poches. */
export type RollLineSpec = RollLineBase & RollLineValeur;

/** MÊME déclaration, Difficulté EXCEPTÉE — pour les résolveurs qui savent QUI teste QUOI mais pas
 *  encore à quelle Difficulté (le meilleur réparateur de bateau, le meneur d'une enquête) : la
 *  Difficulté vient du SITE qui ouvre le jet. Se complète par `withDifficulty`. */
export type RollLineDecl = Omit<RollLineBase, 'difficulty'> & RollLineValeur;

/** Complète une déclaration par sa Difficulté. Générique : la branche EXACTE de l'union (valeur
 *  fournie / valeur dérivée) est CONSERVÉE, donc l'exclusivité `soutien` ⇒ `valeur` reste vérifiée
 *  par le compilateur après composition. */
export function withDifficulty<T extends RollLineDecl>(decl: T, difficulty: Difficulty): T & { difficulty: Difficulty } {
  return { ...decl, difficulty };
}

/** Ce qu'une étape-jet doit porter pour être lisible : base NUE, lignes NOMMÉES, cible, écrêtage —
 *  et, en mode plafonné, le PALIER de Difficulté que la combinaison des circonstances compose. */
export interface RollLineParts {
  base: number;
  mods: ModLine[];
  target: number;
  clamped?: number;
  /** Difficulté à AFFICHER : le palier COMPOSÉ quand les circonstances tombent sur un cran de
   *  l'échelle (`LDB 14 l.91-96`), la Difficulté déclarée sinon. */
  difficulty: Difficulty;
  /** Modificateur RÉEL des circonstances quand il ne tombe sur AUCUN cran de l'échelle (`LDB 14` n'en
   *  nomme pas) : l'AFFICHAGE en compose « Combinée (+30) ». Présent ⇒ `difficulty` est la DÉCLARÉE
   *  et ne doit JAMAIS s'afficher seule. DÉRIVÉ : absent de `RollLineSpec`, aucun site ne peut le poser. */
  difficultyCombined?: number;
  /** Composition du palier (les lignes `famille:'circonstance'` + l'écart du plafond) : elles ne sont
   *  PLUS dans `mods` — le palier les porte, son popover les détaille. Absente = Difficulté déclarée,
   *  tous les modificateurs restent en chips. */
  difficultyParts?: ModLine[];
}

/** Composantes de `testValue` HORS pénalité d'États : `testValueParts` les NOMME EN TÊTE (il ouvre sur
 *  `testStatePenaltyParts`, `engine/skills.ts`) — un Test de COMBAT leur substitue `conditionModLines`.
 *  Le découpage positionnel est VÉRIFIÉ par l'oracle du canal (`rawCombatTestBase`), jamais supposé. */
function partsHorsEtats(actor: Combatant, t: RollLineBase['test'] = {}): ModLine[] {
  const etats = testStatePenaltyParts(actor, t.skill).filter((p) => p.value !== 0).length;
  return testValueParts(actor, t.skill, t.char, t.spec, t.sense).slice(etats);
}

/** DÉFAIT une valeur de COMBAT en base NUE + composantes NOMMÉES — jumeau de `testValueSplit` pour le
 *  canal `combat` : même contrat (`base + Σ mods === valeur`, `exact` DIT si la reconstruction a tenu),
 *  autres jumelles moteur. L'ORACLE est la valeur que le canal SAIT produire (`combatBaseValue + Σ
 *  combatValueModParts`, ou `rawCombatTestBase`) : une `valeur` fournie qui ne s'y réduit pas — au
 *  Soutien et au `fused` déclarés près — est refusée, exactement comme hors combat.
 *  Les lignes volatiles de la CARACTÉRISTIQUE (`volatileCharLines` : Bénédiction de Bataille,
 *  séquelle « Fracture −30 ») vivent DANS `combatBaseValue` via `effectiveChar` : le canal les
 *  RETIRE de la base à mesure qu'il les pose en lignes, jamais l'un sans l'autre. */
function combatValueSplit(
  actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test'],
  value: number, support?: SupportDetail, fused = 0,
): { base: number; mods: ModLine[]; exact: boolean } {
  const sup = supportSplit(value, support);
  if (!actor) return { ...sup, exact: true };
  const charLines = canal.kind === 'test' ? [] : volatileCharLines(actor, combatCharKey(canal.kind, canal.weapon));
  const nue = canal.kind === 'test'
    ? skillBaseValue(actor, t?.skill, t?.spec, t?.char)
    : combatBaseValue(actor, canal.kind, canal.weapon) - charLines.reduce((s, l) => s + l.value, 0);
  const parts = canal.kind === 'test'
    ? [...partsHorsEtats(actor, t), ...conditionModLines(actor)]
    : [...charLines, ...combatValueModParts(actor, canal.kind, canal.weapon)];
  const sum = parts.reduce((s, p) => s + p.value, 0);
  if (nue + sum + fused !== sup.base) return { ...sup, exact: false };
  return { base: sup.base - sum, mods: [...sup.mods, ...parts], exact: true };
}

/** Valeur DÉRIVÉE d'un canal de combat quand l'appelant n'en fournit aucune. */
function combatChannelValue(actor: Combatant | undefined, canal: RollLineCombat, t: RollLineBase['test']): number {
  if (!actor) return 0;
  // `sense` transite des DEUX côtés (ici comme dans `partsHorsEtats`) : `rawCombatTestBase` ne le
  // prend pas, donc la valeur dérivée est composée à la main sur la MÊME formule (`testValue` privée
  // de la pénalité d'États hors combat). Sans cela, un Test de combat sense-scopé (Surdité, LDB 18)
  // verrait sa valeur et ses composantes diverger, et l'oracle THROW sur un site pourtant correct.
  return canal.kind === 'test'
    ? testValue(actor, t?.skill, t?.char, t?.spec, t?.sense) - testStatePenalty(actor, t?.skill)
      + conditionModLines(actor).reduce((s, m) => s + m.value, 0)
    : combatBaseValue(actor, canal.kind, canal.weapon) + combatValueModParts(actor, canal.kind, canal.weapon).reduce((s, m) => s + m.value, 0);
}

/**
 * SÉPARABILITÉ des familles sous plafond — invariant du monteur, pas une lecture du RAW.
 *
 * `LDB 14 l.95` dit la combinaison (« faire la somme des différents modificateurs sans dépasser Très
 * Difficile -30 ») sans distinguer d'où vient chaque modificateur. La partition en DEUX familles
 * (SITUATIONNEL du Test, plafonné / ressource ou état PROPRE du jeteur, hors plafond) est un
 * ARBITRAGE du projet, consigné #1218 — c'est `combineMods` qui l'applique, et c'est LUI que cette
 * garde surveille.
 *
 * Ce que l'arbitrage autorise : couper la ligne en deux (la Difficulté porte la combinaison des
 * circonstances, les chips portent le reste). Le jour où la combinaison mordrait aussi sur l'autre
 * famille, la Difficulté annoncée mentirait exactement de la part remboursée — et le TOTAL resterait
 * juste, donc le mensonge serait muet. Le fait se crie (THROW en DEV, journal en PROD — patron de la
 * garde d'exactitude ci-dessous).
 *
 * Exportée pour être jugée SEULE : le mock de MODULE est interdit ici (`isolate: false`, garde
 * `src/vi-mock-isolate-guard.test.ts`), la régression ne peut donc se simuler qu'en appelant
 * l'invariant avec une combinaison qui ment. `SEPARABILITE.vus` compte les passages RÉELS — c'est ce
 * compteur, et non la présence d'un appel dans le source, qui prouve le câblage.
 */
export const SEPARABILITE = { vus: 0 };

export function assertSeparabilite(surLaCible: ModLine[], combine: number, circCombined: number): void {
  SEPARABILITE.vus += 1;
  const horsTable = surLaCible.filter((m) => m.famille !== 'circonstance').reduce((s, m) => s + m.value, 0);
  if (combine === circCombined + horsTable) return;
  const msg = `[seam] rollLine : la combinaison plafonnée (${combine}) n'est pas séparable — circonstances ${circCombined} `
    + `+ hors table ${horsTable} ≠ ${combine} (arbitrage de familles #1218). La Difficulté composée serait FAUSSE.`;
  console.error(msg);
  if (import.meta.env?.DEV) throw new Error(msg);
}

/**
 * MONTEUR CANONIQUE d'une ligne de jet (#1153) — le SEUL endroit du jeu où `base`/`mods`/`target`
 * d'une étape se calculent. La porte du seam (`buildMonoStep`) comme les monteurs LOCAUX des flux
 * (voyage fluvial/maritime/terrestre, embrigadement, activités hors combat) le consomment : un
 * call-site DÉCLARE, il ne calcule plus — une erreur de cette famille se corrige ICI, une fois.
 *
 * INVARIANTS :
 *  - `base` = Niveau de Compétence NU (`skillBaseValue`, `LDB 09 l.17`), la grandeur qui s'affiche et
 *    qui DÉPARTAGE à DR égal (`LDB 12 l.160`) — SAUF côté MONDE (aucun acteur : la base EST le seuil
 *    posé par l'appelant), SAUF canal `combat` (base = valeur de combat NUE, `combatBaseValue`) et
 *    SAUF `valeurEtrangere` (formule hors `testValue`, assumée au call-site) ;
 *  - `base + Σ mods + Difficulté + écrêtage === target` : tout l'écart est NOMMÉ (Soutien, États,
 *    Encombrement, séquelles, passifs, outil manquant — `testValueSplit`/`combatValueSplit`), aucune
 *    chip « autres » ;
 *  - la CIBLE dérive de la valeur FONDUE, écrêtée par la MÊME primitive que `rollTest` (`clampTarget`).
 *
 * GARDE D'EXACTITUDE : l'invariant arithmétique seul est TAUTOLOGIQUE (la base est une soustraction,
 * elle absorbe l'erreur). Une reconstruction ratée non déclarée — modificateur annoncé mais jamais
 * fondu, ou fondu ET redéclaré en double — THROW en DEV et se journalise en PROD (patron
 * `rollSansPilote`) : le mensonge se voit au premier passage au lieu de se lire comme une base juste.
 * Une Difficulté inconnue est refusée de même : sans elle la cible serait `NaN`, en silence.
 */
export function rollLine(spec: RollLineSpec): RollLineParts {
  const t = spec.test ?? {};
  const dansLaValeur = spec.dansLaValeur ?? [];
  const fusedSum = dansLaValeur.reduce((s, m) => s + m.value, 0);
  const dv = DIFFICULTY_MODIFIERS[spec.difficulty];
  if (typeof dv !== 'number') throw new Error(`rollLine : Difficulté inconnue « ${String(spec.difficulty)} » — la cible serait NaN.`);
  // Un ACTEUR jette forcément QUELQUE CHOSE : sans valeur posée (`valeur`), sans canal de combat et
  // sans ids, `testValue` rendrait 0 et la ligne annoncerait une cible qui n'est la valeur de
  // personne — auto-échec MUET (#1657 B3-3). Le producteur nomme son Test, ou pose sa valeur.
  if (spec.actor && spec.valeur === undefined && !spec.combat && !t.skill && !t.char) {
    throw new Error(`rollLine : Test de « ${spec.actor.label} » sans compétence ni caractéristique et sans valeur posée `
      + '— la porte le jouerait sur 0 (auto-échec muet). Nommer `test.skill`/`test.char`, ou passer `valeur`.');
  }
  const value = spec.valeur ?? (spec.combat
    ? combatChannelValue(spec.actor, spec.combat, t)
    : (spec.actor ? testValue(spec.actor, t.skill, t.char, t.spec, t.sense) : 0));
  const split = spec.combat
    ? combatValueSplit(spec.actor, spec.combat, t, value, spec.soutien, fusedSum)
    : testValueSplit(spec.actor, value, {
      support: spec.soutien, skill: t.skill, characteristic: t.char, spec: t.spec, sense: t.sense, fused: fusedSum,
    });
  if (!split.exact && !spec.valeurEtrangere) {
    const formule = spec.combat ? (spec.combat.kind === 'test' ? 'la valeur de Test de combat brute' : 'la valeur de combat NUE') : 'le Niveau de Compétence';
    const msg = `[seam] rollLine : la valeur (${value}) ne se reconstruit pas depuis ${formule} `
      + `(${t.skill ?? t.char ?? spec.combat?.kind ?? '?'} ${spec.actor ? `de « ${spec.actor.label} »` : 'sans acteur'}) + ses composantes + ${fusedSum} déclaré(s) `
      + '— une poche est mal remplie (modificateur non fondu, ou fondu ET redéclaré). La base affichée serait FAUSSE.';
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  const surLaCible = spec.surLaCible ?? [];
  const brut = surLaCible.reduce((s, m) => s + m.value, 0);
  // Mode plafonné (`LDB 14 l.91-96`) : la combinaison est celle du moteur, et la Difficulté AFFICHÉE
  // est celle que les circonstances composent — MÊME primitive que le post-jet (`bd`, `engine/combat.ts`).
  const plafonne = spec.plafond === 'difficultes';
  const combine = plafonne ? combineMods(surLaCible) : brut;
  const compo = plafonne ? composeDifficulty(spec.difficulty, surLaCible) : undefined;
  if (compo) assertSeparabilite(surLaCible, combine, compo.circCombined);
  const { target, clamped } = clampTarget(value + dv + combine);
  return {
    base: split.base - fusedSum,
    mods: [...split.mods, ...dansLaValeur, ...(compo ? compo.mods : surLaCible)],
    target,
    ...(clamped ? { clamped } : {}),
    difficulty: compo?.difficulty ?? spec.difficulty,
    ...(compo?.difficultyCombined != null ? { difficultyCombined: compo.difficultyCombined } : {}),
    ...(compo?.difficultyParts ? { difficultyParts: compo.difficultyParts } : {}),
  };
}

/** Ligne de jet ÉTALÉE en champs d'étape — la forme que rend `rollStep`, et la seule par laquelle une
 *  ligne déjà montée entre dans un mint (`MonoSpec.montee`). Type STRUCTUREL : il dit la FORME, pas la
 *  provenance — ce qu'elle vaut est tenu par le cliquet, cf. le JSDoc de `MonoSpec`. */
export type LigneMontee = { base: number; mods?: ModLine[]; target: number; clamped?: number };
/** Étale une ligne montée en CHAMPS d'étape (`CascadeStep`/`BatchParticipant`) : `mods` et `clamped`
 *  ne sont posés que s'ils existent — un monteur local ne réécrit jamais cet étalement à la main.
 *
 *  N'étale NI `difficulty` NI `difficultyParts` : ses appelants posent eux-mêmes la Difficulté
 *  après l'étalement, et AUCUN n'ouvre le mode plafonné (le seul régime qui DÉRIVE un palier). Le
 *  jour où l'un le fait, il lui faut relayer les deux champs ensemble — sans quoi les chips
 *  amputées de leurs circonstances laisseraient un écart « autres ». Verrouillé par la garde
 *  « `rollStep` + `plafond` » (`src/state/roll-line-combat.test.ts`). */
export function rollStep(spec: RollLineSpec): LigneMontee {
  const line = rollLine(spec);
  return {
    base: line.base,
    ...(line.mods.length ? { mods: line.mods } : {}),
    target: line.target,
    ...(line.clamped ? { clamped: line.clamped } : {}),
  };
}

/** Résout un test skill/char SIMPLE (mono, `hero-test`/`enemy`/`subi` à `actorId`) en `CascadeStep`
 *  prêt pour `startCascade`/`runCascadeImmediate` — calque `openSkillTest` (`combatEffects.ts:313-397`)
 *  réduit au cas générique (pas de candidats/mod social : hors périmètre du seam Ronde 0). */
function buildMonoStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const { actorId, actor, baseValue, support } = resolveMonoSide(get, req, meta);
  // Ligne montée par le MONTEUR CANONIQUE : la cible reste dérivée de la valeur FONDUE (`testValue`
  // pour un acteur désigné, la valeur SOUTENUE de `partyAssisted`/le seuil `meta.baseValue` sinon).
  const line = rollLine(baseValue != null
    ? { actor, test: req.test, difficulty: req.difficulty, valeur: baseValue, soutien: support }
    : { actor, test: req.test, difficulty: req.difficulty });
  return {
    id: kind,
    kind,
    actorId,
    // Côté `worldSide` sans acteur (désertion, Moral, périls…) : marque l'étape MONDE — l'arbitre
    // (`modalArbiter.ts`) route son owner au siège MJ via le sentinel `WORLD_STEP_OWNER`
    // (`netOwnership.seatOwns`), à l'hôte sinon (écart 1 documenté en tête de fichier, fermé Ronde 1).
    ...(!actorId && 'worldSide' in req.side ? { worldOwner: true } : {}),
    label: composeRollLabel(actor, req.actionLabel, req.test),
    // Difficulté en donnée de LIGNE (#1072) : la modale la rend en texte + valeur sur la rangée ; sa
    // valeur est déjà comprise dans `target` (`rollLine`).
    difficulty: req.difficulty,
    // Compétence DÉRIVÉE du catalogue (`testSkillLabel`) — jamais `req.actionLabel` sauf repli (Test
    // SANS compétence/carac déclarée, ex. Désertion : rien à nommer en position de compétence).
    rollLabel: testSkillLabel(req.test) ?? req.actionLabel,
    base: line.base,
    ...(line.mods.length ? { mods: line.mods } : {}),
    target: line.target,
    ...(line.clamped ? { clamped: line.clamped } : {}),
    ...(req.evaluation ? { evaluation: req.evaluation } : {}),
    result: null,
    menace: req.test.menace,
    ...(req.stake ? { stake: req.stake } : {}),
    meta,
  };
}

/** Résout le côté `batch` en étape À PARTICIPANTS (seam de jet #275 Décision 4 cran 1/2, FERME l'écart
 *  2 de la Ronde 0) : UNE rangée par contributeur (`CascadeStep.participants`), non résolue — le jet de
 *  chaque contributeur vit dans la modale (flux `cascadeBatch`) ou, en surface I, dans
 *  `cascade.rollBatchParticipants` (`runCascadeImmediate`). L'AGRÉGAT (`step.aggregate` + `step.meta`
 *  NEUTRE : `aggregateFlatDR`/`aggregateCapTo`/`aggregateOpposeSl`) est calculé GÉNÉRIQUEMENT par
 *  `cascade.aggregateBatchStep` à la VALIDATION — ce constructeur ne lance AUCUN dé lui-même : chaque
 *  contributeur reste influençable individuellement avant l'agrégat (écart 2 de la Ronde 0). */
function buildBatchStep(get: Get, req: RollRequest, kind: string, meta?: CascadeStepMeta): CascadeStep {
  const participants = 'participants' in req.side ? req.side.participants : [];
  void get;
  // POSSESSION dérivée des rangées, MÊME règle que `bandStep` (#1262 V2 L4) : plusieurs porteurs →
  // `groupOwner` (owner `'*'`, chaque siège tient SA rangée), un seul → SON `actorId`. Sans elle,
  // l'arbitre rendait la fenêtre à l'HÔTE SEUL — le siège du contributeur ne voyait jamais son jet.
  const porteurs = new Set(participants.map((p) => p.id));
  return {
    id: kind,
    kind,
    label: dataLabel(req.actionLabel),
    ...(porteurs.size > 1 ? { groupOwner: true } : participants.length ? { actorId: participants[0].id } : {}),
    participants,
    aggregate: req.aggregate ?? 'summed-dr',
    ...(req.stake ? { stake: req.stake } : {}),
    meta,
  };
}

/**
 * LA PORTE UNIQUE (Décision 1). Dérive la surface des PORTEURS de la requête (#1479), construit
 * l'étape puis :
 *  - M/V (surfacé) : `startCascade` — la CONTINUATION est l'applier `kind` (lu à l'« Appliquer »,
 *    déjà câblé par `commitStep`/`cascadeAppliers`, `cascade.ts:107-110`) ;
 *  - I (inline) : `runCascadeImmediate` — MÊME registre, appelé d'office (mirror `runSkillTest`).
 * `meta` = paramètres SÉRIALISABLES de la conséquence (jamais de closure — coop, `CascadeStepMeta`).
 * Ne renvoie rien : le call-site est un one-liner déclaratif + son applier enregistré au préalable
 * (`registerCascadeApplier(kind, applier)`, `cascade.ts:57`).
 */
export function openRoll(get: Get, set: Set, req: RollRequest, kind: string, meta?: CascadeStepMeta): void {
  // Côté `partyBest` sans candidat (aucun PJ éligible à la compétence/carac visée) : rien à ouvrir —
  // même garde que l'ancien `if (best)` des call-sites (mandat coordinateur : la porte résout, donc
  // c'est ICI que le silence se décide, plus au call-site).
  if ('partyBest' in req.side && !resolveMonoSide(get, req).actor) return;
  const surface = resolveSurface(get, req, kind);
  // BANDE ou MONO : le NOMBRE de porteurs déclarés, jamais une classe (#1479) — le mono EST la bande à
  // N=1, et une requête qui déclare ses contributeurs monte ses rangées.
  const step = 'participants' in req.side ? buildBatchStep(get, req, kind, meta) : buildMonoStep(get, req, kind, meta);
  if (surface === 'I') {
    runCascadeImmediate(get, set, [step]);
    return;
  }
  startCascade(get, set, { title: rollTitle(get, req), purpose: 'test', steps: [step] });
}

/**
 * FORME STÉRÉOTYPÉE 1/2 (#352 extension) : le meilleur PJ du groupe teste UNE compétence/carac
 * (side `partyBest`) — 8 call-sites identiques avaient la compétence RÉPÉTÉE
 * (`side.partyBest.skill` ET `req.test.skill`, divergence exprimable = bug possible). SOURCE UNIQUE :
 * la compétence se déclare UNE FOIS ; `side`/`test` la reprennent ICI, jamais recopiée au call-site.
 * Réserve `openRoll` (exporté) aux formes hors ce patron (`enemy`/participants/`actorId` — cf. `rollSeam.test.ts`).
 */
export function openPartyTest(
  get: Get, set: Set,
  spec: { skill: string; char?: CharKey; assisted?: boolean; spec?: string; sense?: PairedSense; menace?: string; noSupport?: boolean; actionLabel: string; difficulty: Difficulty; stake?: StakeRef },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  const { skill, char, assisted, spec: specName, sense, menace, noSupport, actionLabel, difficulty, stake } = spec;
  openRoll(get, set, {
    side: { partyBest: { skill, char, assisted } },
    actionLabel,
    test: { skill, char, spec: specName, sense, menace, noSupport },
    difficulty,
    ...(stake ? { stake } : {}),
  }, kind, meta);
}

/**
 * FORME STÉRÉOTYPÉE 2/2 (#352 extension) : dé du siège MONDE (side `worldSide`) — désertion, recherche
 * d'acheteur, chance d'un péril d'auteur : aucune compétence (la cible est posée par l'appelant via
 * `meta.baseValue`). La POSSESSION ne se déclare pas ici : une étape sans acteur est routée au sentinel
 * `WORLD_STEP_OWNER` par `buildMonoStep`+`modalArbiter`, qui la rend au siège MJ s'il existe et à
 * l'hôte sinon. SOURCE UNIQUE, cf. `openPartyTest`.
 *
 * Le siège qui possède le monde TIENT ce dé et le JOUE — sa fenêtre s'ouvre (M en solo, V sous siège
 * MJ, I en cadence déférée), exactement comme celle du jet d'un héros (#1426/#1479).
 *
 * ÉVALUATION `'seuil'` (#1426) : ces dés ne sont PAS des Tests — le RAW dit « lancez un d100 [...] si
 * le résultat est inférieur ou égal au chiffre final » (MSRC 13 l.146, MDG 15 l.362) et écrit « Test »
 * trois lignes plus haut quand il en veut un. La porte le déclare donc pour toute sa famille ; un
 * appelant qui veut un vrai Test de monde passe par `openRoll`.
 */
export function openWorldTest(
  get: Get, set: Set,
  spec: { actionLabel: string; difficulty: Difficulty; stake?: StakeRef },
  kind: string,
  meta?: CascadeStepMeta,
): void {
  openRoll(get, set, {
    side: { worldSide: 'world' },
    actionLabel: spec.actionLabel,
    test: {},
    difficulty: spec.difficulty,
    evaluation: 'seuil',
    ...(spec.stake ? { stake: spec.stake } : {}),
  }, kind, meta);
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────────
 * LA FAMILLE D'OUVERTURES (#1262) — une porte TYPÉE PAR FORME de jet, qui ÉTEND les trois ouvertures
 * ci-dessus (`openRoll`/`openPartyTest`/`openWorldTest`) :
 *   - MONO   : `openRoll` (+ ses deux formes stéréotypées) — un jet, un porteur ;
 *   - BANDE  : `openBand` — une situation (une entrée de règle), N porteurs, UNE fenêtre ;
 *   - CHOIX  : `openChoice` — une décision, zéro dé.
 * `groupOwner` et `actorId` ne sont JAMAIS des champs de déclaration : le socle les pose (`bandStep`) ;
 * `interactive` vit seulement au niveau RANGÉE, où `surfaceRow` le pose. Les étapes rendues portent la
 * marque `BuiltCascadeStep`.
 *
 * DEUX DIVERGENCES ASSUMÉES avec les trois ouvertures MONO :
 *  1. SIGNATURE — les trois portent `kind` et `meta` en paramètres POSITIONNELS (`(get, set, req,
 *     kind, meta?)`) ; la famille les met DANS la déclaration (`(get, set, spec)`). C'est le sens même
 *     de la porte : une seule chose à remplir, et un champ de plus s'ajoute au type sans toucher aux
 *     appelants — là où un 6ᵉ positionnel les réécrirait tous.
 *  2. SURFACE I — la CADENCE déférée route `openRoll` vers l'inline (aucune fenêtre) mais laisse à
 *     `openBand`/`openSequence` la leur : une bande est UNE entrée de règle mise en jeu face à N
 *     porteurs, et son bilan par rangée se lit — le pilote d'auto-cadence la DÉROULE (`combatAuto`)
 *     au lieu de l'effacer. La TENUE, elle, tranche pareil des deux côtés (#1479) : une bande
 *     qu'AUCUN siège humain ne tient se résout d'office. Le choix est ici, pas dans l'oubli d'un `if`.
 * ───────────────────────────────────────────────────────────────────────────────────────────────── */

/** Politique de garde de la porte, calque de `rollLine`/`rollSansPilote` : en DEV la violation THROW
 *  (elle se voit au premier passage), en PROD elle se journalise — l'appelant de la garde décide
 *  alors de la DÉGRADATION (fenêtre ouverte diminuée, rangée écartée), jamais du silence.
 *
 *  EXPORTÉ pour les fabriques qui montent PAR les mints sans être des mints (`nightBands` : elle
 *  regroupe des déclarations et appelle `bandStep`) — elles refusent par le MÊME canal, jamais par un
 *  `console.warn` local qui ne casserait rien en DEV. */
export function refusePorte(msg: string): void {
  const m = `[seam] ${msg}`;
  console.error(m);
  if (import.meta.env?.DEV) throw new Error(m);
}

/** Déclaration de LIGNE d'un porteur de bande : celle du monteur canonique, l'ACTEUR et la DIFFICULTÉ
 *  exceptés (fournis autour). L'omission est DISTRIBUTIVE : chaque régime de valeur de `RollLineDecl`
 *  garde son exclusivité (un `soutien` sans `valeur` reste inexprimable). */
export type BandLigne = RollLineDecl extends infer U ? (U extends unknown ? Omit<U, 'actor'> : never) : never;

/** UN porteur d'une bande : qui teste, et la LIGNE de son jet. */
export interface BandPorteur {
  /** Le porteur — la rangée prend son id, et sa SURFACE se déduit de lui (`surfaceRow`). */
  actor: Combatant;
  /** Ligne du jet — le porteur NOMME ce qu'il teste (`test`) ou pose sa valeur (`valeur`). Omise sur
   *  une rangée à jet, la porte REFUSE : elle jouerait sur une valeur de 0 (#1657 B3-3). */
  ligne?: BandLigne;
  /** Difficulté de CETTE rangée, quand elle diverge de celle de la bande (allègement porté par un
   *  Talent du seul porteur). Absente : celle de la bande. */
  difficulty?: Difficulty;
  /** Libellé de rangée. Absent : la Compétence DÉRIVÉE du catalogue (`testSkillLabel`). */
  label?: string;
  /** Tag de DONNÉE `menace` — la rangée offre l'auto-succès du talent Résistance (Menace), LDB 10. */
  menace?: string;
  /** Contribue DOUBLE à l'agrégat sommé (MDG 14 l.19). */
  essential?: boolean;
  /** +DR ajouté au DR d'un jet réussi (Talent baké à la construction). */
  bonusSlOnSuccess?: number;
  /** Paramètres sérialisables de la conséquence PROPRE à cette rangée (jumeau du `meta` d'étape). */
  meta?: CascadeStepMeta;
}

/** Monte la rangée d'un porteur — ligne par le monteur canonique (`rollStep`), Compétence dérivée du
 *  catalogue. `interactive` est posé par `surfaceRow`, jamais ici. */
function bandRow(p: BandPorteur, difficulty: Difficulty): BatchParticipant {
  const diff = p.difficulty ?? difficulty;
  const test = p.ligne?.test;
  const label = p.label ?? testSkillLabel(test ?? {});
  return {
    id: p.actor.id,
    result: null,
    interactive: true,
    difficulty: diff,
    ...rollStep({ ...(p.ligne ?? {}), actor: p.actor, difficulty: diff }),
    ...(label ? { label } : {}),
    ...(p.menace ? { menace: p.menace } : {}),
    ...(test?.skill ? { skillId: test.skill } : {}),
    ...(test?.spec ? { spec: test.spec } : {}),
    ...(p.essential ? { essential: true } : {}),
    ...(p.bonusSlOnSuccess ? { bonusSlOnSuccess: p.bonusSlOnSuccess } : {}),
    ...(p.meta ? { meta: p.meta } : {}),
  };
}

/** DÉCLARATION d'une bande : la situation (`BandSpec`) et ses rangées — DÉCLARÉES par porteur (la
 *  porte les monte) ou DÉJÀ montées par un producteur qui possède l'arithmétique de sa ligne
 *  (opposition figée, agrégat naval). `interactive` est absent des deux entrées : c'est la porte qui
 *  l'établit. Sans titre ni finalisation : une bande APPENDUE (`pushBand`) rejoint la fenêtre en
 *  place, seule une bande OUVRANTE (`BandOpenSpec`) en nomme une. */
export type BandRowsSpec = BandSpec & (
  | { porteurs: readonly BandPorteur[]; difficulty: Difficulty; rows?: never }
  | { rows: readonly Omit<BatchParticipant, 'interactive'>[]; porteurs?: never; difficulty?: never }
);

/** La même déclaration, plus la fenêtre qu'elle ouvre (titre + finalisation). */
export type BandOpenSpec = BandRowsSpec & { title: string; purpose: PendingCascade['purpose'] };

/**
 * ÉTAT d'une rangée DÉJÀ montée. L'entrée `rows` sert des rangées NEUVES (dé non tombé) ou
 * FIGÉES par leur producteur (témoin roulé à la construction, `pursuitFlow.pursuitRow`) — JAMAIS une
 * rangée MI-JOUÉE : une reprise (`resumeSuspendedCascade`, restauration de sauvegarde) réinstalle son
 * `pendingCascade` en direct, elle ne repasse pas par la porte. C'est cette borne qui rend la règle
 * « `result` ⇒ close » exacte : ailleurs dans le cycle, un dé tombé reste influençable pour son
 * porteur (Chance/Pacte s'appliquent APRÈS le `result`, `rollFlowSpecs.cascadeBatch`) et la rangée y
 * garde `interactive:true`. Le jour où un appelant voudrait ROUVRIR une bande en vol, ce n'est pas
 * cette règle qu'il faut assouplir : c'est une entrée à part.
 *
 * Rangée ORPHELINE (un `id` qu'aucun combattant ne porte) : refusée. Surfacée, elle nommerait un
 * propriétaire fantôme ; en témoin, elle roulerait un dé pour personne.
 */
function rowSurfacee(get: Get, r: Omit<BatchParticipant, 'interactive'>, cle: string): BatchParticipant | undefined {
  const actor = porteurParId(get(), r.id);
  if (!actor) {
    refusePorte(`bande « ${cle} » : rangée « ${r.id} » sans combattant — ni jet, ni propriétaire à lui donner. Rangée écartée.`);
    return undefined;
  }
  if (r.result) return { ...r, interactive: false };
  return surfaceRow(get, actor.id, { ...r, interactive: true });
}

/**
 * CONSTRUCTEUR DE BANDE COMPLET (#1262) — la porte monte chaque rangée, la SURFACE (rangée à jouer
 * chez le siège qui tient son porteur, TÉMOIN né roulé sinon) puis pose la POSSESSION de l'étape
 * (`bandStep`). Partagé par l'ouverture (`openBand`) et l'append (`pushBand`) : la surface et la
 * possession d'une bande ne dépendent pas de la fenêtre qui l'accueille.
 *
 * Zéro rangée : `undefined` — rien n'est mis en jeu.
 */
export function buildBand(get: Get, spec: BandRowsSpec): BuiltCascadeStep | undefined {
  const rows = spec.porteurs
    ? spec.porteurs.map((p) => surfaceRow(get, p.actor?.id, bandRow(p, spec.difficulty)))
    : (spec.rows ?? []).flatMap((r) => rowSurfacee(get, r, spec.id) ?? []);
  return bandStep(spec, rows);
}

/**
 * PORTE DE BANDE (#1262) — une entrée de règle mise en jeu face à N porteurs, UNE fenêtre
 * (`buildBand` + `startCascade`).
 *
 * Zéro rangée : aucune fenêtre (rien n'est mis en jeu).
 */
export function openBand(get: Get, set: Set, spec: BandOpenSpec): CascadeStep[] | undefined {
  const step = buildBand(get, spec);
  if (!step) return undefined;
  return openSequence(get, set, {
    title: spec.title,
    purpose: spec.purpose,
    ...(spec.icon ? { icon: spec.icon } : {}),
    steps: [step],
  });
}

/** DÉCLARATION d'une étape de CHOIX : une décision, zéro dé (renoncement, Destin, cible de monture,
 *  déviation d'un Critique). */
export interface ChoiceSpec {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** PORTEUR de la décision, REQUIS : l'arbitre (`modalArbiter`) route la fenêtre à son siège. Sans
   *  lui l'owner serait `undefined` — fenêtre à l'HÔTE SEUL, qui trancherait la voie d'autrui. Une
   *  étape de choix n'a donc QUE cette possession (cf. `groupOwner` ci-dessous). */
  actorId: string;
  /** POSSESSION DE GROUPE REFUSÉE AU TYPE (#1262 V4) : sous owner `'*'`, le choix se posant au niveau de
   *  l'ÉTAPE (`setCascadeChoice`), n'importe quel siège trancherait la voie d'autrui. Calque de
   *  `HostOwner` : un littéral frais était déjà refusé (propriété excédentaire), ce `never` ferme en
   *  plus la voie d'un objet ÉLARGI passé par variable ou épandage. */
  groupOwner?: never;
  /** Les VOIES offertes. `label` est du TEXTE JOUEUR marqué (#1318 V8a₁) : un bouton de choix est lu
   *  par le joueur au même titre que le titre de l'étape — le murage vaut donc aussi pour lui. */
  options: readonly { key: string; label: PlayerText; detail?: string }[];
  /** Clé retenue d'office par une résolution IMMÉDIATE (`runCascadeImmediate`) — l'une des `options`. */
  defaultChoice?: string;
  /** Fiche de RÈGLE qui encadre le choix (une étape sans jet n'a pas d'enjeu à dériver). */
  stakeRule?: { category: string; id: string };
  /** HYBRIDE choix + RÉVÉLATION (#1262 B5) : la décision se prend DEVANT la charge riche qui la motive
   *  (le Critique pré-tiré d'une déviation). Recopiée telle quelle sur l'étape — `ui/RevealBody` la rend
   *  sous les options. Le rendu d'une révélation n'est pas une seconde étape à enchaîner. */
  reveal?: RevealEntry;
  /** Lignes de conséquence DÉJÀ écrites qui exposent l'enjeu du choix (Piège-lame : ce que chaque voie
   *  coûte). Structurées (`RecapLine[]`), rendues par le renderer partagé. */
  outcome?: RecapLine[];
  /** CHARGE de l'applier « déviation » (`combatFlow`) : le Critique pré-tiré et le contexte d'attaque
   *  dont la voie choisie décide. Recopiée telle quelle — une charge n'est pas une forme : elle ne
   *  rend rien et ne change pas l'interaction de l'étape, elle est ce que l'applier LIT au commit. */
  deviation?: PendingDeviation;
  /** CHARGE de l'applier « piège-lame » (`combatFlow`) : le contexte du Test opposé de Force. */
  bladeTrap?: PendingBladeTrap;
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR d'étape de CHOIX (#1262) — pose la possession du PORTEUR, et rien d'autre : pas de
 * `groupOwner`, pas de `test: {}` de convenance (un choix ne lance aucun dé).
 *
 * DEV : une déclaration fautive THROW. PROD : elle se journalise et la décision se DÉGRADE au lieu de
 * disparaître — un porteur manquant laisse la fenêtre échoir à l'hôte (visible, jouable), un
 * `defaultChoice` étranger aux options est écarté (seule la résolution immédiate y perd son
 * raccourci). `undefined` dans le SEUL cas où il n'y a aucune décision à préserver : zéro option —
 * la fenêtre serait alors une impasse (`stepReady` attend un `chosen` qu'aucun bouton ne pose).
 */
export function choiceStep(spec: ChoiceSpec): BuiltCascadeStep | undefined {
  if (!spec.options.length) {
    refusePorte(`choix « ${spec.id} » (${spec.kind}) sans option — la fenêtre serait une impasse. Aucun choix ouvert.`);
    return undefined;
  }
  if (!spec.actorId) {
    refusePorte(`choix « ${spec.id} » (${spec.kind}) sans PORTEUR — la fenêtre échoit à l'hôte, qui tranche pour autrui.`);
  }
  const defaut = spec.defaultChoice != null && spec.options.some((o) => o.key === spec.defaultChoice) ? spec.defaultChoice : undefined;
  if (spec.defaultChoice != null && defaut == null) {
    refusePorte(`choix « ${spec.id} » (${spec.kind}) : `
      + `\`defaultChoice\` « ${spec.defaultChoice} » hors de ses options — écarté ; une résolution immédiate s'arrête sur ce choix.`);
  }
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.actorId ? { actorId: spec.actorId } : {}),
    options: spec.options.map((o) => ({ ...o })),
    ...(defaut != null ? { defaultChoice: defaut } : {}),
    ...(spec.stakeRule ? { stakeRule: spec.stakeRule } : {}),
    ...(spec.reveal ? { reveal: spec.reveal } : {}),
    ...(spec.outcome ? { outcome: spec.outcome } : {}),
    ...(spec.deviation ? { deviation: spec.deviation } : {}),
    ...(spec.bladeTrap ? { bladeTrap: spec.bladeTrap } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/** PORTE DE CHOIX (#1262) — `choiceStep` + sa fenêtre. */
export function openChoice(get: Get, set: Set, spec: ChoiceSpec & { title: string; purpose: PendingCascade['purpose'] }): void {
  const step = choiceStep(spec);
  if (!step) return;
  startCascade(get, set, {
    title: spec.title,
    purpose: spec.purpose,
    ...(spec.icon ? { icon: spec.icon } : {}),
    steps: [step],
  });
}

/** DÉCLARATION d'une étape de QUANTITÉ : une SAISIE NUMÉRIQUE bornée, zéro dé — le joueur pose un
 *  nombre dans la plage que l'étape déclare. Même possession qu'un choix (le porteur, requis), pour
 *  la même raison : le nombre se pose au niveau de l'ÉTAPE. */
export interface QuantitySpec {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** PORTEUR de la saisie, REQUIS : l'arbitre (`modalArbiter`) route la fenêtre à son siège. */
  actorId: string;
  /** POSSESSION DE GROUPE REFUSÉE AU TYPE — calque de `ChoiceSpec.groupOwner` : sous owner `'*'`,
   *  n'importe quel siège poserait le nombre d'autrui. */
  groupOwner?: never;
  min: number;
  max: number;
  /** Pas du compteur (défaut 1). */
  step?: number;
  /** Ce qui se compte, au pluriel (« points ») — AFFICHAGE. */
  unit?: string;
  /** Valeur d'OUVERTURE (ramenée à la plage) — celle que garde une résolution IMMÉDIATE, et celle
   *  que le compteur montre d'emblée. Absente : `min`. */
  value?: number;
  /** Fiche de RÈGLE qui encadre la saisie (une étape sans jet n'a pas d'enjeu à dériver). */
  stakeRule?: { category: string; id: string };
  outcome?: RecapLine[];
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR d'étape de QUANTITÉ (#1279 Sf) — 6ᵉ interaction de la coquille : une plage, un
 * compteur, un nombre posé. La valeur d'ouverture est CALÉE par le site unique de la borne
 * (`clampStepAmount`, `cascade.ts`) : l'étape naît donc PRÊTE (`stepReady`), comme une étape
 * d'affichage — un compteur n'a pas d'état vide, et la résolution immédiate n'a aucun défaut
 * parallèle à consulter.
 *
 * `undefined` (DEV : throw) sur une plage VIDE (`max < min`) : la fenêtre n'aurait aucun nombre à
 * offrir — l'impasse de `choiceStep` sans option.
 */
export function quantityStep(spec: QuantitySpec): BuiltCascadeStep | undefined {
  if (!(spec.max >= spec.min)) {
    refusePorte(`quantité « ${spec.id} » (${spec.kind}) : plage vide [${spec.min}, ${spec.max}] — aucun nombre à poser. Aucune saisie ouverte.`);
    return undefined;
  }
  if (!spec.actorId) {
    refusePorte(`quantité « ${spec.id} » (${spec.kind}) sans PORTEUR — la fenêtre échoit à l'hôte, qui saisit pour autrui.`);
  }
  const quantity = {
    min: spec.min, max: spec.max,
    ...(spec.step != null ? { step: spec.step } : {}),
    ...(spec.unit ? { unit: spec.unit } : {}),
  };
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.actorId ? { actorId: spec.actorId } : {}),
    quantity,
    amount: clampStepAmount(quantity, spec.value ?? spec.min),
    ...(spec.stakeRule ? { stakeRule: spec.stakeRule } : {}),
    ...(spec.outcome ? { outcome: spec.outcome } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/** Ce qui est vrai de TOUTE étape mono : un porteur, un jet, sa situation. `actorId`/`base`/`mods`/
 *  `target` ne sont PAS des champs de déclaration — le mint les pose. */
interface MonoBase {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** Le jeteur : la possession de l'étape en dérive (`actorId`), et sa ligne aussi. */
  actor: Combatant;
  difficulty: Difficulty;
  /** Libellé de la COMPÉTENCE lancée. Absent : dérivé du catalogue (`testSkillLabel`), à défaut `label`. */
  rollLabel?: string;
  /** Tag de DONNÉE `menace` (auto-succès du talent Résistance (Menace), LDB 10). */
  menace?: string;
  /** ENJEU du jet (#1117) — DÉCLARATION REQUISE (#1262 V2 L6d) : le champ n'est plus optionnel, une
   *  étape mono ne peut PLUS se déclarer sans parler de son enjeu. La valeur peut être `undefined`
   *  (résiduel : un porteur non résoluble, cf. `monoStep`, qui le REFUSE bruyamment) — ce que le type
   *  supprime, c'est l'omission SILENCIEUSE, celle qui ne se voyait qu'au scan textuel.
   *
   *  CE QUI A OUVERT LA PORTE, mesuré le 2026-08-12 : les 74 `FlowTest` authorés en DONNÉE app-owned
   *  (spells 46, trappings 14, etats 3, talents 3, traits 3, maneuvers 2, qualities 2, symptoms 1) ne
   *  sont plus muets — ils DÉRIVENT leur enjeu de l'entité qui les exige (`derivedStake`, arbitrage
   *  user 2026-08-12), résolu au montage par `withDerivedStake` (`combat/triggeredTest.ts`). Les deux
   *  fabriques génériques de ce module TRANSMETTENT donc un enjeu toujours calculé, jamais deviné. */
  stake: StakeRef | undefined;
  meta?: CascadeStepMeta;
  /** SECONDE LECTURE du MÊME dé (Test combiné, `LDB 12 l.202-208`) : la seconde valeur que ce jet
   *  tranche, et son nom. Aucun second tirage — l'issue est ÉVALUÉE (`cascade.secondReadOf`). */
  second?: CascadeSecondRead;
  /** HYBRIDE jet + RÉVÉLATION (#1262 B5) : la charge riche qui met le jet en situation. */
  reveal?: RevealEntry;
  /** Lignes de conséquence DÉJÀ écrites qui exposent l'enjeu du jet. */
  outcome?: RecapLine[];
}

/**
 * DÉCLARATION d'une étape MONO — deux régimes EXCLUSIFS, et le compilateur tient l'exclusion :
 *  - `ligne` : la déclaration du jet (même forme qu'une rangée de bande), MONTÉE par le mint. Régime
 *    normal — omise, la base est le `testValue` de l'acteur ;
 *  - `montee` : ligne DÉJÀ étalée, fournie par le producteur. Régime des jets dont le MONTAGE et
 *    l'ASSEMBLAGE ne tombent pas au même moment : les Tests d'entretien différés (`upkeep.ts` monte la
 *    ligne pendant l'entretien, `restFlow.deferredUpkeepSteps` assemble l'étape après) — remonter la
 *    ligne à l'assemblage la calculerait sur un héros que l'entretien a entre-temps changé (États,
 *    Blessures), donc sur une AUTRE cible. Ce que `bandStep` admet déjà pour ses rangées.
 *
 * CE QUE `montee` NE GARANTIT PAS — dit sans fard : `LigneMontee` est un type STRUCTUREL NU (aucune
 * marque, aucun lint). Rien n'oblige la ligne à sortir du monteur canonique, et le lot qui a ouvert ce
 * régime en donne lui-même le contre-exemple (`combatEffects.ts` monte sa cible d'Exposition en
 * arithmétique locale, `exposureTarget` ; seul `seaVoyageFlow` y passe `rollStep(…)` tel quel). C'est
 * donc une PORTE DE FORGE, tenue non par le type mais par le CLIQUET : un `montee: { … }` littéral est
 * COMPTÉ comme montage à la main (`roll-seam-exclusivity-guard`, cliquet 2), un `montee: rollStep(…)`
 * ne l'est pas. Brander `LigneMontee` reste une option OUVERTE (elle forcerait d'abord les cibles
 * fabriquées hors monteur à s'exprimer en `rollStep`) — instruite hors de ce lot, #1262.
 */
export type MonoSpec = MonoBase & (
  | { ligne?: BandLigne; montee?: never }
  | { montee: LigneMontee; ligne?: never }
);

/**
 * CONSTRUCTEUR d'étape MONO (#1262) — un porteur, un jet, UNE fenêtre : la possession (`actorId`) est
 * posée ICI, la ligne par le monteur canonique (`rollStep`).
 *
 * La CIBLE est le garde-fou : une étape sans `target` est classée `'affichage'` par `stepInteraction`
 * (`cascade.ts`) — elle serait donc « prête » d'office, validée sans qu'aucun dé ne tombe. Un jet
 * fantôme, pas une étape muette. `undefined` (DEV : throw) plutôt que cette fenêtre-là.
 *
 * L'ENJEU est le second : le TYPE oblige à le déclarer (`MonoSpec.stake`), la porte REFUSE sa valeur
 * muette (DEV : throw ; PROD : journalisée, la fenêtre s'ouvre sans phrase plutôt que de perdre le
 * jet — la dégradation est visible, jamais silencieuse).
 */
export function monoStep(spec: MonoSpec): BuiltCascadeStep | undefined {
  const parts = spec.montee
    ?? rollStep({ ...(spec.ligne ?? {}), actor: spec.actor, difficulty: spec.difficulty } as RollLineSpec);
  if (!Number.isFinite(parts.target)) {
    refusePorte(`mono « ${spec.id} » (${spec.kind}) : cible non calculable pour « ${spec.actor.label} » `
      + '— l\'étape serait un pur affichage, validé sans qu\'aucun dé ne tombe. Aucun jet ouvert.');
    return undefined;
  }
  if (!spec.stake) {
    refusePorte(`mono « ${spec.id} » (${spec.kind}) : enjeu MUET — ni déclaré par le producteur, ni dérivable `
      + 'de l\'entité porteuse. La fenêtre s\'ouvre sans dire ce qui se joue.');
  }
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    actorId: spec.actor.id,
    difficulty: spec.difficulty,
    rollLabel: spec.rollLabel ?? testSkillLabel(spec.ligne?.test ?? {}) ?? spec.label,
    ...parts,
    result: null,
    ...(spec.menace ? { menace: spec.menace } : {}),
    ...(spec.stake ? { stake: spec.stake } : {}),
    ...(spec.second ? { second: spec.second } : {}),
    ...(spec.reveal ? { reveal: spec.reveal } : {}),
    ...(spec.outcome ? { outcome: spec.outcome } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/** DÉCLARATION d'une étape à TABLE : quel tirage, pour qui. La DÉCLARATION du tirage (`table`) est
 *  celle du registre (`tableStepDef`, `cascade.ts`) — modificateur, plancher, dé imposé compris. */
export interface TableSpec {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** PORTEUR du tirage : l'arbitre route la fenêtre à son siège (un d100 subi a son sujet). Absent
   *  UNIQUEMENT sur une table de MONDE (`worldOwner`), où aucun personnage n'est concerné. */
  actorId?: string;
  /** Tirage de MONDE (#1426) — Météo d'étape, événement de bord, cargaison disponible : la table
   *  n'appartient à AUCUN personnage. L'arbitre route sa fenêtre au sentinel `WORLD_STEP_OWNER`
   *  (siège MJ s'il existe, hôte sinon), exactement comme un `worldStep`. EXCLUSIF avec `actorId` :
   *  une table a un sujet, ou elle est au monde — jamais les deux, jamais aucun des deux. */
  worldOwner?: boolean;
  table: CascadeTableDecl;
  /** ENJEU du tirage — REQUIS au TYPE (#1117/#1262 V2 L6) : la famille des étapes à table est le seul
   *  mint dont TOUS les sites de production sont dotés (mesure du lot : 0 site muet hors tests), donc
   *  le compilateur y remplace le cliquet textuel. `tableStepDone` en hérite (`TableDoneSpec`), et
   *  l'enjeu redescend ensuite à la ligne jouée (`stakeAtTableRow`, `cascade.ts`). `MonoSpec` l'a
   *  rejoint (#1262 V2 L6d).
   *
   *  LES TROIS FAMILLES QUI RESTENT OUVERTES, chiffrées au TYPE le 2026-08-12 (sonde : rendre le champ
   *  requis, compter les sites de PRODUCTION qui ne compilent plus) — aucune ne tombe à 0, donc aucune
   *  ne se mure :
   *   · `RollRequest` : les 2 RELAIS génériques ici même (`openPartyTest`/`openWorldTest` transmettent
   *     l'enjeu de leur appelant) ; les 4 SONDES DE SURFACE `resolveSurface` (`seaActivities`,
   *     `seaVoyageFlow` ×3) ont disparu avec la dérivation par PORTEURS (#1479). Compte VIVANT :
   *     `BASELINE_REQ` de `cascade-step-stake-guard.test.ts`, seul chiffre qui se re-mesure ;
   *   · `BandSpec` : 9 sites (dont 4 FABRIQUES de bande génériques — `nightBands`, `combatEndBands`,
   *     `pursuitFlow`, les 2 batch de `combat/triggeredTest` — qui transmettent l'enjeu de l'étape) ;
   *   · `HostSpec` : 13 sites (les jets HÔTES d'attaque/défense/incantation/maladresse, dont l'enjeu
   *     est porté par la fenêtre du jet lui-même, cf. #1262 V2 lot 5a).
   *  La mesure textuelle survivante vit dans `cascade-step-stake-guard.test.ts` (baselines nominatives). */
  stake: StakeRef;
  /** VOIES offertes APRÈS le dé (#1426) — une étape porte une table ET un choix quand la décision se
   *  prend DEVANT le tirage qui la motive : la sévérité d'une Blessure critique se tire dans la
   *  fenêtre où le porteur choisit Dévier ou Subir. `stepInteraction` est une chaîne de PRIORITÉ :
   *  l'étape se présente en `'table'` tant que le dé n'est pas tombé, puis en `'choix'`. UNE fenêtre,
   *  jamais deux corps successifs. Même murage du texte joueur que `ChoiceSpec.options`. */
  options?: readonly { key: string; label: PlayerText; detail?: string }[];
  /** Clé retenue d'office par une résolution IMMÉDIATE — l'une des `options`. */
  defaultChoice?: string;
  /** CHARGE de l'applier « déviation » (`combatFlow`) quand elle est connue AU MINT (aucune table à
   *  tirer : variante Aux Armes, chemins auto-contenus). Avec une table, c'est le PLI post-dé
   *  (`cascade.registerCascadeTableFold`) qui la pose — le Critique n'existe qu'après le tirage. */
  deviation?: PendingDeviation;
  /** CHARGE de l'applier « sévérité du Critique » (`combatFlow`) : de quel coup le d100 posé décide.
   *  Recopiée telle quelle — une charge n'est pas une forme : elle ne rend rien et ne change pas
   *  l'interaction de l'étape, elle est ce que l'applier LIT quand le dé est posé. */
  critSeverity?: PendingCritSeverity;
  /** CHARGE de l'applier « Imparfaite/Colère » (`combatFlow`) : sévérité, domaine, relance en cours. */
  miscast?: PendingMiscastStep;
  /** CHARGE des appliers de MUTATION (`corruptionFlow`) : le porteur, l'alignement de la source, la
   *  nature déjà tirée et la table en cours — ce que l'applier LIT pour chaîner le tirage suivant. */
  mutation?: PendingMutationStep;
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR d'étape à TABLE À POSER (#1262) — le dé n'est PAS tombé : l'étape est l'interaction
 * `'table'` (`stepInteraction`), et c'est la fenêtre qui le jette (ou le pose, option « Dés fixés »).
 *
 * DEUX entrées séparées, jamais un drapeau : une table à poser et une table résolue n'ont ni les
 * mêmes champs (`result`, enjeu redescendu à la ligne jouée) ni le même cycle. Un booléen les
 * confondrait, et « résolue » sans résultat serait exprimable.
 */
export function tableStep(spec: TableSpec): BuiltCascadeStep | undefined {
  if (spec.table.result != null) {
    refusePorte(`table « ${spec.id} » (${spec.kind}) : un résultat est DÉJÀ posé sur une table à POSER `
      + '— le dé serait re-jeté par la fenêtre. Passer par `tableStepDone`. Aucun tirage ouvert.');
    return undefined;
  }
  const defaut = spec.defaultChoice != null && (spec.options ?? []).some((o) => o.key === spec.defaultChoice) ? spec.defaultChoice : undefined;
  if (spec.defaultChoice != null && defaut == null) {
    refusePorte(`table « ${spec.id} » (${spec.kind}) : `
      + `\`defaultChoice\` « ${spec.defaultChoice} » hors de ses options — écarté ; une résolution immédiate s'arrête sur ce choix.`);
  }
  if (spec.options && !spec.options.length) {
    refusePorte(`table « ${spec.id} » (${spec.kind}) : \`options\` VIDE — la fenêtre serait une impasse après le dé. Aucun tirage ouvert.`);
    return undefined;
  }
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.worldOwner ? { worldOwner: true } : { actorId: spec.actorId }),
    table: spec.table,
    stake: spec.stake,
    ...(spec.options ? { options: spec.options.map((o) => ({ ...o })) } : {}),
    ...(defaut != null ? { defaultChoice: defaut } : {}),
    ...(spec.deviation ? { deviation: spec.deviation } : {}),
    ...(spec.critSeverity ? { critSeverity: spec.critSeverity } : {}),
    ...(spec.miscast ? { miscast: spec.miscast } : {}),
    ...(spec.mutation ? { mutation: spec.mutation } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/** DÉCLARATION d'une étape à table DÉJÀ TIRÉE : la table, son résultat, et le rendu de ce qui vient
 *  d'arriver (charge riche / lignes de conséquence — l'HYBRIDE table-résolue + révélation, B5). */
export type TableDoneSpec = TableSpec & {
  result: CascadeTableResult;
  reveal?: RevealEntry;
  outcome?: RecapLine[];
};

/**
 * CONSTRUCTEUR d'étape à table RÉSOLUE (#1262) — le tirage a eu lieu chez le producteur (Critique de
 * Structure), l'étape le RAPPORTE. La pose du résultat passe par la part PURE du site unique
 * (`tableStepPosee`, `cascade.ts`), qui fait redescendre l'enjeu à la LIGNE jouée (#1117 L2) : sans
 * elle, une étape poussée déjà tirée garderait un enjeu qui ne parle que du `kind`. Un `kind` qui
 * déclare un PLI post-dé est REFUSÉ ici : son tirage doit se jouer dans une fenêtre (`tableStep`).
 */
export function tableStepDone(spec: TableDoneSpec): BuiltCascadeStep | undefined {
  const base: CascadeStep = {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    actorId: spec.actorId,
    stake: spec.stake,
    ...(spec.critSeverity ? { critSeverity: spec.critSeverity } : {}),
    ...(spec.miscast ? { miscast: spec.miscast } : {}),
    ...(spec.mutation ? { mutation: spec.mutation } : {}),
    ...(spec.reveal ? { reveal: spec.reveal } : {}),
    ...(spec.outcome ? { outcome: spec.outcome } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  };
  if (cascadeTableFolds[spec.kind]) {
    refusePorte(`table déjà tirée « ${spec.id} » (${spec.kind}) : ce \`kind\` déclare un PLI post-dé `
      + '(`registerCascadeTableFold`) qu\'aucune fenêtre ne jouera ici — le tirage doit passer par `tableStep`. Aucun tirage ouvert.');
    return undefined;
  }
  return tableStepPosee(base, spec.table, spec.result) as BuiltCascadeStep;
}

/** Ce qui est vrai de TOUTE étape d'AFFICHAGE : une conséquence DÉJÀ arrivée, donnée à LIRE. Zéro dé,
 *  zéro décision — l'étape est l'interaction `'affichage'` (`stepInteraction`), acquittée par « Continuer ». */
interface DisplayBase {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** Ce qui vient d'arriver, en lignes déjà écrites (`RecapLine[]`), rendues par le renderer partagé. */
  outcome?: RecapLine[];
  /** CHARGE de l'applier « reprise de fuite » (`combatFlow`) : qui fuit, devant qui, et combien de
   *  rangs de Brisé attendent la fin du coup gratuit (LDB 15 l.68). */
  fleeMove?: NonNullable<CascadeStep['fleeMove']>;
  meta?: CascadeStepMeta;
}

/**
 * DÉCLARATION d'une étape d'AFFICHAGE — deux possessions EXCLUSIVES, et le compilateur tient l'exclusion :
 *  - `actorId` : le CONCERNÉ (l'arbitre route la fenêtre à son siège — la conséquence est la SIENNE) ;
 *  - `worldOwner` : aucun personnage n'est concerné (la vérification d'un péril de la route, le d100
 *    du monde) — même sentinel que le côté `worldSide` d'`openWorldTest` (`buildMonoStep`) : l'arbitre
 *    route au siège MJ (`WORLD_STEP_OWNER`, `netOwnership.seatOwns`), à l'hôte à défaut. Sans cette
 *    entrée, une étape sans concerné devait mentir en nommant un porteur, ou rester hors de la porte.
 */
export type DisplaySpec = DisplayBase & (
  | { actorId: string; worldOwner?: never }
  | { worldOwner: true; actorId?: never }
);

/**
 * CONSTRUCTEUR d'étape d'AFFICHAGE (#1262) — la forme la plus pauvre de la porte, et c'est le point :
 * `reveal`, `table`, `options`, `target` n'y sont PAS déclarables. Une conséquence sans dé rendue par
 * `revealToStep` prendrait la forme d'une RÉVÉLATION — rangée `TableRollLine` et dé à l'appui — et
 * annoncerait un tirage qui n'a pas eu lieu (une lame arrachée des mains, une fuite qui reprend) ; en
 * plus, ce mint DÉRIVE `id` et `kind` de la `RevealEntry`, ce que les appliers enregistrés par `kind`
 * ne survivraient pas.
 *
 * Rien à refuser ici : une étape d'affichage est toujours prête (`stepReady`), il n'existe pas de
 * déclaration qui la rendrait injouable.
 */
export function displayStep(spec: DisplaySpec): BuiltCascadeStep {
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.worldOwner ? { worldOwner: true } : { actorId: spec.actorId }),
    ...(spec.outcome ? { outcome: spec.outcome } : {}),
    ...(spec.fleeMove ? { fleeMove: spec.fleeMove } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/** DÉCLARATION d'un dé de MONDE en ÉTAPE (#1426) — le nombre visé, ce qui se joue, rien d'autre. */
export interface WorldStepSpec {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** Le NOMBRE VISÉ du pourcentage (`dé ≤ cible`). Aucune Difficulté ne s'y applique : ce n'est pas un Test. */
  cible: number;
  /** Intitulé rendu en position de « compétence » sur la rangée. Défaut : le libellé de la situation. */
  rollLabel?: string;
  stake?: StakeRef;
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR d'un dé de MONDE (#1426) — la JUMELLE DÉCLARATIVE d'`openWorldTest` : même étape, même
 * possession (sentinel `WORLD_STEP_OWNER` via `worldOwner`), même évaluation `'seuil'` ; `openWorldTest`
 * l'OUVRE seule, `worldStep` la rend à un flux qui compose SA séquence (périls d'auteur d'une route,
 * Exposition hydrique d'une étape). Sans elle, un flux qui veut N dés de monde dans une même cascade
 * n'avait que le littéral monté à la main — la porte le refuse par le type (`BuiltCascadeStep`).
 *
 * Aucune Difficulté n'entre ici : un pourcentage d'auteur n'en a pas, et `evaluation:'seuil'` interdit
 * qu'on lui en fabrique une (ni bande, ni DR, ni écrêtage — cf. `CascadeStep.evaluation`).
 */
export function worldStep(spec: WorldStepSpec): BuiltCascadeStep {
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    worldOwner: true,
    ...(spec.rollLabel ? { rollLabel: spec.rollLabel } : {}),
    base: spec.cible,
    target: spec.cible,
    evaluation: 'seuil',
    result: null,
    ...(spec.stake ? { stake: spec.stake } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/**
 * DÉCLARATION d'un DÉ NU en ÉTAPE (#1508) — quels dés, ce qu'ils décident, pour qui. Le PENDANT du
 * `tableStep` pour les tirages dont le TOTAL est la conséquence (hauteur d'une chute, unités d'une
 * amputation, magnitude d'un effet, distance d'une dispersion) : ni table à lire, ni cible à battre.
 */
export interface DieStepSpec {
  id: string;
  kind: string;
  label: PlayerText;
  icon?: string;
  /** Les DÉS — REQUIS ici (à la différence de la déclaration persistée, où une table donne les
   *  siens) : un dé nu sans dés serait une étape prête d'office, validée sans qu'aucun dé ne tombe. */
  spec: DiceSpec;
  /** PORTEUR du dé : l'arbitre route la fenêtre à son siège. Absent UNIQUEMENT sur un dé de MONDE
   *  (`worldOwner`), où aucun personnage n'est concerné — même exclusion que `TableSpec`. */
  actorId?: string;
  worldOwner?: boolean;
  mod?: number;
  modPerActor?: CascadeTableDecl['modPerActor'];
  keepHighest?: number;
  /** Dé IMPOSÉ par le producteur (injection d'un résolveur moteur) — le tirage n'en est pas moins
   *  posé par la porte : l'étape naît NON RÉSOLUE, la fenêtre la joue. */
  forcedRoll?: number;
  /** Unité du total, pour la rangée qui le montre (« m », « jours »). */
  unite?: string;
  /** LECTURE EN SEUIL du tirage (#1508, `cascade.lireEnSeuil`) : l'Indice contre lequel le total se lit.
   *  Déclaré à l'étape — c'est lui que la rangée MONTRE (« 1d10 : 8 ≥ Protection (6+) »). */
  seuil?: SeuilDeSauvegarde;
  /** CHARGE de l'étape de sauvegarde (#1508) : les seuils restants + la suite du coup suspendu, que
   *  l'applier ré-entre (patron de la charge `fumble` d'une étape hôte — la donnée vit SUR l'étape). */
  wardSave?: PendingWardSave;
  stake?: StakeRef;
  meta?: CascadeStepMeta;
}

/**
 * CONSTRUCTEUR d'étape à DÉ NU (#1508) — CALQUE de `tableStep` : le dé n'est PAS tombé, l'étape est
 * l'interaction `'de'` (`cascade.stepInteraction`), et c'est la fenêtre qui le jette (ou le pose,
 * option « Dés fixés », gate `netOwnership.canFixDie`).
 *
 * LES DÉS sont le garde-fou, comme la cible l'est pour un mono : une déclaration à `n`/`sides` non
 * positifs ne tire rien, et l'étape serait « prête » d'office — la porte la REFUSE (DEV : throw ;
 * PROD : journalisée, aucun tirage ouvert) plutôt que d'ouvrir une fenêtre sans dé.
 */
export function dieStep(spec: DieStepSpec): BuiltCascadeStep | undefined {
  if (!(spec.spec.n > 0) || !(spec.spec.sides > 0)) {
    refusePorte(`dé « ${spec.id} » (${spec.kind}) : dés non tirables (${spec.spec.n}d${spec.spec.sides}) `
      + '— l\'étape serait un pur affichage, validé sans qu\'aucun dé ne tombe. Aucun tirage ouvert.');
    return undefined;
  }
  return {
    id: spec.id,
    kind: spec.kind,
    label: spec.label,
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.worldOwner ? { worldOwner: true } : { actorId: spec.actorId }),
    de: {
      spec: spec.spec,
      ...(spec.mod != null ? { mod: spec.mod } : {}),
      ...(spec.modPerActor ? { modPerActor: spec.modPerActor } : {}),
      ...(spec.keepHighest != null ? { keepHighest: spec.keepHighest } : {}),
      ...(spec.forcedRoll != null ? { forcedRoll: spec.forcedRoll } : {}),
      ...(spec.unite ? { unite: spec.unite } : {}),
      ...(spec.seuil ? { seuil: spec.seuil } : {}),
    },
    ...(spec.wardSave ? { wardSave: spec.wardSave } : {}),
    ...(spec.stake ? { stake: spec.stake } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/**
 * APPEND d'une étape à DÉ NU dans la séquence en cours (#1508) — patron de `pushReveal` : une
 * conséquence à dé s'AJOUTE à la cascade qui la produit (doctrine du slot, `cascade.pushStep`), jamais
 * dans une fenêtre neuve.
 *
 * Le COMPTEUR MONOTONE de la séquence (`PendingCascade.seq`) est versé dans l'id : c'est lui qui rend
 * l'étape UNIQUE, et c'est donc cet id qui sert d'identité à une grappe de dés
 * (`state/combatEffects.groupeDe`). Un compteur, jamais la longueur du tableau : celle-ci recule à
 * chaque troncature, et re-servirait l'id d'une étape survivante.
 */
export function pushDie(set: Set, spec: DieStepSpec, purpose: PendingCascade['purpose'] | ((s: GameState) => PendingCascade['purpose'])): void {
  pushStep(set, (index) => dieStep({ ...spec, id: `${spec.id}-${index}` }), purpose);
}

/** Les jets qu'une étape peut HÔTER, et le SLOT porteur de la donnée de chacun : tenus avec le
 *  manifeste des champs du store (`stateFields`), où les lit aussi la porte du curseur. */
export type { HostJet };

/**
 * ID UNIQUE DANS LA SÉQUENCE D'ACCUEIL (#1852) — `openSequence` APPEND quand une séquence du MÊME
 * `purpose` est ouverte (doctrine du slot) : un id CONSTANT y serait servi deux fois (deux défenses
 * d'un même tour, deux Tests de scène, deux attaques d'une chaîne), la première étape deviendrait
 * in-adressable, et la garde d'unicité (`cascade.assertIdsUniques`) refuserait l'append.
 *
 * Le rang vient de la DÉRIVATION UNIQUE du compteur (`cascade.compteurDeSequence`, celle-là même que
 * `pushStep` applique à l'append) : fenêtre d'insertion comprise — un hôte minté PENDANT l'application
 * d'une étape prenait sinon un rang périmé, donc un id déjà pris. `purpose` omis = la séquence en
 * place, quelle qu'elle soit (sous-jeux à séquence unique : poursuite, taverne, voyage).
 */
export function idDansLaSequence(get: Get, base: string, purpose?: PendingCascade['purpose']): string {
  return `${base}-${compteurDeSequence(get(), purpose)}`;
}

/** Ce qui est vrai de TOUTE étape hôte : elle nomme son jet, et rien du montage. */
interface HostBase {
  id: string;
  kind: string;
  label?: PlayerText;
  icon?: string;
  stake?: StakeRef;
  meta?: CascadeStepMeta;
}

/**
 * POSSESSION d'une étape HÔTE — deux formes, et le compilateur tient l'exclusion (calque `DisplaySpec`) :
 *  - `actorId` : le JETEUR, dont la possession route la fenêtre (`modalArbiter`, entrée `cascade`).
 *    `groupOwner` peut s'y ajouter pour un moment PARTAGÉ (Sort d'un ennemi : opposition de cible +
 *    Contre-sort multi, désengagement à deux acteurs joués) → owner `'*'`, le porteur restant nommé ;
 *  - `groupOwner` SEUL : un jet de GROUPE sans porteur nommé (enfoncer une porte à plusieurs, EDO
 *    Appendice 2) — chacun pilote ses héros, aucun acteur unique n'existe. Sans cette forme, le
 *    dernier producteur de `groupOwner` devait monter son étape À LA MAIN, hors de la porte (#1262 V2 L4).
 *
 * Une étape hôte dit donc TOUJOURS à qui elle appartient : `{}` ne compile pas — et `undefined`
 * rendrait la fenêtre à l'HÔTE SEUL (`netOwnership.ownsLocally`), volant le jet des autres sièges.
 */
type HostOwner =
  | { actorId: string; groupOwner?: boolean }
  | { groupOwner: true; actorId?: never };

/** DÉCLARATION d'une étape HÔTE — union DISCRIMINÉE par `jet` : la Maladresse exige sa charge (elle
 *  n'a pas de pending), les huit autres n'en portent aucune (la leur vit dans leur `pending*`). */
export type HostSpec = HostOwner & (
  | (HostBase & { jet: 'fumble'; fumble: { weapon: Weapon; result: OupsResolved | null } })
  | (HostBase & { jet: Exclude<HostJet, 'fumble'>; fumble?: never })
);

/**
 * CONSTRUCTEUR d'étape HÔTE (#1262 B6) — « une situation = une modale » : le jet d'attaque/défense/
 * incantation/… EST l'étape, et ses données vivent dans le `pending*` coexistant que la fenêtre rend
 * (`modalArbiter`, entrée `cascade`, `covers`).
 *
 * Le pending DOIT déjà être posé : une étape hôte sans sa donnée ouvre une fenêtre que son hook ne
 * sait pas rendre, et que l'auto-résolution de cadence valide à vide. Le mint le VÉRIFIE (DEV :
 * throw), d'où le `get` — un constructeur pur ne pourrait pas le savoir.
 */
export function hostStep(get: Get, spec: HostSpec): BuiltCascadeStep | undefined {
  const slot = PENDING_BY_JET[spec.jet];
  if (slot && get()[slot] == null) {
    refusePorte(`hôte « ${spec.id} » (jet:'${spec.jet}') : \`${slot}\` n'est pas posé — la fenêtre n'aurait `
      + 'aucune donnée à rendre, et la cadence auto la validerait à vide. Aucune fenêtre ouverte.');
    return undefined;
  }
  return {
    id: spec.id,
    kind: spec.kind,
    jet: spec.jet,
    ...(spec.actorId ? { actorId: spec.actorId } : {}),
    ...(spec.label ? { label: spec.label } : {}),
    ...(spec.icon ? { icon: spec.icon } : {}),
    ...(spec.groupOwner ? { groupOwner: true } : {}),
    ...(spec.jet === 'fumble' ? { fumble: spec.fumble } : {}),
    ...(spec.stake ? { stake: spec.stake } : {}),
    ...(spec.meta ? { meta: spec.meta } : {}),
  } as BuiltCascadeStep;
}

/**
 * OUVERTURE d'une SÉQUENCE d'étapes MINTÉES (#1262) — `startCascade` typé par la marque : un littéral
 * monté à la main n'entre pas ici. `startCascade` reste public et non typé : c'est la FRONTIÈRE, celle
 * par où une séquence restaurée d'une sauvegarde revient dans le slot.
 *
 * LA SURFACE EST DU SOCLE (#1479) : l'émetteur POUSSE ce qu'il met en jeu, il ne tranche plus — une
 * séquence qu'AUCUN siège humain ne tient (héros conduits par l'IA, porteurs inconnus) ou que les
 * ORDRES d'une traversée commandent de résoudre d'office se résout sur place (`runCascadeImmediate`,
 * conclusions appliquées et tracées), sinon elle ouvre sa fenêtre. RENVOIE les étapes RÉSOLUES dans le
 * premier cas, `undefined` quand la fenêtre s'est ouverte — l'appelant y lit ses lignes (recap de
 * journée) et sait s'il doit rendre la main à la fenêtre. `undefined` AUSSI quand la résolution a été
 * INTERROMPUE (combat ouvert en vol, choix sans défaut) : un préfixe n'est pas une séquence résolue.
 *
 * La cadence DÉFÉRÉE (`cadenceAuto`) n'entre PAS ici : elle est portée par le pilote d'auto-cadence
 * (`combatAuto`, qui déroule la fenêtre et en MONTRE le bilan pour les séquences de nuit/voyage) —
 * c'est la divergence 2 assumée de la famille de bandes ci-dessus, pas un oubli.
 */
export function openSequence(get: Get, set: Set, opts: {
  title: string;
  icon?: string;
  purpose: PendingCascade['purpose'];
  steps: readonly BuiltCascadeStep[];
  log?: string[];
  travelHalt?: boolean;
  roundBoundary?: boolean;
  combatEndBoundary?: boolean;
  restNights?: PendingCascade['restNights'];
}): CascadeStep[] | undefined {
  const steps = [...opts.steps];
  if (!steps.length) return undefined;
  if (surfaceDesEtapes(get, steps) === 'I') {
    const resolues = runCascadeImmediate(get, set, steps, { title: opts.title, purpose: opts.purpose, ...(opts.log ? { log: opts.log } : {}) });
    // GARDE DU CONTRAT (#1479) : `runCascadeImmediate` peut rendre un PRÉFIXE — un combat ouvert en
    // plein vol par l'applier d'une étape, ou un choix sans défaut authoré, laisse le reste de la
    // séquence en pile (`suspendedCascades`) ou dans le slot. Rendre ce préfixe comme « séquence
    // résolue » fait ENCHAÎNER l'appelant sur un dénouement que la reprise rejouera : la continuation
    // partait deux fois. La garde vit ICI, une fois, au lieu d'être recopiée chez chaque appelant.
    if (get().battle || get().pendingCascade) return undefined;
    return resolues;
  }
  startCascade(get, set, { ...opts, steps });
  return undefined;
}

/* ─────────────────────────────────────────────────────────────────────────────────────────────────
 * LES PORTES D'APPEND (#1262) — même famille, autre fenêtre : l'étape REJOINT la séquence de combat
 * en place (`pushStep(…, 'combat')`, doctrine du slot) au lieu d'en nommer une. L'appelant ne fournit
 * donc NI titre NI `purpose` : il n'ouvre rien.
 *
 * Chaque porte accepte sa déclaration OU une FABRIQUE `(index) => déclaration` : l'index d'append
 * n'est connu que dans le `set` atomique de `pushStep`, et c'est lui qui distingue deux étapes de
 * MÊME clé dans une séquence (deux Imparfaites, deux bandes de la même source). Une déclaration
 * REFUSÉE par son mint n'appende rien (la fabrique de `pushStep` rend `undefined`).
 * ───────────────────────────────────────────────────────────────────────────────────────────────── */

/** Déclaration DIRECTE ou FABRIQUE indexée. */
type Declaree<S> = S | ((index: number) => S);

const declare = <S,>(d: Declaree<S>, index: number): S => (typeof d === 'function' ? (d as (i: number) => S)(index) : d);

/** APPEND d'une bande à la séquence de combat. */
export function pushBand(get: Get, set: Set, spec: Declaree<BandRowsSpec>): void {
  pushStep(set, (index) => buildBand(get, declare(spec, index)), 'combat');
}

/** APPEND d'un choix à la séquence de combat. */
export function pushChoice(set: Set, spec: Declaree<ChoiceSpec>): void {
  pushStep(set, (index) => choiceStep(declare(spec, index)), 'combat');
}

/** APPEND d'un jet mono à la séquence de combat. */
export function pushMono(set: Set, spec: Declaree<MonoSpec>): void {
  pushStep(set, (index) => monoStep(declare(spec, index)), 'combat');
}

/** APPEND d'un tirage À POSER à la séquence de combat. */
export function pushTable(set: Set, spec: Declaree<TableSpec>): void {
  pushStep(set, (index) => tableStep(declare(spec, index)), 'combat');
}

/** APPEND d'un tirage DÉJÀ RÉSOLU à la séquence de combat. */
export function pushTableDone(set: Set, spec: Declaree<TableDoneSpec>): void {
  pushStep(set, (index) => tableStepDone(declare(spec, index)), 'combat');
}

/** APPEND d'un AFFICHAGE à la séquence de combat. */
export function pushDisplay(set: Set, spec: Declaree<DisplaySpec>): void {
  pushStep(set, (index) => displayStep(declare(spec, index)), 'combat');
}

/** APPEND d'une étape HÔTE à la séquence de combat. */
export function pushHost(get: Get, set: Set, spec: Declaree<HostSpec>): void {
  pushStep(set, (index) => hostStep(get, declare(spec, index)), 'combat');
}

/**
 * PORTE DE REPLI SANS-PILOTE (#918 phase 2a) — l'autre sortie du seam, jumelle d'`openRoll` : quand
 * AUCUN siège humain ne tient l'acteur, il n'y a rien à surfacer, le Test se roule et se rend BRUT.
 * Les flux bricolaient chacun le même invariant au call-site, donc rien n'empêchait qu'un chemin
 * voisin y amène un acteur piloté. L'invariant vit ICI, une fois.
 *
 * Prédicat : `surfaceOf` — LA définition de surface, la MÊME que `resolveSurface` (surface M), donc
 * SEAT-AGNOSTIQUE (le héros d'un AUTRE siège a un pilote : son jet n'a rien à faire ici) et
 * CADENCE-AWARE (en Rapide/Auto les jets se lancent sans influence, ce repli est alors la voie
 * normale d'un héros). `actor` absent (côté monde, conducteur sans acteur joueur) : aucun pilote
 * possible, invariant vide.
 *
 * DEV : la violation THROW (le jet silencieux se voit au premier passage) ; en PROD elle se journalise
 * en `console.error` et le jet est rendu quand même — jamais casser une partie en cours.
 *
 * `value`/`difficulty`/`rng`/`modifier` : la forme de `rollTest` (`engine/tests.ts`), passés tels quels.
 */
export function rollSansPilote(
  get: Get,
  actor: Combatant | undefined,
  value: number,
  difficulty: Difficulty = 'intermediaire',
  rng: RNG = defaultRNG,
  modifier = 0,
): TestResult {
  if (actor && surfaceOf(get, actor.id)) {
    const msg = `[seam] jet silencieux d'un acteur piloté (« ${actor.label} ») — router par openRoll/flow.`;
    console.error(msg);
    if (import.meta.env?.DEV) throw new Error(msg);
  }
  return rollTest(value, difficulty, rng, modifier);
}
