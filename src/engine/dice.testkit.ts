/**
 * LES DÉS DES TESTS (#2817, `.claude/rules/tests.md`) : le seul site où un test obtient un `RNG`
 * (`src/engine/dice.ts`), semé ou imposé. Aucun test ne forge le sien.
 */
import { makeRNG, type RNG } from './dice';

/** RNG semé des tests, pour un jet dont la valeur n'est pas l'objet de l'assertion. */
export const desDuTest: RNG = makeRNG(1);

/** Chaque tirage rend `face`, quelle que soit la plage demandée. */
export const deFixe = (face: number): RNG => ({ int: () => face });

/** Chaque tirage rend la borne basse de sa plage. */
export const deMin: RNG = { int: (min) => min };

/** Chaque tirage rend la borne haute de sa plage. */
export const deMax: RNG = { int: (_min, max) => max };

/** Le k-ième tirage rend `faces[k]`. `boucle` reprend la suite à son début, `borne` ramène chaque face
 *  dans la plage demandée, `ensuite` est la face de tout tirage au-delà de la suite ; sans `boucle` ni
 *  `ensuite`, un tirage au-delà de la suite lève : le test a consommé plus de dés qu'il n'en a posé. */
export function desEnSuite(faces: readonly number[], opts: { boucle?: boolean; borne?: boolean; ensuite?: number } = {}): RNG {
  let k = 0;
  return {
    int: (min, max) => {
      const i = k++;
      const face = opts.boucle ? faces[i % faces.length] : i < faces.length ? faces[i] : opts.ensuite;
      if (face === undefined) throw new Error(`[dés du test] tirage n°${i + 1} au-delà des ${faces.length} faces posées`);
      return opts.borne ? Math.min(max, Math.max(min, face)) : face;
    },
  };
}

/** Chaque tirage rend `face(min, max)` : un dé qui dépend de la plage demandée (d100 contre d10…). */
export const deSelonLaPlage = (face: (min: number, max: number) => number): RNG => ({ int: face });

/** Un RNG qu'aucun tirage ne doit atteindre : le chemin testé ne lance aucun dé. */
export const aucunDe: RNG = { int: () => { throw new Error('[dés du test] tirage sur un chemin sans dé'); } };
