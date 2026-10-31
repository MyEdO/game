/**
 * #3116 — les pièces de l'ensemble qui habille une chose se résolvent par égalité de `habille` (`{ id, type }`), quel
 * que soit l'id de l'ensemble ; une chose qu'aucun ensemble n'habille n'en porte aucune. Les attendus se lisent au
 * catalogue (`gardeRobe`), jamais recopiés.
 */
import { describe, expect, it } from 'vitest';
import { piecesDEnsemble } from './gardeRobe';
import { gardeRobe } from '../../data';
import type { EnsembleDef } from '../../data/schemas/defs/garde-robe';

const ensembles = gardeRobe.filter((e): e is EnsembleDef => e.kind === 'ensemble');

describe('piecesDEnsemble (#3116)', () => {
  it('chaque ensemble de la garde-robe rend ses pièces par son `habille`', () => {
    expect(ensembles.length).toBeGreaterThan(0);
    for (const e of ensembles) expect(piecesDEnsemble(e.habille), e.id).toEqual(e.pieces);
  });

  it('la tenue habillée par un ensemble rend les pièces de cet ensemble', () => {
    const tenue = ensembles.find((e) => e.habille.type === 'tenue');
    expect(tenue, 'fixture : aucun ensemble de garde-robe.json n’habille une tenue').toBeDefined();
    expect(piecesDEnsemble(tenue!.habille)).toEqual(tenue!.pieces);
  });

  it('une chose qu’aucun ensemble n’habille ne porte aucune pièce', () => {
    expect(piecesDEnsemble({ id: 'dague', type: 'trapping' })).toEqual([]);
  });
});
