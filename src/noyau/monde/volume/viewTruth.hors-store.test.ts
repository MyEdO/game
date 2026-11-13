/**
 * VÉRITÉ DE VUE ⟂ GÉOMÉTRIE (`viewedBuilder`, `viewTruth.ts`) : contrat déclaré, chaque entrée porte sa RÈGLE
 * (`toujours`, `jamais`, `enVue`, `horsVue`, `contexte`), l'instance VRAIE est matérialisée une fois puis conservée,
 * et le tableau précédent revient quand aucune vérité n'a bougé.
 */
import { describe, it, expect } from 'vitest';
import { viewedBuilder, type Viewed } from './viewTruth';
import { emptyScene, type Scene } from '../scene';

type El = { id: string; vrai: boolean };
const entree = (id: string, rule: Viewed<El, boolean>['rule']): Viewed<El, boolean> => ({ off: { id, vrai: false }, rule });

function builder(ctx: { valeur: boolean }) {
  let derivations = 0;
  const b = viewedBuilder<Scene, El, undefined, boolean>({
    derive: () => {
      derivations++;
      return [
        entree('toujours', { kind: 'toujours' }),
        entree('jamais', { kind: 'jamais' }),
        entree('enVue', { kind: 'enVue', keys: ['1,1,0', '2,2,0'] }),
        entree('horsVue', { kind: 'horsVue', key: '1,1,0' }),
        entree('contexte', { kind: 'contexte', truth: (c) => c }),
      ];
    },
    key: () => 'k',
    withTruth: (off) => ({ ...off, vrai: true }),
    context: () => ctx.valeur,
  });
  return { b, derivations: () => derivations };
}
const verites = (els: El[]) => Object.fromEntries(els.map((e) => [e.id, e.vrai]));

describe('viewedBuilder — règles de vue', () => {
  it('chaque règle tranche selon sa nature, la vue et le contexte', () => {
    const ctx = { valeur: true };
    const { b } = builder(ctx);
    const scene = emptyScene('vue', 4, 4);
    expect(verites(b(scene, new Set(['2,2,0'])))).toEqual({ toujours: true, jamais: false, enVue: true, horsVue: true, contexte: true });
    ctx.valeur = false;
    expect(verites(b(scene, new Set(['1,1,0'])))).toEqual({ toujours: true, jamais: false, enVue: true, horsVue: false, contexte: false });
    expect(verites(b(scene, new Set()))).toEqual({ toujours: true, jamais: false, enVue: false, horsVue: true, contexte: false });
  });

  it('sans ensemble de vue, tout est en vue', () => {
    const { b } = builder({ valeur: false });
    expect(verites(b(emptyScene('vue', 4, 4)))).toMatchObject({ enVue: true, horsVue: false });
  });

  it('géométrie dérivée une fois par scène ; tableau précédent rendu tel quel quand rien n’a bougé', () => {
    const { b, derivations } = builder({ valeur: true });
    const scene = emptyScene('vue', 4, 4);
    const a = b(scene, new Set(['2,2,0']));
    const a2 = b(scene, new Set(['2,2,0', '3,3,0']));
    expect(a2).toBe(a);
    const c = b(scene, new Set(['1,1,0']));
    expect(c).not.toBe(a);
    expect(c[0]).toBe(a[0]);
    expect(derivations()).toBe(1);
  });
});
