/** Mendier se fait « dans les rues » (LDB 09 l.97), donc sur chaque lieu des campagnes livrées. */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { cheminsDesProjetsLivres } from '../../../scripts/guards/lib/projetsLivres.mjs';
import { activityById, activityAvailableAt } from '../../../src/engine/activities';

describe('Lieu — Mendier — campagnes livrées (LDB 09 l.97)', () => {
  it('proposable sur CHAQUE lieu des campagnes livrées (population DÉRIVÉE des projets)', () => {
    const def = activityById('mendier')!;
    const lieux = cheminsDesProjetsLivres().flatMap((rel) =>
      ((JSON.parse(readFileSync(rel, 'utf8')) as { worldMap?: { places?: { id: string }[] } }).worldMap?.places ?? []).map((p) => `${rel}/${p.id}`));
    expect(lieux.length, 'aucun lieu dérivé : la sonde ne mesurerait rien').toBeGreaterThan(0);
    expect(lieux.filter((l) => !activityAvailableAt(def, l.slice(l.lastIndexOf('/') + 1))), 'lieu(x) livré(s) où Mendier n’est pas proposable').toEqual([]);
  });
});
