/**
 * Peau greffée par la tête (`coucheDEspece`, parts/career.ts) : couche espèce (#1903 D3). Un gnome, sans
 * peau déclarée, à tête de lézard rend la peau `#5d7a42` ET son ombre `#495f33` dans chaque vue.
 */
import { describe, it, expect } from 'vitest';
import { resolveRig } from './composeRig';
import { bonesToSvg } from './renderBones';
import { asRigSpeciesId, type Appearance } from './appearance';
import type { View } from './facing';

const GNOME_LEZARD: Appearance = { species: asRigSpeciesId('gnome'), sex: 'M', build: 0.5, seed: 1, monster: { tete: 'lezard' } };

describe('peau greffée par la tête', () => {
  it.each<View>(['front', 'profile', 'back'])('gnome à tête de lézard (%s) : peau #5d7a42, ombre #495f33', (view) => {
    const svg = bonesToSvg(resolveRig(GNOME_LEZARD, { weapons: [], armour: [] }, {}, 'nu', view));
    expect(svg).toContain('#5d7a42');
    expect(svg).toContain('#495f33');
  });
});
