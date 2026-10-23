import { describe, it, expect } from 'vitest';
import { applyOps } from './ops';
import { exposureNight } from './exposure';
import { makeRNG } from './dice';
import type { Combatant } from './types';
import { desDuTest } from './dice.testkit';
import { idNeufDeBanc } from '../lib/entityId.testkit';

/**
 * Op `weatherWard` (Peau de loup d'hiver d'Ulric, Protection contre la pluie) : immunité à
 * l'EXPOSITION météo — `exposureNight` est sauté (aucun Test de froid) tant que l'effet dure.
 */
const dummy = (p: Partial<Combatant> = {}): Combatant =>
  ({
    id: 'x', label: 'Cobaye', kind: 'hero',
    characteristics: { 'capacite-de-combat': 30, 'capacite-de-tir': 30, force: 30, endurance: 25, initiative: 30, agilite: 30, dexterite: 30, intelligence: 30, 'force-mentale': 30, sociabilite: 45 },
    wounds: { current: 12, max: 12 }, advantage: 0, conditions: [], skills: [], talents: [],
    weapons: [], armour: { tete: 0, brasG: 0, brasD: 0, corps: 0, jambeG: 0, jambeD: 0 },
    ...p,
  } as Combatant);

describe('weatherWard — immunité à l’Exposition météo', () => {
  it('sans protection : une nuit en tempête (4 Tests) effectue bien les jets', () => {
    const r = exposureNight(dummy({}), 4, 15, makeRNG(3)); // Résistance basse → des Tests sont lancés
    expect(r.rolls).toHaveLength(4);
  });

  it('avec weatherWard : aucun Test, aucun échec, aucune Blessure', () => {
    const c = dummy({});
    applyOps(c, [{ op: 'weatherWard' }], { idNeuf: idNeufDeBanc, rng: desDuTest, label: 'Peau de loup d’hiver', defaultDurationRounds: 9999 });
    const r = exposureNight(c, 4, 15, makeRNG(3));
    expect(r.rolls).toHaveLength(0);
    expect(r.failures).toBe(0);
    expect(r.wounds).toBe(0);
    expect(r.log.join(' ')).toMatch(/intempéries|protection magique/);
  });
});
