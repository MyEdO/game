import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { FLOWS } from '../noyau/rollFlowSpecs';
import { applyOps } from '../engine/ops';
import { evaluateTest } from '../engine/tests';
import { reverseRoll } from '../engine/combat';
import type { Combatant } from '../engine/types';
import { desDuTest } from '../engine/dice.testkit';

/**
 * Inversion de Test (LDB 23 l.209 « Entraînement au Combat » / l.218 « Observer une cible » — « vous
 * POUVEZ inverser » ; LDB 10, Talents Sociable/Studieux/… — même formule) : un CHOIX du joueur, offert
 * par la rangée d'influence de la modale de jet — JAMAIS automatique (#558). Couvre les 3 flux
 * `test`/`attack`/`defense` (LDB 23 l.209 : Corps à corps OU Projectiles).
 */
beforeEach(() => {
  useGame.setState({ pendingTest: null, pendingAttack: null, pendingDefense: null, battle: null, party: [] });
});

describe('flux `test` (LDB 23 l.218 « Observer une cible » — jeton sans `skill` = tout Test)', () => {
  function setup(over: Partial<any> = {}, withToken = true) {
    const actor = { id: 'h1', name: 'Héros', activeEffects: [], fortune: 0, resilience: 0, skills: [], talents: [] } as unknown as Combatant;
    if (withToken) applyOps(actor, [{ op: 'grantReverseToken', skill: { id: 'ragot' }}], { rng: desDuTest, label: 'Observer une cible' });
    useGame.setState({
      party: [actor],
      pendingTest: {
        actorId: 'h1', label: 'Ragot', skillId: 'ragot', skillValue: 40, difficulty: 'intermediaire',
        requireSL: 0, target: 40, roll: 82, success: false, sl: -4,
        ...over,
      } as any,
    });
  }

  it('jet raté + jeton applicable : `reverseAvailable` OFFRE le verbe (aucune auto-application à la pose du pending)', () => {
    setup();
    expect(useGame.getState().pendingTest!.roll).toBe(82); // pas de flip silencieux
    expect(useGame.getState().pendingTest!.success).toBe(false);
    expect(FLOWS.test.reverseAvailable(useGame.getState, useGame.setState)).toBe(true);
  });

  it('accepter (`testReverse`) : permute le dé, consomme le jeton, transforme l’échec en réussite', () => {
    setup();
    useGame.getState().testReverse();
    const pt = useGame.getState().pendingTest!;
    const expected = evaluateTest(reverseRoll(82), 40);
    expect(pt.roll).toBe(reverseRoll(82));
    expect(pt.success).toBe(true);
    expect(pt.sl).toBe(expected.sl);
    expect(useGame.getState().party[0].activeEffects).toHaveLength(0); // jeton consommé
  });

  it('un d100 INVERSÉ qui RATE encore reste un échec (l’issue tient au dé, LDB 12 l.90-94)', () => {
    setup({ roll: 54, success: false, sl: -1 }); // cible 40
    expect(reverseRoll(54)).toBe(45); // 45 > 40 : le dé renversé rate aussi
    useGame.getState().testReverse();
    const pt = useGame.getState().pendingTest!;
    expect(pt.roll).toBe(45);
    expect(pt.sl).toBe(evaluateTest(45, 40).sl); // DR 0 — un DR nul n'est pas une réussite
    expect(pt.success).toBe(false);
  });

  it('refuser (ne pas appeler `testReverse`) : le jet raté ET le jeton restent intacts', () => {
    setup();
    expect(useGame.getState().pendingTest!.success).toBe(false);
    expect(useGame.getState().party[0].activeEffects).toHaveLength(1); // jeton non dépensé
  });

  it('sans jeton/Talent applicable pour cette Compétence : non disponible, `testReverse` no-op', () => {
    setup({ skillId: 'commerage' }, false); // pas de jeton du tout
    expect(FLOWS.test.reverseAvailable(useGame.getState, useGame.setState)).toBe(false);
    useGame.getState().testReverse();
    expect(useGame.getState().pendingTest!.roll).toBe(82); // inchangé
  });
});

const HERO = (over: Partial<Combatant>): Combatant =>
  ({
    id: 'X', name: 'X', kind: 'hero',
    characteristics: { 'capacite-de-combat': 45, 'capacite-de-tir': 45, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], traumas: [],
    weapons: [{ name: 'Épée', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] }],
    armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4, bodyShape: 'humanoide', pos: { x: 0, y: 0 },
    activeEffects: [],
    ...over,
  }) as unknown as Combatant;

describe('flux `attack` (LDB 23 l.209 — Corps à corps/Projectiles, jusqu’ici NON couvert #558)', () => {
  function setup() {
    const attacker = HERO({ id: 'A', label: 'Att' });
    applyOps(attacker, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' }}], { rng: desDuTest, label: 'Entraînement au Combat' });
    const target = HERO({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 }, activeEffects: [] });
    useGame.setState({
      battle: { combatants: [attacker, target], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: {
          hit: false, attackerRoll: 82, netSL: -4, critical: false, advantageTo: 'defender',
          defenderDefeated: false, log: 'raté',
          attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 82, success: false, sl: -4 },
        } as never,
      },
    });
  }

  it('jet raté + jeton `corps-a-corps` applicable : `reverseAvailable` OFFRE le verbe', () => {
    setup();
    expect(FLOWS.attack.reverseAvailable(useGame.getState, useGame.setState)).toBe(true);
  });

  it('PREUVE échoue sans la couture — sans appeler `attackReverse`, l’attaque reste ratée et le jeton intact (aucun automatisme)', () => {
    setup();
    expect(useGame.getState().pendingAttack!.result!.hit).toBe(false);
    expect(useGame.getState().pendingAttack!.result!.attackerDetail!.success).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'A')!.activeEffects).toHaveLength(1);
  });

  it('accepter (`attackReverse`) : permute le dé attaquant, consomme le jeton, transforme le raté en touche', () => {
    setup();
    useGame.getState().attackReverse();
    const res = useGame.getState().pendingAttack!.result!;
    expect(res.attackerDetail!.roll).toBe(reverseRoll(82));
    expect(res.attackerDetail!.success).toBe(true);
    expect(res.hit).toBe(true);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'A')!.activeEffects).toHaveLength(0);
  });

  it('sans jeton (compétence non couverte) : non disponible, `attackReverse` no-op', () => {
    const attacker = HERO({ id: 'A', label: 'Att' }); // aucun jeton
    const target = HERO({ id: 'B', label: 'Cible', kind: 'enemy', pos: { x: 1, y: 0 }, activeEffects: [] });
    useGame.setState({
      battle: { combatants: [attacker, target], log: [] } as never,
      pendingAttack: {
        attackerId: 'A', targetId: 'B', location: null,
        result: {
          hit: false, attackerRoll: 82, netSL: -4, critical: false, advantageTo: 'defender',
          defenderDefeated: false, log: 'raté',
          attackerDetail: { label: 'Corps à corps', base: 45, modifier: 0, target: 45, roll: 82, success: false, sl: -4 },
        } as never,
      },
    });
    expect(FLOWS.attack.reverseAvailable(useGame.getState, useGame.setState)).toBe(false);
    useGame.getState().attackReverse();
    expect(useGame.getState().pendingAttack!.result!.attackerDetail!.roll).toBe(82);
  });
});

describe('flux `defense` (LDB 23 l.209 — Parade = Corps à corps)', () => {
  function setup() {
    const attacker = HERO({ id: 'E', label: 'Orque', kind: 'enemy' });
    const defender = HERO({ id: 'H', label: 'Héros', pos: { x: 1, y: 0 } });
    applyOps(defender, [{ op: 'grantReverseToken', skill: { id: 'corps-a-corps' }}], { rng: desDuTest, label: 'Entraînement au Combat' });
    const atk = { roll: 30, target: 40, success: true, sl: 1, isDouble: false };
    const def = { roll: 82, target: 45, success: false, sl: -4, isDouble: false };
    useGame.setState({
      battle: { combatants: [attacker, defender], log: [] } as never,
      pendingDefense: {
        attackerId: 'E', defenderId: 'H', weapon: { name: 'Gourdin', type: 'melee', damage: { plusBF: false, flat: 4 }, qualities: [] },
        location: null, atk, mode: 'parade', def,
        result: {
          hit: true, attackerRoll: 30, netSL: 5, critical: false, advantageTo: 'attacker', defenderDefeated: false, log: '',
          attackerDetail: { label: 'Corps à corps', base: 40, modifier: 0, target: 40, roll: 30, success: true, sl: 1 },
          defenderDetail: { label: 'Parade', base: 45, modifier: 0, target: 45, roll: 82, success: false, sl: -4 },
        },
        suite: { mode: 'machine', coup: {} },
      } as never,
    });
  }

  it('jet raté + jeton `corps-a-corps` applicable : `reverseAvailable` OFFRE le verbe', () => {
    setup();
    expect(FLOWS.defense.reverseAvailable(useGame.getState, useGame.setState)).toBe(true);
  });

  it('accepter (`defenseReverse`) : permute le dé du défenseur, consomme le jeton, pare le coup', () => {
    setup();
    useGame.getState().defenseReverse();
    const pd = useGame.getState().pendingDefense!;
    expect(pd.def!.roll).toBe(reverseRoll(82));
    expect(pd.def!.success).toBe(true);
    expect(pd.result!.hit).toBe(false); // la Parade a réussi → pas de touche
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'H')!.activeEffects).toHaveLength(0);
  });

  it('refuser (ne pas appeler `defenseReverse`) : le jet raté ET le jeton restent intacts', () => {
    setup();
    expect(useGame.getState().pendingDefense!.def!.success).toBe(false);
    expect(useGame.getState().battle!.combatants.find((c) => c.id === 'H')!.activeEffects).toHaveLength(1);
  });
});

/**
 * Talent ET jeton simultanément applicables sur la MÊME Compétence (#508 réfutation, point 4) :
 * `applyReverse` (engine/reverseToken.ts) tente le Talent EN PREMIER — gratuit, illimité — le jeton
 * n'est consommé QUE si le Talent ne s'applique pas. Sociable (LDB 11 l.25 → Ragot) + jeton
 * « Observer une cible » (LDB 23 l.218, sans `skill` — couvre tout Test) sur le MÊME jet raté.
 */
describe('Talent + jeton simultanément applicables (LDB 10 Sociable + LDB 23 l.218) : le Talent gratuit prime, le jeton reste intact', () => {
  it('`testReverse` consomme le Talent (illimité), préserve le jeton', () => {
    const actor = {
      id: 'h1', name: 'Héros', activeEffects: [], fortune: 0, resilience: 0, skills: [],
      talents: [{ talentId: 'sociable', times: 1 }],
    } as unknown as Combatant;
    applyOps(actor, [{ op: 'grantReverseToken' }], { rng: desDuTest, label: 'Observer une cible' }); // sans `skill` = tout Test
    useGame.setState({
      party: [actor],
      pendingTest: {
        actorId: 'h1', label: 'Ragot', skillId: 'ragot', skillValue: 40, difficulty: 'intermediaire',
        requireSL: 0, target: 40, roll: 82, success: false, sl: -4,
      } as any,
    });
    expect(FLOWS.test.reverseAvailable(useGame.getState, useGame.setState)).toBe(true);
    useGame.getState().testReverse();
    const pt = useGame.getState().pendingTest!;
    const expected = evaluateTest(reverseRoll(82), 40);
    expect(pt.roll).toBe(reverseRoll(82));
    expect(pt.success).toBe(true);
    expect(pt.sl).toBe(expected.sl);
    // Le Talent est GRATUIT et ILLIMITÉ : le jeton — consommable — reste intact, non dépensé.
    expect(useGame.getState().party[0].activeEffects).toHaveLength(1);
  });
});

/**
 * Jeton sur un Test DÉJÀ RÉUSSI (LDB 23 l.209/218 « vous pouvez inverser un Test », sans restriction
 * d'échec ni de conversion — #508 réfutation, point 1) : la permutation reste au choix du joueur et
 * PEUT améliorer le DR sans faire perdre la réussite. Contraste avec le Talent (`talentReverseAvailable`),
 * qui n'est JAMAIS offert sur un Test déjà réussi.
 */
describe('Jeton sur un Test DÉJÀ réussi (LDB 23 l.209/218 — libre) : améliore le DR, reste réussi', () => {
  it('`reverseAvailable` OFFRE le verbe sur un succès (jeton seul, aucun Talent)', () => {
    const actor = { id: 'h1', name: 'Héros', activeEffects: [], fortune: 0, resilience: 0, skills: [], talents: [] } as unknown as Combatant;
    applyOps(actor, [{ op: 'grantReverseToken', skill: { id: 'ragot' }}], { rng: desDuTest, label: 'Observer une cible' });
    const roll = 32; const target = 40;
    const before = evaluateTest(roll, target);
    expect(before.success).toBe(true); // jet DÉJÀ réussi — le Talent ne l'offrirait JAMAIS
    useGame.setState({
      party: [actor],
      pendingTest: {
        actorId: 'h1', label: 'Ragot', skillId: 'ragot', skillValue: 40, difficulty: 'intermediaire',
        requireSL: 0, target, roll, success: true, sl: before.sl,
      } as any,
    });
    expect(FLOWS.test.reverseAvailable(useGame.getState, useGame.setState)).toBe(true);
  });

  it('accepter (`testReverse`) : permute le dé, améliore le DR, le Test reste réussi', () => {
    const actor = { id: 'h1', name: 'Héros', activeEffects: [], fortune: 0, resilience: 0, skills: [], talents: [] } as unknown as Combatant;
    applyOps(actor, [{ op: 'grantReverseToken', skill: { id: 'ragot' }}], { rng: desDuTest, label: 'Observer une cible' });
    const roll = 32; const target = 40;
    const before = evaluateTest(roll, target);
    const expected = evaluateTest(reverseRoll(roll), target);
    expect(expected.sl).toBeGreaterThan(before.sl); // 23 → DR meilleur que 32 (dizaines plus basses)
    useGame.setState({
      party: [actor],
      pendingTest: {
        actorId: 'h1', label: 'Ragot', skillId: 'ragot', skillValue: 40, difficulty: 'intermediaire',
        requireSL: 0, target, roll, success: true, sl: before.sl,
      } as any,
    });
    useGame.getState().testReverse();
    const pt = useGame.getState().pendingTest!;
    expect(pt.roll).toBe(reverseRoll(roll));
    expect(pt.success).toBe(true); // reste réussi
    expect(pt.sl).toBe(expected.sl);
    expect(useGame.getState().party[0].activeEffects).toHaveLength(0); // jeton consommé
  });
});
