import { describe, it, expect } from 'vitest';
import { structures } from '../../../data';
import { structureAppearance } from './structures';
import { structureEdgeKind } from '../../../engine/structures';

/**
 * Garde #832 : toute structure POSABLE sur une arête (`structureEdgeKind` défini — mur/porte, jamais
 * un `vehicle`) doit avoir une apparence DÉDIÉE dans `structureAppearance.json`. Un id posable qui
 * n'a pas la sienne (`structureAppearance(id).id !== id`) est un manque invisible à l'auteur
 * de carte (24 % des murs de `la-diligence-projet.json` avant #832) — cette garde échoue tant que le
 * manque n'est pas comblé, plutôt que de ré-auditer la carte dans six mois.
 */
describe('couverture d\'apparence des structures posables (#832)', () => {
  const posable = structures.filter((s) => structureEdgeKind(s) !== undefined);

  it('la scène de test couvre bien des structures posables (garde non vide)', () => {
    expect(posable.length).toBeGreaterThan(0);
  });

  it.each(posable.map((s) => [s.id, s.label] as const))('%s (%s) a son apparence dédiée', (id) => {
    expect(structureAppearance(id).id, `${id} : apparence manquante dans structureAppearance.json`).toBe(id);
  });

  it('les véhicules ne sont PAS posables (repli undefined, hors garde)', () => {
    const vehicles = structures.filter((s) => s.vehicle);
    expect(vehicles.length).toBeGreaterThan(0);
    for (const v of vehicles) expect(structureEdgeKind(v)).toBeUndefined();
  });
});
