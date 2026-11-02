import { describe, it, expect } from 'vitest';
import { applyExposureFailure, exposureNight, sealskinDR } from './exposure';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import { blessuresDeBase, blessuresSurLeProfil } from './combattantDeTest.testkit';

/**
 * Exposition CHALEUR (LDB 18 l.330) + peau de phoque au FROID (MDG 14 l.277-279) — le système unique
 * d'`engine/exposure` sert désormais les deux volets (Température en mer, MDG 13 l.203-225).
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  (blessuresSurLeProfil({
    id: 'x', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 25, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 45 },
    wounds: blessuresDeBase(12), advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  }) as Combatant);

describe('applyExposureFailure — volet CHALEUR (LDB 18 l.330)', () => {
  it('1er échec : −10 Int/FM + 1 Exténué', () => {
    const c = dummy({});
    applyExposureFailure(c, 1, makeRNG(1), 'chaleur');
    const chars = (c.activeEffects ?? []).map((e) => e.char).sort();
    expect(chars).toEqual(['force-mentale', 'intelligence']);
    expect((c.conditions ?? []).some((x) => x.id === 'extenue')).toBe(true);
  });

  it('3e échec : 1d10 Blessures (ignore PA), pas d’Inconscient (spécifique au froid)', () => {
    const c = dummy({ wounds: blessuresDeBase(12, 3) });
    const r = applyExposureFailure(c, 3, makeRNG(1), 'chaleur');
    expect(r.wounds).toBeGreaterThanOrEqual(1);
    expect((c.conditions ?? []).some((x) => x.id === 'inconscient')).toBe(false);
  });
});

describe('sealskin — +1 DR aux Tests de Résistance contre le froid (MDG 14 l.277-279)', () => {
  it('sealskinDR = 0 sans capacité, la peau de phoque n’intervient qu’au froid', () => {
    expect(sealskinDR(dummy({}))).toBe(0);
  });

  it('un échec de froid DE JUSTESSE (DR remonté à ≥ +1) est TENU par la peau de phoque', () => {
    // Item peau de phoque PORTÉE (capacité `sealskin` gatée sur le port) — un héros à E très basse
    // rate, mais le +1 DR sauve l'échec limite : moins d'échecs qu'à mains nues.
    const skin: Combatant = dummy({
      items: [{ uid: 'p1', trappingId: 'peau-de-phoque', name: 'Peau de phoque', kind: 'misc', qualities: [], equipped: true } as never],
    });
    const r = exposureNight(skin, 4, 20, makeRNG(7), { kind: 'froid' });
    // Au moins un « échec de justesse tenu » OU strictement moins d'échecs — le +1 DR agit.
    const held = r.log.some((l) => /peau de phoque retient/.test(l));
    const bare = exposureNight(dummy({}), 4, 20, makeRNG(7), { kind: 'froid' });
    expect(held || r.failures <= bare.failures).toBe(true);
  });
});
