/**
 * RÉEXPORTATIONS — garde absolue (#2817 D2, épique #2882).
 *
 * Un module de production qui réexporte ce qu'un autre déclare laisse lire un nom à une autre porte que
 * son module déclarant. La MESURE vit dans `scripts/guards/lib/reexportations.mjs` : `src/state/` et
 * `src/noyau/` n'en portent aucune, sans liste, hors de la surface du noyau (`SURFACE_DU_NOYAU`, #2817 D9).
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { mesure as mesurer, sitesDeReexportation, enZoneAZero, estRefusee } from '../scripts/guards/lib/reexportations.mjs';
import { SURFACE_DU_NOYAU } from '../scripts/guards/lib/couches.mjs';
import { detenteur } from './detenteur.testkit';

const mesure = detenteur(() => mesurer());

describe('réexportations : aucune dans le noyau ni dans state (#2817 D2)', () => {
  beforeAll(() => { mesure(); }, 120_000);

  it('`src/state/` et `src/noyau/` n’en portent AUCUNE hors de la surface du noyau', () => {
    // Sans ce témoin, une lecture cassée rendrait la garde verte en ne lisant plus rien.
    expect(mesure().lus, 'la garde ne lit plus chacune de ses zones').toEqual(expect.arrayContaining(['src/state/store.ts', 'src/noyau/cascade.ts', SURFACE_DU_NOYAU]));
    const vus = mesure().sites.map((s) => `${s.file}:${s.ligne} ${s.ref}`);
    expect(vus, `Réexportations en zone à zéro — repointer chaque importeur vers le module qui déclare :\n  ${vus.join('\n  ')}`).toEqual([]);
  });
});

describe('réexportations : la mesure, sur fixtures', () => {
  const refs = (text: string) => sitesDeReexportation([{ rel: 'src/x/m.ts', text }]).map((s) => s.ref);

  it('un site est un `export … from` ou un `export { … }` d’une liaison importée, jamais d’une déclaration locale', () => {
    const text = [
      "import { a } from './a';",
      "import * as ns from './ns';",
      "export * from './b';",
      "export * as c from './c';",
      "export { d, type E } from './d';",
      'export { a };',
      'export { ns };',
      'const locale = 1;',
      'export { locale };',
      'export const valeur = a;',
    ].join('\n');
    expect(refs(text)).toEqual([
      "export * from './b';",
      "export * as c from './c';",
      "export { d, type E } from './d';",
      'export { a };',
      'export { ns };',
    ]);
  });

  it('les zones à zéro sont `src/state/` et `src/noyau/`', () => {
    expect(['src/state/x.ts', 'src/noyau/x.ts', 'src/noyau/monde/x.ts', 'src/noyau/index.ts', 'src/data/index.ts', 'src/statex/x.ts'].map(enZoneAZero))
      .toEqual([true, true, true, true, false, false]);
  });

  it('la seule porte admise est `src/noyau/index.ts` : toute autre réexportation des zones à zéro est refusée', () => {
    expect(SURFACE_DU_NOYAU).toBe('src/noyau/index.ts');
    const rels = ['src/noyau/index.ts', 'src/noyau/x.ts', 'src/noyau/monde/index.ts', 'src/state/index.ts', 'src/data/index.ts'];
    expect(rels.map(estRefusee)).toEqual([false, true, true, true, false]);
    const sites = mesurer(rels.map((rel) => ({ rel, text: "export { a } from './a';" }))).sites.map((s) => s.file);
    expect(sites).toEqual(['src/noyau/x.ts', 'src/noyau/monde/index.ts', 'src/state/index.ts']);
  });
});
