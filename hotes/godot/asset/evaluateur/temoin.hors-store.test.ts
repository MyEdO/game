// L'identité d'un écart entre deux évaluations (#4338).
import { describe, expect, it } from 'vitest';
import type { Ecart } from './ecart.ts';
import { identiteDEcart } from './temoin.ts';

const TRAVERSEE: Ecart = {
  garde: 'traversee', code: 'couche-traversee', mesh: 'élément 3/pourpoint-avant_bras_g#0', clip: 'Chest_Open', t: 0.58, valeur: -0.0087, seuil: -0.005,
  detail: '4 sommet(s) de élément 2/chemise-avant_bras_g#0, sur 26 couverts, passent devant la couverture : écart signé le plus négatif, en m',
};
const CLE_NON_SUIVIE: Ecart = {
  garde: 'suiviDuCorps', code: 'cle-non-suivie', mesh: 'élément 1/tete_humain#1', valeur: 0.01, seuil: 0.005,
  detail: 'gabarit_head_plus : écart au corps du sommet 345, de jeu 0.0004 m, en m',
};
const AMPLITUDE: Ecart = { garde: 'amplitude', code: 'hors-bornes', clip: 'Roll', valeur: 112.4, seuil: null, detail: 'spine_01.x : 112.4° hors de [-30, 45]°' };

describe('identiteDEcart', () => {
  it('ignore les grandeurs mesurées du détail, sa valeur et son instant', () => {
    const remesure = { ...TRAVERSEE, t: 1.2, valeur: -0.02, detail: TRAVERSEE.detail.replace('4 sommet(s)', '11 sommet(s)').replace('sur 26', 'sur 31') };
    expect(identiteDEcart(remesure)).toBe(identiteDEcart(TRAVERSEE));
    expect(identiteDEcart({ ...CLE_NON_SUIVIE, detail: 'gabarit_head_plus : écart au corps du sommet 12, de jeu 0.0021 m, en m' })).toBe(identiteDEcart(CLE_NON_SUIVIE));
    expect(identiteDEcart({ ...AMPLITUDE, detail: 'spine_01.x : -61.0° hors de [-30, 45]°' })).toBe(identiteDEcart(AMPLITUDE));
  });

  it('distingue la pièce traversante, la clé et l’os que nomme le détail', () => {
    expect(identiteDEcart({ ...TRAVERSEE, detail: TRAVERSEE.detail.replace('élément 2/chemise-avant_bras_g#0', 'élément 4/chemise-avant_bras_g#0') })).not.toBe(identiteDEcart(TRAVERSEE));
    expect(identiteDEcart({ ...TRAVERSEE, detail: TRAVERSEE.detail.replace('avant_bras_g#0', 'avant_bras_g#1') })).not.toBe(identiteDEcart(TRAVERSEE));
    expect(identiteDEcart({ ...CLE_NON_SUIVIE, detail: CLE_NON_SUIVIE.detail.replace('head_plus', 'arms_plus') })).not.toBe(identiteDEcart(CLE_NON_SUIVIE));
    expect(identiteDEcart({ ...AMPLITUDE, detail: AMPLITUDE.detail.replace('spine_01', 'spine_02') })).not.toBe(identiteDEcart(AMPLITUDE));
  });

  it('distingue l’endroit qu’une valeur nomme : deux champs inconnus du manifeste en deux endroits', () => {
    const champInconnu = { garde: 'manifeste', code: 'forme', seuil: null, detail: 'champ inconnu' } as const;
    expect(identiteDEcart({ ...champInconnu, valeur: 'appuis.foo' })).not.toBe(identiteDEcart({ ...champInconnu, valeur: 'gabarit.bornes.bar' }));
    expect(identiteDEcart({ ...TRAVERSEE, valeur: -0.5 })).toBe(identiteDEcart(TRAVERSEE));
  });

  it('distingue le code, le mesh et le clip', () => {
    for (const autre of [{ code: 'couche-percee-au-repos' }, { mesh: 'élément 5/pourpoint-avant_bras_g#0' }, { clip: 'Walk_Loop' }, { clip: undefined }]) {
      expect(identiteDEcart({ ...TRAVERSEE, ...autre })).not.toBe(identiteDEcart(TRAVERSEE));
    }
  });
});
