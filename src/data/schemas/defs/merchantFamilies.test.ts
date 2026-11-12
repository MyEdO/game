/** `FAMILLE_PAR_DEFAUT`, `FAMILLE_DES_UNITES`, `FAMILLE_DES_BOUCLIERS`, `FAMILLE_PAR_CATEGORIE` (`src/noyau/marchandEnVue.ts`). */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import merchantFamiliesJson from '../../merchantFamilies.json';

type Famille = { id: string; match: Record<string, unknown>; [k: string]: unknown };
const reel = (): Famille[] => structuredClone(merchantFamiliesJson) as unknown as Famille[];
/** La famille `id` du document réel, clonée sous `idNeuf`. */
const cloneDe = (doc: Famille[], id: string, idNeuf: string): Famille => {
  const f = doc.find((x) => x.id === id);
  expect(f, `la famille « ${id} » manque à merchantFamilies.json`).toBeDefined();
  return { ...structuredClone(f!), id: idNeuf };
};

describe('merchantFamilies — exactement une famille de repli (`match` vide)', () => {
  it('la donnée réelle passe', () => {
    expect(validateDataset('merchantFamilies.json', reel())).toBeNull();
  });
  it('un second repli est refusé, ses porteurs nommés', () => {
    const doc = reel();
    const divers = doc.find((f) => f.id === 'divers');
    expect(divers, 'la famille de repli « divers » manque à merchantFamilies.json').toBeDefined();
    const clone = { ...structuredClone(divers!), id: 'divers-bis' };
    expect(validateDataset('merchantFamilies.json', [...doc, clone])).toContain('EXACTEMENT UNE famille de repli (`match` vide) — 2 mesurée(s) : divers, divers-bis');
  });
  it('aucun repli est refusé', () => {
    expect(validateDataset('merchantFamilies.json', reel().filter((f) => Object.keys(f.match).length > 0))).toContain('EXACTEMENT UNE famille de repli (`match` vide) — 0 mesurée(s)');
  });
});

describe('merchantFamilies — un critère de `match` ne range que dans une famille', () => {
  it('une seconde famille `unit` est refusée, ses porteurs nommés', () => {
    const doc = reel();
    expect(validateDataset('merchantFamilies.json', [...doc, cloneDe(doc, 'unites', 'unites-bis')])).toContain('AU PLUS UNE famille `match.unit` — 2 mesurées : unites, unites-bis');
  });
  it('une seconde famille `shield` est refusée, ses porteurs nommés', () => {
    const doc = reel();
    expect(validateDataset('merchantFamilies.json', [...doc, cloneDe(doc, 'boucliers', 'boucliers-bis')])).toContain('AU PLUS UNE famille `match.shield` — 2 mesurées : boucliers, boucliers-bis');
  });
  it('une seconde famille de la catégorie de « armor » est refusée, ses porteurs nommés', () => {
    const doc = reel();
    expect(validateDataset('merchantFamilies.json', [...doc, cloneDe(doc, 'armor', 'armures-bis')])).toContain('la catégorie « armor » est classée par 2 familles (armor, armures-bis)');
  });
});
