import { describe, it, expect } from 'vitest';
import { applyExposureFailure, expireOnRespite } from './exposure';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

function hero(): Combatant {
  return blessuresSurLeProfil({
    id: 'h1', label: 'Transi', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 30, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 30 },
    wounds: blessuresDeBase(12),
    advantage: 0, conditions: [], weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    skills: [], talents: [], movement: 4,
  }) as Combatant;
}

describe('dissipation au répit — politique de durée DÉCLARÉE sur l’effet (LDB 18 l.330/334)', () => {
  it('PARITÉ : les pénalités d’Exposition (froid ET chaleur) sont les SEULES à déclarer `expiresOnRespite`', () => {
    for (const kind of ['froid', 'chaleur'] as const) {
      const c = hero();
      applyExposureFailure(c, 1, makeRNG(1), kind);
      applyExposureFailure(c, 2, makeRNG(1), kind);
      const posed = c.activeEffects ?? [];
      expect(posed.length, kind).toBeGreaterThan(0);
      expect(posed.every((e) => e.expiresOnRespite === true), kind).toBe(true);
    }
  });

  it('un répit pose l’échéance d’horloge sur les effets qui la DÉCLARENT', () => {
    const c = hero();
    applyExposureFailure(c, 1, makeRNG(1), 'froid');
    expect(c.activeEffects!.every((e) => e.duration.scale === 'permanent')).toBe(true);
    expireOnRespite(c, 5000);
    expect(c.activeEffects!.map((e) => e.duration)).toEqual(c.activeEffects!.map(() => ({ scale: 'clock', until: 5000 })));
  });

  it('un effet permanent qui ne la déclare PAS reste permanent', () => {
    const c = hero();
    c.activeEffects = [{ label: 'Bénédiction', bonus: 10, char: 'force', duration: { scale: 'permanent' } }];
    expireOnRespite(c, 5000);
    expect(c.activeEffects[0].duration).toEqual({ scale: 'permanent' });
  });
});
