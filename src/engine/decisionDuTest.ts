/**
 * LA DÉCISION d'un `FlowTest` (#1874) : joué ou non, Difficulté EFFECTIVE, cause d'allègement, sujet du
 * jet. Seul lecteur de `gate`, `difficultyBy`, `easierIf` et `difficulty` (garde
 * `src/decision-du-test-guard.test.ts`) : les ouvreurs (`openSkillTest`, `simpleTriggeredTestStep`, bandes),
 * l'annonce de dialogue (`testAnnonce`) et la voie inline la consomment. PUR.
 */
import { DIFFICULTE_PAR_DEFAUT, type Combatant, type Difficulty } from './types';
import { evalCondition, type ConditionCtx, type FlowTest } from './flowCore';
import { groupMatch, groupesDe } from './groups';
import { actorHasSkill } from './skills';
import { hasTalent } from './magic';
import { easeDifficulty } from './tests';
import type { RefDesignee } from '../data/schemas/grammaire/ref';
import type { SujetDuJet } from '../data/schemas/grammaire/mecanique';

/** Ce que la décision lit hors du `FlowTest`. */
export interface ContexteDuTest {
  /** Évalue `gate` et chaque `difficultyBy[].cond`. */
  cc: ConditionCtx;
  /** Celui qui jette, quand la voie l'impose : ses Groupes décident `onlyGroups`/`exceptGroups`. */
  sujet?: Combatant;
  /** Les membres dont un vivant allège un Test que le sujet ne subit pas (`easierIf`). Absent : le sujet seul. */
  groupe?: readonly Combatant[];
}

/** Ce qui a permis l'allègement, en ids stables (le libellé se résout à l'affichage). */
export type CauseDAllegement = { skill: RefDesignee } | { talent: string };

/** La décision entière d'un `FlowTest` dans un contexte (`resoudreFlowTest`). */
export interface DecisionDuTest {
  /** Le Test a-t-il lieu ? Faux : ni jet ni branche, la suite du Flow continue. */
  joue: boolean;
  /** Difficulté EFFECTIVE du jeteur. */
  difficulty: Difficulty;
  /** Difficulté DÉCLARÉE (LDB 12 l.166) : celle de l'attaquant figé d'un Test opposé. */
  declaree: Difficulty;
  allegePar?: CauseDAllegement;
  /** Ce que le jet teste (LDB 12 l.7). */
  sujet: SujetDuJet;
}

/** Ceux dont la possession allège : le sujet seul sur un Test subi (LDB 12 l.197), sinon le groupe vivant. */
function allegeurs(ft: FlowTest, ctx: ContexteDuTest): readonly Combatant[] {
  const seul = ctx.sujet ? [ctx.sujet] : [];
  if (ft.noSupport === true || !ctx.groupe) return seul;
  return ctx.groupe.filter((c) => !c.dead);
}

/** La cause qui allège `ft` dans ce contexte, ou rien. */
function causeDAllegement(ft: FlowTest, ctx: ContexteDuTest): CauseDAllegement | undefined {
  const e = ft.easierIf;
  if (!e) return undefined;
  const pool = allegeurs(ft, ctx);
  if (e.hasSkill && pool.some((c) => actorHasSkill(c, e.hasSkill!))) return { skill: { id: e.hasSkill.id, ...(e.hasSkill.spec ? { spec: e.hasSkill.spec } : {}) } };
  if (e.hasTalent && pool.some((c) => hasTalent(c, e.hasTalent!))) return { talent: e.hasTalent };
  return undefined;
}

/** Les Groupes du sujet ouvrent-ils le Test (`onlyGroups`/`exceptGroups`) ? Sans sujet imposé, rien à juger. */
function groupesOuvrent(ft: FlowTest, sujet: Combatant | undefined): boolean {
  if (!sujet) return true;
  const siens = groupesDe(sujet);
  if (ft.onlyGroups && !ft.onlyGroups.some((g) => groupMatch(g, siens))) return false;
  return !ft.exceptGroups?.some((g) => groupMatch(g, siens));
}

/** LDB 16 l.54 · LDB 12 l.166 · LDB 12 l.197 */
export function resoudreFlowTest(ft: FlowTest, ctx: ContexteDuTest): DecisionDuTest {
  const declaree = ft.difficulty ?? DIFFICULTE_PAR_DEFAUT;
  const dynamique = ft.difficultyBy?.find((d) => evalCondition(d.cond, ctx.cc))?.difficulty ?? declaree;
  const allegePar = causeDAllegement(ft, ctx);
  return {
    joue: (ft.gate == null || evalCondition(ft.gate, ctx.cc)) && groupesOuvrent(ft, ctx.sujet),
    difficulty: allegePar ? easeDifficulty(dynamique, ft.easierIf?.steps ?? 1) : dynamique,
    declaree,
    ...(allegePar ? { allegePar } : {}),
    sujet: { ...(ft.skill ? { skill: structuredClone(ft.skill) } : {}), ...(ft.characteristic ? { characteristic: ft.characteristic } : {}) }, // #2097
  };
}
