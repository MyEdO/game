import { describe, it, expect } from 'vitest';
import { fireConditionEffects } from '../noyau/triggeredEffects';
import { seedBattleRng, battleRng } from '../noyau/battleRng';
import { stacks } from '../engine/conditions';
import type { Combatant } from '../engine/types';
import { blessuresSurLeProfil, blessuresDeBase, profilDeTest } from '../engine/combattantDeTest.testkit';

/**
 * Récupération du Brisé (LDB 16 l.54-58) — désormais 100 % DATA-DRIVEN (etats.json `brise.effects`,
 * 2 effets `onRoundEnd`). On dirige la voie INLINE (ennemi/auto) via le DISPATCHER UNIQUE
 * `fireConditionEffects(onRoundEnd)` (sans `set` → résolution inline) et on vérifie les invariants RAW :
 *  - non Engagé + ennemi loin + Calme réussi → retire ≥ 1 État Brisé (le Test subit la pénalité de l'État
 *    Brisé lui-même, −10 PAR PION — LDB 16 l.11 et l.52 ; Calme n'est ni course ni dissimulation) ;
 *  - Engagé avec un ennemi → AUCUN Test (gate fermée, l.54) → inchangé ;
 *  - aucun Brisé → no-op.
 */
const scene = () =>
  ({ id: 's', label: '', dimensions: { w: 12, h: 12 }, layers: [{ z: 0, tiles: Array(144).fill('herbe') }], entities: [], dialogues: [], triggers: [], encounters: [], flags: {} } as never);

const getFn = (battle: unknown, scn: unknown) => () => ({ battle, scene: scn } as never);

function broken(_over: Partial<Combatant>): Combatant {
  return blessuresSurLeProfil({ id: 'h', kind: 'hero', name: 'H', pos: { x: 1, y: 1 }, conditions: [{ id: 'brise', value: 2 }], characteristics: profilDeTest({ 'force-mentale': 90 }), skills: [], engagedWith: [], wounds: blessuresDeBase(10) }) as unknown as Combatant;
}
const foe = (over: Partial<Combatant>): Combatant => (blessuresSurLeProfil({ id: 'e', kind: 'enemy', name: 'E', pos: { x: 9, y: 9 }, conditions: [], wounds: blessuresDeBase(10), ...over }) as unknown as Combatant);

describe('Récupération du Brisé en fin de Round (LDB 16 l.54-58) — data-driven', () => {
  it('non Engagé, ennemi loin, Calme réussi → retire ≥ 1 État Brisé', () => {
    seedBattleRng(1);
    const h = { ...broken({}) };
    const battle = { combatants: [h, foe({})] };
    const lines = fireConditionEffects(getFn(battle, scene()), h, 'onRoundEnd', { rng: battleRng() });
    expect(stacks(h, 'brise')).toBeLessThan(2); // FM 90 (2 pions de Brisé : −20 → 70) → Test de Calme réussi au seed 1
    expect(lines.join(' ')).toMatch(/Brisé/);
  });

  it('Engagé avec un ennemi → AUCUN Test de récupération (gate fermée, LDB 16 l.54)', () => {
    seedBattleRng(1);
    const h = { ...broken({}), pos: { x: 5, y: 5 }, engagedWith: ['e'] } as unknown as Combatant;
    const battle = { combatants: [h, foe({ pos: { x: 5, y: 6 } })] }; // adjacent, en vue (donc pas caché)
    fireConditionEffects(getFn(battle, scene()), h, 'onRoundEnd', { rng: battleRng() });
    expect(stacks(h, 'brise')).toBe(2); // inchangé (Engagé + visible → ni Test ni retrait caché)
  });

  it('aucun Brisé → no-op', () => {
    const h = { ...broken({}), conditions: [] } as unknown as Combatant;
    fireConditionEffects(getFn({ combatants: [h, foe({})] }, scene()), h, 'onRoundEnd', { rng: battleRng() });
    expect(stacks(h, 'brise')).toBe(0);
  });
});
