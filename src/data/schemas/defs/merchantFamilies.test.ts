/** Repli de `familleDeLArticle` (`FAMILLE_PAR_DEFAUT`, `src/noyau/marchandEnVue.ts`). */
import { describe, expect, it } from 'vitest';
import { validateDataset } from '../validate';
import merchantFamiliesJson from '../../merchantFamilies.json';

type Famille = { id: string; match: Record<string, unknown>; [k: string]: unknown };
const reel = (): Famille[] => structuredClone(merchantFamiliesJson) as unknown as Famille[];

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
