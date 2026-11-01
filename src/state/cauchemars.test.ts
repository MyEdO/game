import { describe, it, expect, beforeEach } from 'vitest';
import { useGame } from './store';
import { applyEffects } from '../noyau/combatEffects';
import { nightmareCheck, hasCondition } from '../engine/conditions';
import { testValue } from '../engine/skills';
import type { RNG } from '../engine/dice';
import type { Combatant } from '../engine/types';
import { deFixe } from '../engine/dice.testkit';
import { blessuresSurLeProfil, blessuresDeBase } from '../engine/combattantDeTest.testkit';

const hero = (p: Partial<Combatant>): Combatant =>
  (blessuresSurLeProfil({
    id: 'h', label: 'H', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 35, sociabilite: 30 },
    wounds: blessuresDeBase(10), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  }) as Combatant);

describe('nightmareCheck (LDB 21 l.95)', () => {
  it('Calme Facile +40 raté → Exténué', () => {
    const c = hero({ characteristics: { 'force-mentale': 35 } as never });
    const fail: RNG = deFixe(90); // 90 > (35+40=75) → échec
    nightmareCheck(c, testValue(c, 'calme'), fail); // LDB 21 l.95 — Test de Calme, valeur de la porte
    expect(hasCondition(c, 'extenue')).toBe(true);
  });
  it('Calme réussi → pas d’Exténué', () => {
    const c = hero({ characteristics: { 'force-mentale': 35 } as never });
    const ok: RNG = deFixe(20); // 20 ≤ 75 → réussite
    nightmareCheck(c, testValue(c, 'calme'), ok);
    expect(hasCondition(c, 'extenue')).toBe(false);
  });
});

describe('Effet inflictNightmares (éditeur)', () => {
  beforeEach(() => { useGame.setState({ battle: null, mode: 'exploration', journal: [] }); });

  it('pose le trauma « Cauchemars » sur le héros visé (défaut : le premier)', () => {
    const a = hero({ id: 'a' });
    const b = hero({ id: 'b' });
    useGame.setState({ party: [a, b] });
    applyEffects(useGame.getState, useGame.setState, [{ type: 'inflictNightmares', heroId: 'b' }]);
    expect(useGame.getState().party.find((h) => h.id === 'b')!.nightmares).toBe(true);
    expect(useGame.getState().party.find((h) => h.id === 'a')!.nightmares).toBeUndefined();
  });
});
