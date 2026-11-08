/**
 * #40 — Armes de base d'Aux Armes (AA) absentes de la base : Cimeterre, Dague ballock, Massue,
 * Pique d'armes. Stats VERBATIM du « TABLEAU DES ARMES DE BASE » (folio imprimé 91). Sabre et
 * Gantelets existaient déjà. Griffes de Tigre : PAS dans AA/ZI (le ticket mal-sourçait) — en réalité
 * dans NADJ « Le mariage de Nastassia » (folio 67) ; ajoutée comme arme de Bagarre au profil de Dague.
 * Cimeterre/Dague ballock (#563 Lot 2) : l'ancre porte désormais le folio de la PROSE (90, règle 5),
 * la ligne de stats (91) vit en `alsoIn`.
 */
import { describe, it, expect } from 'vitest';
import { findTrappingById, findQualityById } from './index';

const CASES = [
  { id: 'cimeterre', label: 'Cimeterre', enc: 1, availability: 'Limitée', reach: 'Courte', flat: 4, price: { gold: 1, silver: 0, brass: 0 }, qualities: [{ id: 'taillade', value: 1 }], page: 90, alsoIn: [{ book: 'aux-armes', page: 91, quote: 'Cimeterre' }] },
  { id: 'dague-ballock', label: 'Dague ballock', enc: 0, availability: 'Limitée', reach: 'Très courte', flat: 1, price: { gold: 0, silver: 16, brass: 0 }, qualities: [{ id: 'empaleuse' }, { id: 'perforante' }, { id: 'precise' }], page: 90, alsoIn: [{ book: 'aux-armes', page: 91, quote: 'Dague ballock' }] },
  { id: 'massue', label: 'Massue', enc: 1, availability: 'Commune', reach: 'Moyenne', flat: 4, price: { gold: 0, silver: 4, brass: 0 }, qualities: [{ id: 'desequilibree' }, { id: 'inoffensive' }], page: 91, alsoIn: undefined },
  { id: 'pique-d-armes', label: "Pique d'armes", enc: 1, availability: 'Limitée', reach: 'Moyenne', flat: 4, price: { gold: 0, silver: 15, brass: 0 }, qualities: [{ id: 'desequilibree' }, { id: 'perforante' }], page: 91, alsoIn: undefined },
] as const;

describe("#40 — Armes de base AA (Aux Armes, folio 91)", () => {
  for (const c of CASES) {
    it(`${c.label} : présente, stats verbatim, source AA`, () => {
      const t = findTrappingById(c.id);
      expect(t, `trapping ${c.id} doit exister`).toBeTruthy();
      expect(t!.label).toBe(c.label);
      expect(t!.categorie).toBe('melee');
      expect(t!.subType?.id).toBe('base'); // « TABLEAU DES ARMES DE BASE » → groupe d'arme Base
      expect(t!.enc).toBe(c.enc);
      expect(t!.availability).toBe(c.availability);
      expect(t!.reach).toBe(c.reach);
      expect(t!.damage).toEqual({ plusBF: true, flat: c.flat });
      expect(t!.qualities).toEqual(c.qualities);
      expect(t!.price).toEqual(c.price);
      expect(t!.source).toEqual({ book: 'aux-armes', page: c.page });
      expect(t!.alsoIn).toEqual(c.alsoIn);
      expect(typeof t!.desc).toBe('string'); // paragraphe de saveur verbatim présent
    });
    it(`${c.label} : toutes ses Atouts/Défauts résolvent dans qualities.json`, () => {
      for (const q of c.qualities) expect(findQualityById(q.id), `qualité ${q.id}`).toBeTruthy();
    });
  }

  it('Griffes de Tigre : présente, source NADJ folio 67 (pas AA), arme de Bagarre au profil de Dague', () => {
    const t = findTrappingById('griffe-de-tigre');
    expect(t, 'griffe-de-tigre doit exister (NADJ)').toBeTruthy();
    expect(t!.categorie).toBe('melee');
    expect(t!.subType?.id).toBe('bagarre'); // « utilisation se base sur Corps à corps (Bagarre) »
    expect(t!.damage).toEqual({ plusBF: true, flat: 2 }); // « mêmes caractéristiques qu'une Dague »
    expect(t!.source).toEqual({ book: 'nuits-agitees-et-dures-journees', page: 67 });
  });
});
