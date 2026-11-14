import { describe, it, expect } from 'vitest';
import { readCorpus } from '../../scripts/guards/lib/sourceCorpus.mjs';
import { soundRefsIn } from '../../scripts/guards/lib/soundRefs.mjs';
import { SOUND_DEFS } from '../data/sons/_registry.generated';

/**
 * Garde-fou anti-son-fantôme (#321 lentille 2) : `playSfx(id: string)` (src/audio/engine.ts) est
 * une frontière NON compilée (id littéral, `byId.get(id)` absorbe silencieusement un id inconnu —
 * pas de son joué, aucune erreur). Toute réf littérale `playSfx('...')` de `src/**` (hors tests —
 * ids de fixture forgés) doit résoudre dans le registre (`src/data/sons/_registry.generated.ts`,
 * régénéré par `npm run gen`). Mécanique d'extraction : `scripts/guards/lib/soundRefs.mjs`.
 */

const IDS = new Set(SOUND_DEFS.map((d) => d.id));

describe('garde-fou anti-son-fantôme (réfs playSfx → registre de sons)', () => {
  it('toute réf `playSfx(\'...\')` de src/** résout dans le registre', () => {
    const offenders: string[] = [];
    let scanned = 0;
    for (const { rel, text } of readCorpus(['src'])) {
      for (const { id, line } of soundRefsIn(text)) {
        scanned++;
        if (!IDS.has(id)) offenders.push(`${rel}:${line} → son inconnu « ${id} »`);
      }
    }
    expect(scanned, 'la garde doit scanner AU MOINS un id — sinon elle est morte').toBeGreaterThan(0);
    expect(
      offenders,
      'Son fantôme détecté — déposer une def dans src/data/sons/defs/ puis `npm run gen`',
    ).toEqual([]);
  });
});
