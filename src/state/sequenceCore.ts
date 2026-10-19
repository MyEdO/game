/**
 * L'IMPLÉMENTATION LÉGÈRE DU CONTRAT D'ORCHESTRATEUR (#1279) — celle qui joue les systèmes SIMPLES
 * sans cérémonie : un jeu de taverne opposé n'y coûte QUE son entrée de donnée, une poursuite n'y
 * déclare que sa manche et son réducteur. Le CONTRAT (ce qu'un système déclare : état, fabrique de
 * manche, clôture-sous-id) vit à côté, dans `sequenceContract.ts`, et ne connaît AUCUNE de ses
 * implémentations : un système lourd pourra en écrire une autre sans le toucher.
 *
 * CE QUE CETTE IMPLÉMENTATION POSSÈDE, et que plus aucun système ne recopie :
 *  - le REGISTRE des définitions (l'id est la donnée, la fonction est du TS enregistré — patron
 *    `registerCascadeApplier` : un état de séquence se snapshote en JSON, une closure y serait
 *    effacée en silence) ;
 *  - la PERSISTANCE de l'état entre les manches (slot `sequence`, snapshoté avec la partie) ;
 *  - le CYCLE ouvrir→clore→rouvrir : l'ouverture par les mints (`openSequence` — un littéral d'étape
 *    n'entre pas) et la résolution IMMÉDIATE quand aucune fenêtre n'est à montrer ;
 *  - l'ACCUMULATEUR PAR CAMP (`cum: Record<camp, total>` + `sequenceCumStep`, qui délègue au Test
 *    étendu canonique `extendedTestStep`) — jamais un `cumPlayer`/`cumOpponent` recopié par jeu ;
 *  - la FORMULE DE SCORE par camp (`registerSequenceScore`, paramétrée par la donnée : `min` pour les
 *    poursuivis, `max` pour les poursuivants, `sum` pour une équipe) ;
 *  - le DÉPARTAGE D'ÉGALITÉ (`registerSequenceTieBreak`, paramétré par la donnée : Dominos NADJ 16
 *    l.105, Boules l.57) — jamais un branchement par id de jeu ;
 *  - la BORNE ANTI-BOUCLE (`SEQUENCE_MAX_ROUNDS`) : une séquence qui ne conclut pas S'ARRÊTE.
 *
 * DEUX PRIMITIVES RESTENT CHEZ ELLES tant qu'aucune manche ne les joue : la table par fourchette
 * (`findTableEntry`, `engine/tables.ts`) et les effets par manche (`applyOps`, `engine/ops.ts`). Elles
 * s'ajoutent à `SequenceParams` avec le système qui les exerce — le socle ne porte que du vocabulaire vivant.
 */
import type { Get, Set } from './flowTypes';
import { openSequence } from './rollSeam';
import {
  SEQUENCE_MAX_ROUNDS, SEQUENCE_HARD_MAX_ROUNDS, SEQUENCE_PURPOSE, SEQUENCE_BORNE,
  type SequenceDef, type SequenceParams, type SequenceState, type MancheClose, type SequenceFamilies, type EtatDeSequence,
} from './sequenceContract';
import { runCascadeImmediate, stepInteraction, stepReady } from './cascade';
import { estJete, extendedTestStep } from '../engine/tests';
import { findTableEntry, findTableEntryIndex } from '../engine/tables';
import { bonus, effectiveChar } from '../engine/characteristics';
import { applyOps, type GameOp } from '../engine/ops';
import { campAdvantageHooks } from './combat/advantagePool';
import { groupAdvantage } from '../engine/advantagePool';
import type { Combatant } from '../engine/types';
import type { CascadeStep, PendingCascade } from './pendings';
import type {
  SequenceAbandon, SequenceBoard, SequenceRoundActors, SequenceTableRow,
  SequencePotRow, SequencePotTurn, SequencePotOutcome,
  SequenceVolleyRow, SequenceVolleyRules, SequenceThrowTurn, SequenceThrowOutcome,
} from './sequenceContract';
import { actorIn } from './combatants';
import { battleRng } from './battleRng';
import { t } from '../i18n';

/** LE CONTRAT, ré-exporté par son implémentation : un système n'a qu'une porte d'entrée à importer.
 *  Sa définition, elle, vit dans `sequenceContract.ts` — qui n'importe RIEN d'ici. */
export {
  SEQUENCE_MAX_ROUNDS, SEQUENCE_HARD_MAX_ROUNDS, SEQUENCE_PURPOSE, SEQUENCE_BORNE,
} from './sequenceContract';
export type {
  SequenceDef, SequenceParams, SequenceState, SequenceRound, SequenceVerdict, SequenceCloseCtx, MancheClose,
  SequenceFamilies, EtatDeSequence, EtatDeFamille,
  SequenceTableRow, SequenceBoard, SequenceRoundActors, SequenceAbandon,
  SequencePotRow, SequencePotTurn, SequencePotOutcome,
  SequenceVolleyRow, SequenceVolleyRules, SequenceThrowTurn, SequenceThrowOutcome, SequenceSide,
  SequenceCombinedRules,
} from './sequenceContract';

/** Registre des définitions, peuplé par les modules de DOMAINE à leur chargement. */
const sequenceDefs: Record<string, SequenceDef<never>> = {};

/** Enregistre (ou remplace) la définition d'une séquence sous son id. */
export function registerSequence<K extends keyof SequenceFamilies>(id: K, def: SequenceDef<SequenceFamilies[K]>): void {
  sequenceDefs[id] = def as unknown as SequenceDef<never>;
}

/** La définition d'un id, ou `undefined` (état restauré d'une save dont le module n'a pas chargé). */
export function sequenceDefOf(id: string): SequenceDef<never> | undefined {
  return sequenceDefs[id];
}

/* ── FAMILLE (3) : FORMULE DE SCORE PAR CAMP ─────────────────────────────────────────────────────
 * Un camp rend UN nombre à partir des DR de ses participants. Poursuite (LDB 15 l.93) : les poursuivis
 * comptent leur DR le plus BAS, les poursuivants le plus HAUT. Middenball (NADJ 16 l.119) : la SOMME
 * de l'équipe. La formule est NOMMÉE en donnée (`params.score`), jamais un `if` par jeu.
 *
 * REGISTRE OUVERT, patron `registerCascadeApplier` (`state/cascade.ts`) : la table naît VIDE et se
 * peuple par sa porte d'enregistrement — ce qu'on y lit est le nom d'une FORMULE (un rôle), jamais
 * l'identité d'une entrée de catalogue (garde `registry-id-branch`, doctrine #842). */
export type SequenceScore = (values: readonly number[]) => number;

const sequenceScores: Record<string, SequenceScore> = {};

/** Enregistre (ou remplace) une formule de score de camp, sous le nom que la donnée emploiera. */
export function registerSequenceScore(formule: string, fn: SequenceScore): void {
  sequenceScores[formule] = fn;
}

registerSequenceScore('min', (v) => (v.length ? Math.min(...v) : 0));
registerSequenceScore('max', (v) => (v.length ? Math.max(...v) : 0));
registerSequenceScore('sum', (v) => v.reduce((n, x) => n + x, 0));
registerSequenceScore('first', (v) => v[0] ?? 0);

/** Applique la formule de score du camp — formule inconnue : `sum` (aucun camp ne perd son score). */
export function sequenceScoreOf(formule: string | undefined, values: readonly number[]): number {
  const fn = (formule ? sequenceScores[formule] : undefined) ?? sequenceScores.sum;
  return fn(values);
}

/* ── FAMILLE (1bis) : DÉPARTAGE D'ÉGALITÉ DÉCLARÉ ────────────────────────────────────────────────
 * Deux camps à égalité : ce que le jeu en fait est un PARAMÈTRE (`params.tieBreak`), résolu par un
 * réducteur enregistré. `units-lowest` = Dominos (NADJ 16 l.105) ; `nul` = Boules (l.57). MÊME
 * registre ouvert que les formules de score : ce qui indexe est le nom d'un DÉPARTAGE, pas un id. */
export interface SequenceTieSide {
  /** Le d100 obtenu — son chiffre des unités est le « dé d'unités » du départage. */
  roll: number;
  sl: number;
}
export type SequenceTieBreak = (a: SequenceTieSide, b: SequenceTieSide) => 'a' | 'b' | 'tie';

const sequenceTieBreaks: Record<string, SequenceTieBreak> = {};
/** Ce que le départage a LU de chaque camp, dit au joueur (résultat, journal). */
const recitsDeDepartage: Record<string, (a: SequenceTieSide, b: SequenceTieSide) => string> = {};

/** Enregistre (ou remplace) un départage d'égalité, sous le nom que la donnée emploiera, et le récit
 *  de ce qu'il a lu quand il en tient un. */
export function registerSequenceTieBreak(departage: string, fn: SequenceTieBreak, recit?: (a: SequenceTieSide, b: SequenceTieSide) => string): void {
  sequenceTieBreaks[departage] = fn;
  if (recit) recitsDeDepartage[departage] = recit;
  else delete recitsDeDepartage[departage];
}

/** L'égalité reste une égalité. */
registerSequenceTieBreak('nul', () => 'tie');
/** « les joueurs comparent le résultat de leur dé d'unités pour ce Test. Celui qui a le nombre le
 *  plus bas gagne » (NADJ 16 l.105). Le chiffre des unités d'un d100 : 100 → 0. */
registerSequenceTieBreak('units-lowest', (a, b) => {
  const ua = a.roll % 10;
  const ub = b.roll % 10;
  return ua < ub ? 'a' : ub < ua ? 'b' : 'tie';
}, (a, b) => t('sequence.departageUnites', { mien: a.roll % 10, sien: b.roll % 10 }));

/** Le récit du départage DÉCLARÉ (ce qu'il a lu de chaque camp) — `undefined` s'il n'en tient pas. */
export function recitDuDepartage(departage: string | undefined, a: SequenceTieSide, b: SequenceTieSide): string | undefined {
  const recit = departage ? recitsDeDepartage[departage] : undefined;
  return recit ? recit(a, b) : undefined;
}

/** Départage une égalité selon le nom DÉCLARÉ. Aucun (ou inconnu) : l'égalité reste. */
export function resolveSequenceTie(departage: string | undefined, a: SequenceTieSide, b: SequenceTieSide): 'a' | 'b' | 'tie' {
  const fn = departage ? sequenceTieBreaks[departage] : undefined;
  return fn ? fn(a, b) : 'tie';
}

/* ── FAMILLE (5) : MISE, POT, ABANDON, ÉLIMINATION ───────────────────────────────────────────
 * Un tour rend un TOTAL de dés ; la plage où il tombe déclare l'EFFET DE POT qui s'ensuit (`Al-zahr,
 * NADJ 16 l.17`). MÊME registre ouvert que les formules de score et les départages : ce qui indexe
 * est le nom d'un EFFET (un rôle), jamais l'identité d'une entrée de catalogue (garde
 * `registry-id-branch`, doctrine #842). Les effets sont PURS : ils lisent le tour, ils rendent des
 * conséquences — le réducteur du domaine tient les bourses, les joueurs et l'ordre du tour. */
export type SequencePotEffectFn = (turn: SequencePotTurn) => SequencePotOutcome;

const sequencePotEffects: Record<string, SequencePotEffectFn> = {};

/** Enregistre (ou remplace) un effet de pot, sous le nom que la donnée emploiera. */
export function registerSequencePotEffect(effet: string, fn: SequencePotEffectFn): void {
  sequencePotEffects[effet] = fn;
}

/** Le joueur RAFLE le pot et remporte la manche (`NADJ 16 l.17`). */
registerSequencePotEffect('rafle-le-pot', () => ({ wins: true }));
/** Le joueur REPREND `mises` mises dans le pot (`NADJ 16 l.17`) — le pot ne rend jamais plus qu'il
 *  ne contient. */
registerSequencePotEffect('reprend-mise', (t) => ({ takes: Math.min(t.ante * t.mises, t.pot) }));
/** Le total ATTEINT la cible (manche remportée) ou la PASSE au joueur suivant (`NADJ 16 l.17`). */
registerSequencePotEffect('cible-ou-passe', (t) => (t.roll === t.target ? { wins: true } : { target: t.roll }));
/** Le joueur REMET `mises` mises au pot, ou ABANDONNE la manche (`NADJ 16 l.17`). */
registerSequencePotEffect('remise-ou-abandon', (t) => ({ choose: true, owes: t.ante * t.mises }));
/** Le joueur QUITTE la manche (`NADJ 16 l.17`). */
registerSequencePotEffect('quitte-la-manche', () => ({ out: true }));

/** La PLAGE du total qui couvre ce tour, ou `undefined` si la séquence ne déclare aucun pot. Lue par
 *  la primitive PARTAGÉE du dépôt (`findTableEntry`) — aucun `find` par fourchette n'est réécrit. */
export function sequencePotRow(params: SequenceParams, total: number): SequencePotRow | undefined {
  const rows = params.pot?.rows;
  return rows?.length ? findTableEntry([...rows], total) : undefined;
}

/** CONSÉQUENCES d'un tour : la plage trouvée, puis son effet ENREGISTRÉ, appelé avec le PARAMÈTRE de
 *  cette plage (`mises`, défaut 1) — l'appelant ne le lit pas, la donnée le porte. Plage ou effet
 *  inconnus : aucune conséquence (jamais un repli qui invente une sortie ou un gain). */
export function resolveSequencePotTurn(
  params: SequenceParams,
  turn: Omit<SequencePotTurn, 'mises'>,
): { row?: SequencePotRow; outcome: SequencePotOutcome } {
  const row = sequencePotRow(params, turn.roll);
  const fn = row ? sequencePotEffects[row.potEffectId] : undefined;
  return { ...(row ? { row } : {}), outcome: fn ? fn({ ...turn, mises: row?.mises ?? 1 }) : {} };
}

/**
 * L'ISSUE d'un tour, en une phrase — ce que le lancer vient de PRODUIRE, pas la plage où il tombe.
 * La distinction est nécessaire : une même plage peut porter deux issues (atteindre la cible, ou la
 * passer au suivant), et une fenêtre qui n'annonce que la plage laisse le joueur découvrir sa
 * victoire à l'écran d'après. Rendue par le SOCLE (l'issue appartient à la famille), affichée par
 * qui veut ; `undefined` = aucune conséquence nommable, l'appelant garde le libellé de sa plage.
 */
export function sequencePotIssue(outcome: SequencePotOutcome): string | undefined {
  if (outcome.wins) return t('seqPot.issueRafle');
  if (outcome.out) return t('seqPot.issueSort');
  if (outcome.takes) return t('seqPot.issueReprend');
  if (outcome.choose) return t('seqPot.issueRemise');
  if (outcome.target != null) return t('seqPot.issueCible', { cible: outcome.target });
  return undefined;
}

/* ── FAMILLE (7) : VOLÉE — CE QUE RAPPORTE UN LANCER ─────────────────────────────────────────────
 * Un passage rend N lancers ; chaque lancer rapporte ce que son EFFET DÉCLARÉ dit qu'il rapporte
 * (`SequenceVolleyRules.gain`, et ses formes exceptionnelles `critique`/`maladresse`/`depassement`).
 * MÊME registre ouvert que les formules de score, les départages et les effets de pot : ce qui indexe
 * est le nom d'un EFFET (un rôle), jamais l'identité d'une entrée de catalogue (garde
 * `registry-id-branch`, doctrine #842). Les effets sont PURS : ils lisent le lancer, ils rendent un
 * gain — le réducteur du domaine tient les camps, les passages et les scores. */
export type SequenceThrowFn = (turn: SequenceThrowTurn) => SequenceThrowOutcome;

const sequenceThrows: Record<string, SequenceThrowFn> = {};

/** Enregistre (ou remplace) un effet de lancer, sous le nom que la donnée emploiera. */
export function registerSequenceThrow(effet: string, fn: SequenceThrowFn): void {
  sequenceThrows[effet] = fn;
}

/** Le DR du lancer, jamais négatif — sans égard à ce qu'il reste à prendre. */
registerSequenceThrow('dr', (t) => ({ gain: Math.max(0, t.sl) }));
/** Le DR du lancer, ÉCRÊTÉ à la réserve restante : on ne prend pas plus qu'il n'y a (`NADJ 16 l.42`). */
registerSequenceThrow('dr-ecrete', (t) => ({ gain: Math.max(0, Math.min(t.sl, t.reserve ?? t.sl)) }));
/** TOUTE la réserve restante (`NADJ 16 l.42`). */
registerSequenceThrow('toute-la-reserve', (t) => ({ gain: t.reserve ?? 0 }));
/** Les points de la LIGNE désignée, sur une réussite (`NADJ 16 l.70`). */
registerSequenceThrow('points-de-la-ligne', (t) => ({ gain: t.success ? (t.row?.points ?? 0) : 0 }));
/** Les points de la ligne SUIVANTE de la table (`NADJ 16 l.70`) — la dernière ligne n'en a pas de
 *  suivante : elle rend la sienne. */
registerSequenceThrow('points-de-la-ligne-suivante', (t) => ({
  gain: t.rows[(t.rowIndex ?? -1) + 1]?.points ?? t.row?.points ?? 0,
}));
/** Les CHIFFRES du dé : sur une réussite, le lanceur tranche entre unités, dizaines et leurs dizaines ;
 *  sur un échec, le chiffre des unités (`NADJ 16 l.97`). */
registerSequenceThrow('chiffres-du-de', (t) => {
  const unites = t.roll % 10;
  const dizaines = Math.floor(t.roll / 10) % 10;
  if (!t.success) return { gain: unites };
  return { choix: [...new Set([unites, dizaines, unites * 10, dizaines * 10])].sort((a, b) => a - b) };
});
/** Un gain que le lanceur fixe LIBREMENT dans la plage déclarée (`NADJ 16 l.97`) — la PLAGE est
 *  rendue telle quelle (`libre`), jamais énumérée : c'est une SAISIE, pas une liste de valeurs. */
registerSequenceThrow('gain-au-choix', (t) => (t.libre ? { libre: t.libre } : {}));
/** Aucun gain (`NADJ 16 l.97`). */
registerSequenceThrow('aucun-gain', () => ({ gain: 0 }));
/** Aucun gain, et le PASSAGE s'arrête là (`NADJ 16 l.97`). */
registerSequenceThrow('termine-le-passage', () => ({ gain: 0, ends: true }));

/** La LIGNE que DÉSIGNE une grandeur (`pick: 'reserve'`), avec son rang — `{}` si la séquence n'en
 *  déclare aucune, ou si aucune plage ne la couvre. Lue par la primitive PARTAGÉE du dépôt
 *  (`findTableEntryIndex`) — aucun `find` par fourchette n'est réécrit. */
export function sequenceThrowRow(rules: SequenceVolleyRules, valeur: number): { row?: SequenceVolleyRow; rowIndex?: number } {
  const plages = (rules.rows ?? []).filter((r): r is SequenceVolleyRow & { min: number; max: number } => r.min != null && r.max != null);
  if (!plages.length) return {};
  const i = findTableEntryIndex([...plages], valeur);
  return i < 0 ? {} : { row: plages[i], rowIndex: rules.rows!.indexOf(plages[i]) };
}

/** CE QUE RAPPORTE un lancer : l'effet de sa forme (Critique, Maladresse, ordinaire), appelé avec le
 *  tour. Effet inconnu ou non déclaré : aucun gain (jamais un repli qui invente un score). */
export function resolveSequenceThrow(rules: SequenceVolleyRules, turn: SequenceThrowTurn): SequenceThrowOutcome {
  const nom = turn.critique && rules.critique ? rules.critique
    : turn.maladresse && rules.maladresse ? rules.maladresse
      : rules.gain;
  const fn = nom ? sequenceThrows[nom] : undefined;
  return fn ? fn({ ...turn, libre: turn.libre ?? rules.libre }) : {};
}

/** CE QUE DEVIENT un gain face à la cible EXACTE déclarée : le dépasser déclenche l'effet DÉCLARÉ
 *  (`depassement`). Sans cible ni effet, le gain passe tel quel — le socle n'invente rien. */
export function sequenceThrowGain(rules: SequenceVolleyRules, turn: SequenceThrowTurn, gain: number): SequenceThrowOutcome {
  if (rules.exact == null || turn.points + gain <= rules.exact) return { gain };
  const fn = rules.depassement ? sequenceThrows[rules.depassement] : undefined;
  return fn ? fn({ ...turn, gain }) : { gain };
}

/** BORNE en manches d'une volée : ses passages (déclarés par la règle, ou l'unité de borne quand la
 *  règle n'en fixe aucun) × lanceurs × lancers — une manche de cette famille n'est QU'UN lancer. La
 *  ligne CHOISIE par le lanceur en coûte une seconde (la décision précède le jet, et personne ne
 *  lance avant d'avoir dit ce qu'il vise). 0 si la séquence ne déclare aucun passage : la borne du
 *  socle s'applique alors. */
export function sequenceVolleyRounds(rules: SequenceVolleyRules, lanceurs: number): number {
  const passages = rules.manches ?? rules.manchesBorne ?? 0;
  const parLancer = rules.pick === 'choix' ? 2 : 1;
  return passages > 0 ? passages * Math.max(1, lanceurs) * Math.max(1, rules.throws) * parLancer : 0;
}

/* ── FAMILLE (1) : ACCUMULATEUR PAR CAMP ─────────────────────────────────────────────────────────*/

/** Un pas de cumul POUR UN CAMP — délègue au Test étendu canonique (`extendedTestStep`, LDB 12
 *  l.170-179 : le DR du Round s'ajoute, le total est planché à 0, `done` à la cible). Le socle
 *  l'appelle UNE FOIS PAR CAMP sur le MÊME état : plus aucun jeu ne tient deux compteurs jumeaux. */
export function sequenceCumStep<P>(
  seq: SequenceState<P>,
  camp: string,
  r: { success: boolean; sl: number },
): { total: number; done: boolean } {
  return extendedTestStep(seq.cum[camp] ?? 0, r, seq.params.target ?? Number.POSITIVE_INFINITY);
}

/** Les cumuls de TOUS les camps après leur manche — un seul appel, un Record neuf. */
export function sequenceCumRound<P>(
  seq: SequenceState<P>,
  rounds: Record<string, { success: boolean; sl: number }>,
): { cum: Record<string, number>; done: string[] } {
  const cum: Record<string, number> = { ...seq.cum };
  const done: string[] = [];
  for (const [camp, r] of Object.entries(rounds)) {
    const step = sequenceCumStep(seq, camp, r);
    cum[camp] = step.total;
    if (step.done) done.push(camp);
  }
  return { cum, done };
}

/* ── FAMILLE (2) : TABLE DE SCORE PAR PLAGE DE DR ────────────────────────────────────────────────
 * Le foyer des tables est la DONNÉE (`params.table`) ; la lecture est la primitive PARTAGÉE du
 * dépôt (`findTableEntry`, `engine/tables.ts`) — aucun jeu ne réécrit un `find` par fourchette. */

/** L'entrée de table couvrant ce DR, ou `undefined` si la séquence n'en déclare aucune. */
export function sequenceTableRow(params: SequenceParams, sl: number): SequenceTableRow | undefined {
  const table = params.table;
  return table?.length ? findTableEntry([...table], sl) : undefined;
}

/* ── FAMILLE (3bis) : BONUS DE CARACTÉRISTIQUE AJOUTÉ AU DR ──────────────────────────────────────*/

/** Bonus de Caractéristique DÉCLARÉ (`params.drBonus`) d'un porteur, 0 sans déclaration. La
 *  Caractéristique est lue à l'accesseur CANONIQUE (`effectiveChar`) : États, séquelles et passifs y
 *  sont compris — un bras de fer se joue avec la Force qu'on a ce soir-là, pas celle de la fiche
 *  (`LDB 16`). Un camp ABSTRAIT n'a pas de Combatant : son Bonus se lit sur la valeur nue que la
 *  table lui donne (chiffre des dizaines, `engine/characteristics.bonus`). */
export function sequenceDrBonus(params: SequenceParams, actor: Combatant | undefined, valeurNue?: number): number {
  if (!params.drBonus) return 0;
  return actor ? bonus(effectiveChar(actor, params.drBonus)) : bonus(valeurNue ?? 0);
}

/* ── FAMILLE (4) : EFFETS PAR MANCHE ─────────────────────────────────────────────────────────────
 * Le socle DÉCLENCHE ce que la donnée DÉCLARE (`params.rounds`), `applyOps` exécute : aucune op
 * n'est écrite ici, aucun jeu n'est nommé. */

/** Intervalle d'attrition EFFECTIF pour un porteur (nombre fixe, ou son Bonus de Caractéristique) —
 *  0 (ou moins) = aucune attrition possible pour lui. */
export function sequenceAttritionEvery(params: SequenceParams, actor: Combatant | undefined): number {
  const every = params.rounds?.attritionEvery;
  if (every == null) return 0;
  if (typeof every === 'number') return every;
  return actor ? bonus(effectiveChar(actor, every.charBonus)) : 0;
}

export const PERTE_DU_TOUR: readonly GameOp[] = [{ op: 'spendAdvantage' }]; // LDB 14 l.219 ; AA 11 l.42-44
export const DECROISSANCE_DU_TOUR: readonly GameOp[] = [{ op: 'spendAdvantage', amount: 1 }]; // LDB 14 l.219 ; AA 11 l.44

/**
 * Applique les ops DÉCLARÉES d'une manche : `winner` aux vainqueurs de la manche, `attrition` à tous
 * les porteurs dont l'intervalle échoit à cette manche. Les porteurs sont NOMMÉS PAR ID (résolus ici,
 * `actorIn`) : c'est le socle qui déclenche, le réducteur du domaine reste PUR. Rend les lignes.
 *
 * `conclut` = la manche a CONCLU la séquence. L'ATTRITION ne s'y applique pas : elle est le prix des
 * manches qui PASSENT sans que la partie se décide (« Pour chaque Bonus d'Endurance tours qui passent
 * sans que personne n'ait gagné », NADJ 16 l.34) — la manche qui donne un vainqueur n'est pas de
 * celles-là. C'est un invariant de la FAMILLE, tenu ICI : aucun client n'a à s'en souvenir. Les ops de
 * `winner`, elles, tombent aussi sur la manche conclusive (le vainqueur du tour reste le vainqueur du
 * tour, l.34). Sous `SequenceParams.avantage`, hors Avantage de groupe : `PERTE_DU_TOUR` aux perdants,
 * `DECROISSANCE_DU_TOUR` aux autres non-vainqueurs. LDB 14 l.219 ; AA 11 l.42-44.
 */
export function sequenceRoundOps<P>(
  get: Get,
  seq: SequenceState<P>,
  round: number,
  targets: SequenceRoundActors,
  conclut = false,
): string[] {
  const decl = seq.params.rounds ?? {};
  const porteur = (id: string): Combatant | undefined => actorIn(get(), id);
  const lines: string[] = [];
  const appliquer = (ops: readonly GameOp[] | undefined, ids: readonly string[] | undefined): void => {
    if (!ops?.length) return;
    for (const id of ids ?? []) {
      const c = porteur(id);
      if (c) lines.push(...applyOps(c, [...ops], { caster: c, ...campAdvantageHooks(get) }));
    }
  };
  appliquer(decl.winner, targets.winners);
  if (seq.params.avantage && !groupAdvantage()) {
    appliquer(PERTE_DU_TOUR, targets.losers);
    appliquer(DECROISSANCE_DU_TOUR, (targets.all ?? []).filter((id) => !targets.winners?.includes(id) && !targets.losers?.includes(id)));
  }
  if (decl.attrition?.length && !conclut) {
    for (const id of targets.all ?? []) {
      const c = porteur(id);
      const every = c ? sequenceAttritionEvery(seq.params, c) : 0;
      if (c && every > 0 && round % every === 0) lines.push(...applyOps(c, [...decl.attrition], { caster: c }));
    }
  }
  return lines;
}

/* ── FAMILLE (6) : PHASES (mi-temps) ─────────────────────────────────────────────────────────────*/

/** Découpe d'une manche en PHASES déclarées : la phase courante (1-based), son rang interne, et si
 *  c'est la DERNIÈRE manche prévue. Sans déclaration : une seule phase, jamais la dernière. */
export function sequencePhaseOf(params: SequenceParams, round: number): {
  phase: number; count: number; roundInPhase: number; rounds: number; total: number; last: boolean;
} {
  const ph = params.phases;
  if (!ph || ph.count < 1 || ph.rounds < 1) {
    return { phase: 1, count: 1, roundInPhase: round, rounds: 0, total: 0, last: false };
  }
  const total = ph.count * ph.rounds;
  const borne = Math.max(1, Math.min(round, total));
  return {
    phase: Math.min(ph.count, Math.floor((borne - 1) / ph.rounds) + 1),
    count: ph.count,
    roundInPhase: ((borne - 1) % ph.rounds) + 1,
    rounds: ph.rounds,
    total,
    last: round >= total,
  };
}

/** TABLEAU DE MARQUE de la séquence en cours (affichage) — rendu par la définition du système, jamais
 *  dérivé par l'UI. `null` sans séquence, ou quand le système n'en déclare pas. */
export function sequenceBoardOf(get: Get): SequenceBoard | null {
  const seq = activeSequence(get);
  if (!seq) return null;
  return sequenceDefOf(seq.def)?.board?.(get, seq as SequenceState<never>) ?? null;
}

/* ── LE CYCLE : ouvrir → clore → rouvrir/dénouer ─────────────────────────────────────────────────*/

/** Borne EFFECTIVE de manches : celle que la séquence DÉCLARE (`maxRounds`) ou, à défaut, celle du
 *  socle — toujours ramenée sous le plafond absolu du contrat. Une séquence à PHASES (famille 6)
 *  borne AUSSI au total qu'elle déclare : ses mi-temps ne se jouent pas indéfiniment. */
function borneOf(params: SequenceParams): number {
  const total = sequencePhaseOf(params, 1).total;
  return Math.min(
    params.maxRounds ?? SEQUENCE_MAX_ROUNDS,
    total > 0 ? total : SEQUENCE_HARD_MAX_ROUNDS,
    SEQUENCE_HARD_MAX_ROUNDS,
  );
}

/**
 * DÉMARRE une séquence : pose son état PUIS ouvre la 1ʳᵉ manche. `def` doit être enregistrée (un id
 * inconnu ne pose rien — mieux vaut aucune séquence qu'une séquence qu'aucun réducteur ne clôt).
 */
export function startSequence<P>(
  get: Get, set: Set,
  init: { def: string; params?: SequenceParams; payload: P; cum?: Record<string, number> },
): void {
  if (!sequenceDefOf(init.def)) {
    console.error(`[sequence] définition « ${init.def} » inconnue — aucune séquence ouverte.`);
    return;
  }
  const state: SequenceState<P> = {
    def: init.def, round: 0, cum: init.cum ?? {}, params: init.params ?? {}, payload: init.payload,
  };
  set({ sequence: state as EtatDeSequence });
  openSequenceRound(get, set);
}

/** La séquence EN COURS, typée par son domaine (le socle ne vérifie pas la charge : elle est à lui). */
export function activeSequence<P>(get: Get): SequenceState<P> | null {
  return (get().sequence as SequenceState<P> | null) ?? null;
}

/** Met à jour la charge utile de la séquence en cours (le domaine possède `payload`, pas le socle). */
export function setSequencePayload<P>(get: Get, set: Set, payload: P): void {
  const seq = activeSequence<P>(get);
  if (!seq) return;
  set({ sequence: { ...seq, payload } as EtatDeSequence });
}

/**
 * Met à jour l'ACCUMULATEUR PAR CAMP de la séquence en cours EN COURS DE MANCHE — la porte du socle
 * pour ce que le réducteur de clôture ne peut pas rendre : une étape APPENDÉE à la fenêtre (la
 * sanction d'un lanceur, `SequenceParams.throwerPenalty`) compte AVANT que la manche ne se close, et
 * son applier n'a pas de verdict à rendre. Jumelle de `setSequencePayload`, sur le champ que possède
 * le SOCLE : c'est ce qui évite qu'un système ne se remette à tenir son compteur dans sa charge utile.
 */
export function setSequenceCum(get: Get, set: Set, cum: Record<string, number>): void {
  const seq = activeSequence(get);
  if (!seq) return;
  set({ sequence: { ...seq, cum } as EtatDeSequence });
}

/** Retire la séquence en cours (dénouement, abandon) — sans dénouer : l'appelant joue sa suite. */
export function clearSequence(set: Set): void {
  set({ sequence: null });
}

/**
 * OUVRE la manche suivante : incrémente le rang, demande sa déclaration au domaine, l'ouvre par la
 * porte des mints (`openSequence`). Une manche `immediate` (aucune fenêtre à montrer) est résolue
 * d'office et CLOSE dans la foulée — le cycle ne s'arrête pas sur une cadence auto.
 * Déclaration `undefined` = plus aucun participant : la séquence s'éteint (état retiré).
 */
export function openSequenceRound(get: Get, set: Set): void {
  const seq = activeSequence(get);
  if (!seq) return;
  const def = sequenceDefOf(seq.def);
  if (!def) { clearSequence(set); return; }
  const next = { ...seq, round: seq.round + 1 } as EtatDeSequence;
  const rng = battleRng();
  const manche = def.round(get, next as never, rng);
  if (!manche || !manche.steps.length) { clearSequence(set); return; }
  if (manche.payload !== undefined) next.payload = manche.payload;
  set({ sequence: next });
  // Résolue sur place (manche `immediate`, ou porte rendue en branche I) : la manche se CLÔT ici ; une
  // fenêtre ouverte ou un pilote interrompu (`undefined`) laisse la clôture à `dispatchCascadeDone`.
  const resolues = manche.immediate
    ? runCascadeImmediate(get, set, [...manche.steps], { title: manche.title, purpose: SEQUENCE_PURPOSE, log: manche.log })
    : openSequence(get, set, {
      title: manche.title,
      ...(manche.icon ? { icon: manche.icon } : {}),
      purpose: SEQUENCE_PURPOSE,
      steps: manche.steps,
      ...(manche.log ? { log: manche.log } : {}),
    });
  if (!resolues) return;
  for (const l of manche.log ?? []) get().log(l);
  closeSequenceRound(get, set, { participants: resolues });
}

/**
 * CLÔT la manche jouée : passe les rangées closes au RÉDUCTEUR du domaine, applique son verdict
 * (cumuls/charge), puis ROUVRE ou DÉNOUE. La BORNE est tenue ICI, une fois pour tous les jeux : un
 * verdict « continue » à la borne devient une fin sur l'issue réservée `SEQUENCE_BORNE`.
 */
export function closeSequenceRound(get: Get, set: Set, done: MancheClose): void {
  const seq = activeSequence(get);
  if (!seq) return;
  const def = sequenceDefOf(seq.def);
  if (!def) { clearSequence(set); return; }
  // Manche ABANDONNÉE avant tout jet (LDB 12 l.176) : elle n'est pas jouée — aucun réducteur, et le
  // dénouement compte les manches jouées, celle-ci exclue.
  if (seq.abandon !== undefined && !done.participants.some(jetPose)) {
    clearSequence(set);
    def.settle?.(get, set, { ...seq, round: seq.round - 1 } as never, seq.abandon);
    return;
  }
  const verdict = def.close({ get, seq: seq as never, done, rng: battleRng() });
  const apres = {
    ...seq,
    ...(verdict.cum ? { cum: verdict.cum } : {}),
    ...(verdict.payload !== undefined ? { payload: verdict.payload } : {}),
  } as EtatDeSequence;
  const borne = verdict.go === 'continue' && apres.round >= borneOf(apres.params);
  // EFFETS DE MANCHE (famille 4) : le socle DÉCLENCHE ce que la donnée déclare, sur les porteurs que
  // le verdict NOMME — le réducteur du domaine, lui, ne mute rien. La manche qui CONCLUT (verdict de
  // fin, ou borne atteinte) est dite comme telle : l'attrition ne frappe que les manches qui passent.
  const effets = verdict.roundActors
    ? sequenceRoundOps(get, apres as SequenceState, apres.round, verdict.roundActors, verdict.go === 'end' || borne)
    : [];
  for (const l of [...(verdict.log ?? []), ...effets]) get().log(l);
  // Fin de la séquence : son issue, sinon l'abandon demandé (`SequenceState.abandon`), sinon la borne.
  const outcome = verdict.go === 'end' ? verdict.outcome : seq.abandon ?? (borne ? SEQUENCE_BORNE : undefined);
  if (outcome === undefined) {
    set({ sequence: apres });
    openSequenceRound(get, set);
    return;
  }
  if (outcome === SEQUENCE_BORNE) get().log(t('seq.borne', { max: borneOf(apres.params) }));
  clearSequence(set);
  def.settle?.(get, set, apres as never, outcome);
}

/** Un jet de l'étape est POSÉ : Test, table ou dé résolu ; sur une bande, les rangées INTERACTIVES
 *  seules (une rangée témoin naît roulée, `cascade.ts` ouverture), toutes si la bande n'en a aucune.
 *  Choix, quantité, affichage : aucun jet. */
function jetPose(s: CascadeStep): boolean {
  if (s.target != null) return estJete(s.result);
  if (s.table) return s.table.result != null;
  if (s.de) return s.de.result != null;
  if (!s.participants) return false;
  const joueurs = s.participants.filter((r) => r.interactive !== false);
  return (joueurs.length ? joueurs : s.participants).some((r) => estJete(r.result));
}

/** La manche en cours est ENTAMÉE : un jet d'une étape ouverte (index ≤ curseur) est posé. LDB 12 l.176. */
function mancheEntamee(pc: PendingCascade): boolean {
  return pc.participants.slice(0, pc.cursor + 1).some(jetPose);
}

/** L'ABANDON de la séquence en cours (`SequenceDef.abandon`) et, s'il est FERMÉ, sa raison (`refus`) —
 *  `null` sans séquence, quand sa définition n'en déclare pas, ou quand la fenêtre ouverte n'est pas
 *  celle de la séquence (étape hébergée). Fermé : déjà DEMANDÉ (il attend la clôture de la manche),
 *  fermé par la déclaration du domaine (son `refus`), ou manche entamée sans être résolue (LDB 12
 *  l.176, NADJ 16 l.111) — la raison dit alors la nature de l'étape due (`stepInteraction`). UNE
 *  lecture, pour la fenêtre ET pour l'action. */
export function sequenceAbandonEtatOf(get: Get): SequenceAbandon | null {
  const seq = activeSequence(get);
  const pc = get().pendingCascade;
  if (!seq || pc?.purpose !== SEQUENCE_PURPOSE) return null;
  const abandon = sequenceDefOf(seq.def)?.abandon?.(seq as SequenceState<never>);
  if (!abandon) return null;
  if (seq.abandon !== undefined) return { ...abandon, refus: t('seq.abandonDemande') };
  if (abandon.refus !== undefined) return abandon;
  const due = pc.participants.find((s) => !stepReady(s, get()));
  if (!due || !mancheEntamee(pc)) return abandon;
  const interaction = stepInteraction(due);
  const refus = interaction === 'choix' || interaction === 'quantite' ? t('seq.abandonChoixEnCours') : t('seq.abandonEntreDeuxTests');
  return { ...abandon, refus };
}

/** L'abandon OFFERT (`sequenceAbandonEtatOf` ouvert), `null` sinon. */
export function sequenceAbandonOf(get: Get): SequenceAbandon | null {
  const etat = sequenceAbandonEtatOf(get);
  return etat && etat.refus === undefined ? etat : null;
}

/** ABANDON de la séquence en cours (le joueur renonce) : POSE la demande (`SequenceState.abandon`), que
 *  les gestes du joueur portent jusqu'à la clôture de la manche (`pasVersLAbandon`) — UNE queue de
 *  clôture, celle de toute cascade. `closeSequenceRound` joue l'abandon au lieu de rouvrir : la manche
 *  résolue se clôt, étapes dues comprises ; la manche sans jet posé n'est pas jouée. Le domaine joue
 *  son dénouement sur l'issue que SA déclaration d'abandon nomme. */
export function abandonSequence(get: Get, set: Set): void {
  const seq = activeSequence(get);
  const abandon = sequenceAbandonOf(get);
  if (!seq || !abandon) return;
  set({ sequence: { ...seq, abandon: abandon.outcome } as EtatDeSequence });
}

/** Le geste du joueur qui rapproche la clôture d'une manche dont l'abandon est DEMANDÉ : `'suivant'`
 *  (l'étape courante est prête), `'terminer'` (bilan, ou manche sans jet posé : elle se ferme sans être
 *  jouée), `null` (pas de demande, ou une étape due attend le joueur). */
export function pasVersLAbandon(get: Get): 'suivant' | 'terminer' | null {
  const pc = get().pendingCascade;
  if (activeSequence(get)?.abandon === undefined || pc?.purpose !== SEQUENCE_PURPOSE) return null;
  if (!mancheEntamee(pc)) return 'terminer';
  const cur = pc.participants[pc.cursor];
  if (!cur) return 'terminer';
  return stepReady(cur, get()) ? 'suivant' : null;
}
