import { describe, it, expect } from 'vitest';
import { fileURLToPath } from 'node:url';
import { auditObjetsPorteur } from '../../scripts/guards/lib/objetsPorteur.mjs';

/**
 * GARDE #1473/#1985 — le placement d'un objet (`inside`, `equipped`) ne s'écrit que dans `stowIn`,
 * `unstow` et `toggleWorn`, et un objet n'entre chez un porteur que par `receiveItems`
 * (`src/engine/items.ts`). Mécanique et angles morts : `scripts/guards/lib/objetsPorteur.mjs` ;
 * morsures : `scripts/guards/lib/objetsPorteur.test.mjs`.
 */
const ROOT = fileURLToPath(new URL('../../', import.meta.url));

describe('#1473/#1985 — placement et entrée d’un objet chez un porteur', () => {
  it('aucune écriture de placement ni entrée hors de la couture, dans `src/` hors tests', () => {
    const ecarts = auditObjetsPorteur(ROOT);
    expect(ecarts.map((e) => `${e.angle} ${e.forme} ${e.at}`).join('\n')).toBe('');
  }, 120_000);
});
