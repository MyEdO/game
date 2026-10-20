import { describe, expectTypeOf, it } from 'vitest';
import type { EtatDeJeu } from '../noyau/etat';
import type { ActionsDuNoyau } from '../noyau/actionsDuNoyau';
import type { ActionsDeLAdaptateur, EtatDeLAdaptateur, GameState } from './store';

/** Les clés que deux moitiés de l'état ont en commun : vide quand elles sont disjointes. */
type Communes<A, B> = Extract<keyof A, keyof B>;

describe('l’état du store est la partition du jeu et de l’adaptateur (#2817 D5)', () => {
  it('les champs de jeu et d’interface, les actions du noyau et d’adaptateur sont disjoints', () => {
    expectTypeOf<Communes<EtatDeJeu, EtatDeLAdaptateur>>().toEqualTypeOf<never>();
    expectTypeOf<Communes<ActionsDuNoyau, ActionsDeLAdaptateur>>().toEqualTypeOf<never>();
  });

  it('le store porte EXACTEMENT les quatre moitiés', () => {
    expectTypeOf<keyof GameState>().toEqualTypeOf<keyof EtatDeJeu | keyof EtatDeLAdaptateur | keyof ActionsDuNoyau | keyof ActionsDeLAdaptateur>();
  });
});
