/** Le catalogue de décor est intègre à CHAQUE échelle en usage dans les paquets livrés (#1509). */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { props } from '../../../src/data';
import { validatePropCatalog } from '../../../src/data/props.types';

describe('props.json aux échelles des paquets livrés (#1509)', () => {
  const echelles = [...new Set(cheminsDesProjetsLivres().flatMap((rel) =>
    ((JSON.parse(readFileSync(rel, 'utf8')) as { scenes?: { metresPerTile?: number }[] }).scenes ?? [])
      .flatMap((sc) => (typeof sc.metresPerTile === 'number' ? [sc.metresPerTile] : []))))].sort((a, b) => a - b);

  it('le catalogue RÉEL est intègre à chaque échelle déclarée par une scène livrée', () => {
    expect(echelles.length, 'aucune échelle déclarée : la sonde ne mesurerait rien').toBeGreaterThan(0);
    expect(echelles.flatMap((mpt) => validatePropCatalog(props, mpt))).toEqual([]);
  });
});
