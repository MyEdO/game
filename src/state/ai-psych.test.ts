import { describe, it, expect } from 'vitest';
import { chooseEnemyAction, EnemyTurnInput } from '../noyau/monde/ai';
import { emptyScene } from '../noyau/monde/scene';
import type { Combatant, Weapon } from '../engine/types';
import type { PsychType } from '../engine/psychology';
import { psychologies, traits } from '../data';
import { ciblePsy } from '../engine/psych/ciblage';

const MELEE: Weapon = { label: 'Épée', type: 'melee', damage: { plusBF: true, flat: 4 }, qualities: [] };

function mk(id: string, kind: 'hero' | 'enemy', pos: { x: number; y: number }, opts: Partial<Combatant> = {}): Combatant {
  return {
    id, label: id, kind, pos,
    wounds: { current: 10, max: 10 }, weapons: [MELEE], characteristics: {} as never,
    advantage: 0, conditions: [], armour: {} as never, skills: [], talents: [], movement: 4,
    ...opts,
  } as Combatant;
}
const scene = emptyScene('scene-test', 12, 12);
function input(enemy: Combatant, heroes: Combatant[], extra: Partial<EnemyTurnInput> = {}): EnemyTurnInput {
  return { enemy, heroes, scene, blocked: new Set(heroes.map((h) => `${h.pos!.x},${h.pos!.y}`)), movement: enemy.movement, spells: [], ...extra };
}

describe('Frénésie/Haine IA — contrainte de cible (LDB 21, P3)', () => {
  it('Haine active : vise un membre du groupe haï (pas le plus faible hors groupe)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'haine', cible: ciblePsy.groupe('elfe'), active: true }] });
    const hated = mk('hated', 'hero', { x: 5, y: 6 }, { wounds: { current: 10, max: 10 }, groups: ['elfe'] }); // costaud mais haï
    const weak = mk('weak', 'hero', { x: 5, y: 4 }, { wounds: { current: 1, max: 10 }, groups: ['humain'] }); // faible mais non haï
    const action = chooseEnemyAction(input(e, [hated, weak]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('hated');
  });

  it('Animosité active mais aucun membre du groupe visible → ciblage normal (le plus faible)', () => {
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: 'animosite', cible: ciblePsy.groupe('elfe'), active: true }] });
    const weak = mk('weak', 'hero', { x: 5, y: 6 }, { wounds: { current: 1, max: 10 }, groups: ['humain'] });
    const tough = mk('tough', 'hero', { x: 5, y: 4 }, { wounds: { current: 10, max: 10 }, groups: ['humain'] });
    const action = chooseEnemyAction(input(e, [weak, tough]));
    const tid = (action as { targetId?: string; thenTargetId?: string }).targetId ?? (action as { thenTargetId?: string }).thenTargetId;
    expect(tid).toBe('weak'); // pas de groupe haï présent → comportement habituel
  });

  /** Q10 A, #3045 : « la pulsion vise les membres » — le vivier lit l'APPARTENANCE, pas la vue perçue. */
  const traitAGroupe = traits.find((t) => t.capabilities?.grantGroups?.length);
  const groupe = traitAGroupe?.capabilities?.grantGroups?.[0] ?? '';
  const cible = (tid: ReturnType<typeof chooseEnemyAction>) =>
    (tid as { targetId?: string; thenTargetId?: string }).targetId ?? (tid as { thenTargetId?: string }).thenTargetId;

  it('vivier par appartenance : un membre dont le Groupe est DISSIMULÉ reste visé (#3045)', () => {
    expect(traitAGroupe).toBeDefined();
    const pulsion = psychologies.find((p) => p.attackDR?.vs === 'group');
    expect(pulsion).toBeDefined();
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: pulsion!.id as PsychType, cible: ciblePsy.groupe(groupe), active: true }] });
    const membre = mk('membre', 'hero', { x: 5, y: 6 }, { traits: [{ id: traitAGroupe!.id, hidden: true }] });
    const faible = mk('faible', 'hero', { x: 5, y: 4 }, { wounds: { current: 1, max: 10 } });
    expect(cible(chooseEnemyAction(input(e, [membre, faible])))).toBe('membre');
  });

  it('le vivier ne se restreint que pour une affliction dont la donnée vise le groupe (`attackDR.vs`)', () => {
    const autre = psychologies.find((p) => p.targeted && p.attackDR?.vs !== 'group');
    expect(autre).toBeDefined();
    const e = mk('e', 'enemy', { x: 5, y: 5 }, { psychState: [{ type: autre!.id as PsychType, cible: ciblePsy.groupe(groupe), active: true }] });
    const membre = mk('membre', 'hero', { x: 5, y: 6 }, { traits: [{ id: traitAGroupe!.id }] });
    const faible = mk('faible', 'hero', { x: 5, y: 4 }, { wounds: { current: 1, max: 10 } });
    expect(cible(chooseEnemyAction(input(e, [membre, faible])))).toBe('faible');
  });
});
