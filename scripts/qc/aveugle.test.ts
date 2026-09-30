import { describe, expect, it } from 'vitest';
import { type Boite, type CaseAveugle, type GrillePlanche, planche, svgDeCase, svgDeDef } from './aveugle.mjs';
import { GRILLE as GRILLE_BIPEDES, TRUTH } from '../_qc-blind.mjs';
import { ENTRIES, GRILLE as GRILLE_TOUS } from '../_qc-all-blind.mjs';

const EPS = 1e-6;
/** Une planche mesure la boîte de chaque vue par Resvg : ~0,2 s par vue. */
const DELAI_PLANCHE = 60_000;
const dedans = (b: Boite, c: Boite) =>
  b.x >= c.x - EPS && b.y >= c.y - EPS && b.x + b.l <= c.x + c.l + EPS && b.y + b.h <= c.y + c.h + EPS;

const PLANCHES: [string, CaseAveugle[], GrillePlanche][] = [
  ['_qc-blind', TRUTH, GRILLE_BIPEDES],
  ['_qc-all-blind', ENTRIES, GRILLE_TOUS],
];

describe('planches aveugles : chaque rig tient dans sa case', () => {
  for (const [nom, cases, grille] of PLANCHES) {
    it(nom, () => {
      const { poses } = planche(cases, grille);
      expect(poses).toHaveLength(cases.length * grille.vues.length);
      expect(poses.filter((p) => !dedans(p.boite, p.cadre)).map((p) => `#${p.cell} ${p.vue}`)).toEqual([]);
    }, DELAI_PLANCHE);
  }

  it('un rig qui tient garde son échelle voulue, un grand gabarit est réduit', () => {
    const tient = planche([{ id: 'squelette' }], { ...GRILLE_BIPEDES, echelle: () => 1 }).poses;
    expect(tient.map((p) => p.echelle)).toEqual([1, 1]);
    const voulue = GRILLE_BIPEDES.echelle(1);
    const deborde = planche([{ id: 'troll' }], GRILLE_BIPEDES).poses;
    expect(deborde.every((p) => p.echelle < voulue)).toBe(true);
  });
});

describe('cases par id stable : toute référence non résolue LÈVE', () => {
  it('arme nommée par libellé', () => {
    expect(() => svgDeCase({ id: 'squelette', arme: 'Lance' }, 'front', 0)).toThrow(/n'est pas une arme du catalogue/);
  });
  it('record bipède nommé par libellé', () => {
    expect(() => svgDeCase({ id: 'Squelette' }, 'front', 0)).toThrow(/ni def non bipède, ni record bipède/);
  });
  it('def non bipède nommée par libellé', () => {
    expect(() => svgDeDef('Dragon', 'profile')).toThrow(/aucune def de créature non bipède/);
    expect(svgDeDef('dragon', 'profile').sl).toBeGreaterThan(0);
  });
});
