import { describe, expect, it } from 'vitest';
import { resoudreFlowTest, type ContexteDuTest } from './decisionDuTest';
import type { Condition, FlowTest } from './flowCore';
import { buildActorView } from './actorView';
import { easeDifficulty } from './tests';
import { DIFFICULTE_PAR_DEFAUT, type Combatant, type Difficulty } from './types';
import { combattantDeTest } from './combattantDeTest.testkit';

/** #1874 — la décision d'un `FlowTest` : table de vérité `gate × difficultyBy × easierIf × défaut`, puis la
 *  voie (subi / volontaire), les Groupes et la Difficulté déclarée d'un Test opposé. */

const VRAI: Condition = { kind: 'flag', expr: 'oui' };
const FAUX: Condition = { kind: 'flag', expr: 'non' };
const cc = { flags: { oui: true }, gameTime: 0 };
const PERCEPTION = { id: 'perception' };
const artificier = combattantDeTest({ id: 'a', skills: [{ id: 'projectiles', spec: 'poudre-noire', characteristic: 'capacite-de-tir', advances: 5 }] });
const profane = combattantDeTest({ id: 'p' });
const PROJECTILES = { hasSkill: { id: 'projectiles', spec: 'poudre-noire' } };

describe('resoudreFlowTest — table de vérité gate × difficultyBy × easierIf × défaut', () => {
  const axes: {
    gate: (Condition | undefined)[]; difficultyBy: FlowTest['difficultyBy'][]; easierIf: FlowTest['easierIf'][];
    difficulty: (Difficulty | undefined)[]; allegeur: Combatant[];
  } = {
    gate: [undefined, VRAI, FAUX],
    difficultyBy: [undefined, [{ cond: VRAI, difficulty: 'accessible' }], [{ cond: FAUX, difficulty: 'accessible' }]],
    easierIf: [undefined, PROJECTILES],
    difficulty: [undefined, 'difficile'],
    allegeur: [artificier, profane],
  };
  const cas = axes.gate.flatMap((gate) => axes.difficultyBy.flatMap((difficultyBy) => axes.easierIf.flatMap((easierIf) =>
    axes.difficulty.flatMap((difficulty) => axes.allegeur.map((allegeur) => ({ gate, difficultyBy, easierIf, difficulty, allegeur }))))));

  it.each(cas)('%#', ({ gate, difficultyBy, easierIf, difficulty, allegeur }) => {
    const ft: FlowTest = { skill: PERCEPTION, ...(gate ? { gate } : {}), ...(difficultyBy ? { difficultyBy } : {}), ...(easierIf ? { easierIf } : {}), ...(difficulty ? { difficulty } : {}) };
    const d = resoudreFlowTest(ft, { cc, sujet: allegeur });
    const declaree = difficulty ?? DIFFICULTE_PAR_DEFAUT;
    const dynamique = difficultyBy?.[0].cond === VRAI ? 'accessible' : declaree;
    const allege = !!easierIf && allegeur === artificier;
    expect(d.joue).toBe(gate !== FAUX);
    expect(d.declaree).toBe(declaree);
    expect(d.difficulty).toBe(allege ? easeDifficulty(dynamique, 1) : dynamique);
    expect(d.allegePar).toEqual(allege ? { skill: PROJECTILES.hasSkill } : undefined);
    expect(d.sujet).toEqual({ skill: PERCEPTION });
  });

  it('`difficultyBy` : la PREMIÈRE Condition vraie impose sa Difficulté (LDB 16 l.54)', () => {
    const ft: FlowTest = { skill: { id: 'calme' }, difficultyBy: [{ cond: FAUX, difficulty: 'facile' }, { cond: VRAI, difficulty: 'tresDifficile' }, { cond: VRAI, difficulty: 'accessible' }] };
    expect(resoudreFlowTest(ft, { cc }).difficulty).toBe('tresDifficile');
  });
});

describe('resoudreFlowTest — qui allège : le sujet d’un Test subi, le groupe d’un Test volontaire (LDB 12 l.197)', () => {
  const ft = (noSupport?: boolean): FlowTest => ({ skill: PERCEPTION, difficulty: 'complexe', easierIf: PROJECTILES, ...(noSupport !== undefined ? { noSupport } : {}) });
  const ctx = (groupe?: readonly Combatant[]): ContexteDuTest => ({ cc, sujet: profane, ...(groupe ? { groupe } : {}) });
  const voies: [string, FlowTest, ContexteDuTest, Difficulty][] = [
    ['subi, le groupe tient la Compétence', ft(true), ctx([profane, artificier]), 'complexe'],
    ['volontaire, le groupe la tient', ft(), ctx([profane, artificier]), 'intermediaire'],
    ['volontaire, son seul porteur est mort', ft(), ctx([profane, { ...artificier, dead: true }]), 'complexe'],
    ['sans groupe, le sujet seul', ft(), ctx(), 'complexe'],
  ];
  it.each(voies)('%s', (_cas, test, contexte, attendue) => {
    expect(resoudreFlowTest(test, contexte).difficulty).toBe(attendue);
  });

  it('un Talent allège et se nomme par son id', () => {
    const beni = combattantDeTest({ id: 'b', talents: [{ talentId: 'beni', times: 1 }] });
    const d = resoudreFlowTest({ skill: PERCEPTION, difficulty: 'difficile', easierIf: { hasTalent: 'beni', steps: 2 } }, { cc, sujet: beni });
    expect(d).toMatchObject({ difficulty: 'intermediaire', allegePar: { talent: 'beni' } });
  });
});

describe('resoudreFlowTest — joué ou non', () => {
  it('`onlyGroups` : le Test n’a lieu que pour un membre du Groupe (Épée de justice, « Criminel »)', () => {
    const ft: FlowTest = { skill: { id: 'resistance' }, difficulty: 'accessible', onlyGroups: ['Criminel'] };
    expect(resoudreFlowTest(ft, { cc, sujet: profane }).joue).toBe(false);
    expect(resoudreFlowTest(ft, { cc, sujet: combattantDeTest({ groups: ['Criminel'] }) }).joue).toBe(true);
    expect(resoudreFlowTest(ft, { cc }).joue, 'sans sujet imposé, rien à juger').toBe(true);
  });

  it('`gate` d’Immunité : une cible Immunisée au poison ne teste pas (LDB 85 l.174)', () => {
    const ft: FlowTest = { skill: { id: 'resistance' }, difficulty: 'complexe', gate: { kind: 'not', of: { kind: 'has', who: 'target', what: 'immunity', value: 'poison' } } };
    const immunise = combattantDeTest({ traits: [{ id: 'immunite', arg: 'poison' }] });
    expect(resoudreFlowTest(ft, { cc: { ...cc, target: buildActorView(profane) }, sujet: profane }).joue).toBe(true);
    expect(resoudreFlowTest(ft, { cc: { ...cc, target: buildActorView(immunise) }, sujet: immunise }).joue).toBe(false);
  });
});

describe('resoudreFlowTest — Test opposé (LDB 12 l.166)', () => {
  it('le défenseur jette la Difficulté résolue, l’attaquant figé la déclarée', () => {
    const ft: FlowTest = { skill: PERCEPTION, difficulty: 'difficile', easierIf: PROJECTILES, opposed: { attacker: 'agilite', attackerSkill: 'discretion' } };
    expect(resoudreFlowTest(ft, { cc, sujet: artificier })).toMatchObject({ difficulty: 'complexe', declaree: 'difficile' });
  });
});
