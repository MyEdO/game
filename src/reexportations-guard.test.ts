/**
 * RÉEXPORTATIONS — garde absolue (#2817 D2, épique #2882).
 *
 * Un module de production qui réexporte ce qu'un autre déclare laisse lire un nom à une autre porte que
 * son module déclarant. La MESURE vit dans `scripts/guards/lib/reexportations.mjs` : `src/state/` et
 * `src/noyau/` n'en portent aucune, sans liste.
 */
import { beforeAll, describe, it, expect } from 'vitest';
import { mesure as mesurer, sitesDeReexportation, enZoneAZero } from '../scripts/guards/lib/reexportations.mjs';
import { detenteur } from './detenteur.testkit';

const mesure = detenteur(() => mesurer());

describe('réexportations : aucune dans le noyau ni dans state (#2817 D2)', () => {
  beforeAll(() => { mesure(); }, 120_000);

  it('`src/state/` et `src/noyau/` n’en portent AUCUNE', () => {
    // Sans ce témoin, une lecture cassée rendrait la garde verte en ne lisant plus rien.
    expect(mesure().lus, 'la garde ne lit plus chacune de ses zones').toEqual(expect.arrayContaining(['src/state/store.ts', 'src/noyau/cascade.ts']));
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

  it('les zones à zéro sont `src/state/` et `src/noyau/`, sans porte', () => {
    expect(['src/state/x.ts', 'src/noyau/x.ts', 'src/noyau/monde/x.ts', 'src/noyau/index.ts', 'src/data/index.ts', 'src/statex/x.ts'].map(enZoneAZero))
      .toEqual([true, true, true, true, false, false]);
  });
});
