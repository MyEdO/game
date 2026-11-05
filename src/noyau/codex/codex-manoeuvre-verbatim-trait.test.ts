import { describe, it, expect } from 'vitest';
import { maneuvers, traits } from '../../data/index';
import { codexLookupById } from './registry';

/**
 * Une manœuvre est la PROJECTION mécanique d'un Trait de créature (#1226) : sa fiche Codex affiche
 * la prose VERBATIM du trait projetant. Le lien trait → manœuvre et l'unicité de la prose :
 * `src/data/maneuver-trait-projection.test.ts`.
 */

/** Chemin RÉEL d'affichage : la fiche Codex d'une manœuvre (`codexLookupById`, le registre vivant). */
describe('Codex — la fiche d’une manœuvre affiche le VERBATIM de son trait (#1226)', () => {
  it('« Souffle » rend le verbatim du trait Souffle, jamais un résumé', () => {
    const item = codexLookupById('maneuvers', 'souffle');
    expect(item).toBeDefined();
    expect(item!.desc).toBe(traits.find((t) => t.id === 'souffle')!.desc);
    expect(item!.desc).toContain('Le souffle de la créature est une arme puissante.');
  });

  it('« Morsure » rend le verbatim du trait Morsure', () => {
    const item = codexLookupById('maneuvers', 'morsure');
    expect(item!.desc).toBe(traits.find((t) => t.id === 'morsure')!.desc);
  });

  it('toutes les fiches de manœuvre portent une prose (aucune fiche muette après la suppression des descs)', () => {
    const muettes = maneuvers.filter((m) => !codexLookupById('maneuvers', m.id)?.desc).map((m) => m.id);
    expect(muettes, `Fiche Codex sans prose :\n${muettes.join('\n')}`).toEqual([]);
  });
});
