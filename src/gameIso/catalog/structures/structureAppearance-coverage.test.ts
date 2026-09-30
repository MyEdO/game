import { describe, it, expect } from 'vitest';
import { structures } from '../../../data';
import { structureAppearance } from './index';

/**
 * Garde #832 : toute structure — chacune se pose sur une arête (`structureEdgeKind`) — doit avoir une
 * apparence DÉDIÉE dans `structureAppearance.json`. Un id posable qui
 * n'a pas la sienne (`structureAppearance(id).id !== id`) est un manque invisible à l'auteur
 * de carte (24 % des murs de `la-diligence-projet.json` avant #832) — cette garde échoue tant que le
 * manque n'est pas comblé, plutôt que de ré-auditer la carte dans six mois.
 */
describe('couverture d\'apparence des structures posables (#832)', () => {
  it('le catalogue porte des structures (garde non vide)', () => {
    expect(structures.length).toBeGreaterThan(0);
  });

  it.each(structures.map((s) => [s.id, s.label] as const))('%s (%s) a son apparence dédiée', (id) => {
    expect(structureAppearance(id).id, `${id} : apparence manquante dans structureAppearance.json`).toBe(id);
  });
});
