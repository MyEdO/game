/**
 * GARDE — la forme d'un nœud zod se lit par `defDe`, ses enfants par `enfantsDe` (#1463 R2, D10b) :
 * hors de `grammaire/descente.ts`, aucun `_zod.def` (`_def`, `_zod['def']`) écrit à la main ni champ de
 * `CHAMPS_D_ENFANTS` lu sur un `def`, un `defDe(…)` ou un alias de `defDe(…)`, dans `src` et `scripts`,
 * tests compris (`scripts/guards/lib/lectureDefZod.mjs`).
 */
import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../../../scripts/guards/lib/sourceCorpus.mjs';
import { lecturesDefZod } from '../../../../scripts/guards/lib/lectureDefZod.mjs';
import { CHAMPS_D_ENFANTS } from './descente';

/** Le module qui EST la lecture. */
const DESCENTE = 'src/data/schemas/grammaire/descente.ts';

const CORPUS = readCorpus(['src', 'scripts'], { exts: ['.ts', '.tsx', '.mts', '.mjs'], tests: true });

describe('GARDE — `_zod.def` et les champs d’enfants ne se lisent que dans `descente.ts`', () => {
  it('aucune lecture hors de `descente.ts`', () => {
    const fautives = CORPUS.filter((f) => f.rel !== DESCENTE).flatMap((f) => lecturesDefZod(f.text, CHAMPS_D_ENFANTS).map((t) => `${f.rel}:${t.ligne} ${t.extrait}`));
    expect(fautives, 'lire la forme par `defDe`, les enfants par `enfantsDe` (`grammaire/descente.ts`)').toEqual([]);
  });

  it('la garde voit `descente.ts` lui-même : le motif mord sur le corpus réel', () => {
    const descente = CORPUS.find((f) => f.rel === DESCENTE);
    expect(descente && lecturesDefZod(descente.text, CHAMPS_D_ENFANTS).length).toBeGreaterThan(0);
  });
});
