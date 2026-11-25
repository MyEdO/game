import { describe, it, expect } from 'vitest';
import { catalogueDuProcessus } from './catalogueDuProcessus';
import { entreeDe } from './schemas/catalogue/catalogue';
import { datasetArray, setDataset } from './overrides';
import { idDeFixture } from './idDeFixture.testkit';

const GROUPE = 'groupe-ecrit-au-seam';
const SECOND = 'groupe-de-la-seconde-ecriture';
const groupe = (id: string) => ({ id, type: 'weaponGroups' as const, label: id, kind: 'inventory' as const, source: { book: idDeFixture('book', 'livre-de-test'), page: 1 } });

describe('catalogueDuProcessus — le fossile 1 voit le seam d’écriture', () => {
  it('une entrée posée par `setDataset` se lit dans le catalogue recomposé, puis disparaît au rétablissement', () => {
    const avant = [...datasetArray('weaponGroups')];
    const cat = catalogueDuProcessus();
    expect(entreeDe('weaponGroups', GROUPE, cat)).toBeUndefined();
    try {
      setDataset('weaponGroups', [groupe(GROUPE)]);
      const ecrit = catalogueDuProcessus();
      expect(ecrit).not.toBe(cat);
      expect(entreeDe('weaponGroups', GROUPE, ecrit)?.label).toBe(GROUPE);
    } finally {
      setDataset('weaponGroups', avant);
    }
    expect(entreeDe('weaponGroups', GROUPE, catalogueDuProcessus())).toBeUndefined();
  });

  it('deux écritures successives sous des catalogues neufs : la seconde se lit, l’index ne survit pas au catalogue', () => {
    const avant = [...datasetArray('weaponGroups')];
    try {
      setDataset('weaponGroups', [groupe(GROUPE)]);
      expect(entreeDe('weaponGroups', GROUPE, catalogueDuProcessus())?.label).toBe(GROUPE);
      setDataset('weaponGroups', [groupe(GROUPE), groupe(SECOND)]);
      expect(entreeDe('weaponGroups', SECOND, catalogueDuProcessus())?.label).toBe(SECOND);
    } finally {
      setDataset('weaponGroups', avant);
    }
  });
});
