import { describe, it, expect } from 'vitest';
import { findStructureById, findVehicleById, structures } from './index';
import { SIZE_ORDER } from '../engine/size';

/**
 * Catalogue AA « Tableau des Structures Courantes » : AA 10 l.26-53. Les lignes VÉHICULES et NAVIRES
 * FLUVIAUX (l.30-39) sont des Véhicules (`src/engine/types.ts`, `VehicleData`) : leur publication AA est
 * un `alsoIn` de l'entrée `vehicles.json` qui les héberge (#1883). « Mur de pierre » (AA 10 l.47)
 * coexiste avec « mur-en-pierre » (ADE II 8 l.282-288, #450).
 */
describe('Structures AA (AA 10 l.26-92)', () => {
  it('Mur de château : ENC N/A, Limite 150, Endurance 65 → BE 6, Blessures 100, Couvert Très Difficile', () => {
    const s = findStructureById('mur-de-chateau')!;
    expect(s.enc).toBeUndefined();
    expect(s.encLimit).toBe(150);
    expect(s.char).toEqual({ BE: 6, B: 100 });
    expect(s.couvertPenalty).toBe('tresDifficile');
    expect(s.kind).toBe('mur');
    expect(s.source).toEqual({ book: 'aux-armes', page: 120 });
  });

  it('Mur de forteresse naine : Limite 200, Endurance 80 → BE 8, Blessures 150, Couvert Très Difficile', () => {
    const s = findStructureById('mur-de-forteresse-naine')!;
    expect(s.encLimit).toBe(200);
    expect(s.char).toEqual({ BE: 8, B: 150 });
    expect(s.couvertPenalty).toBe('tresDifficile');
  });

  /** Ligne AA → entrée véhicule hôte, au folio de la ligne. AA 10 l.31-39 ; `barge-fluviale` : MSRC 07 l.176. */
  it.each([
    ['Charrette', 'charrette', 119],
    ['Chariot léger', 'chariot-leger', 119],
    ['Chariot moyen', 'chariot-moyen', 119],
    ['Chariot lourd', 'chariot-lourd', 119],
    ['Diligence', 'diligence', 120],
    ['Barge moyenne', 'barge-fluviale', 119],
    ['Bateau de patrouille', 'bateau-de-patrouille', 119],
    ['Chaloupe', 'chaloupe', 119],
  ] as const)('%s : Véhicule `%s`, publié AA folio %i, jamais une Structure', (_ligne, id, folio) => {
    expect(findVehicleById(id)?.alsoIn).toContainEqual(expect.objectContaining({ book: 'aux-armes', page: folio }));
    expect(findStructureById(id)).toBeUndefined();
  });

  it('Herse et Solide porte en bois : aucune Pénalité de Couvert (N/A dans la table)', () => {
    expect(findStructureById('herse')!.couvertPenalty).toBeUndefined();
    expect(findStructureById('solide-porte-en-bois')!.couvertPenalty).toBeUndefined();
  });

  it('Mur de pierre (AA) : Limite 100, Endurance 60 → BE 6, Blessures 50, Couvert Difficile — coexiste avec mur-en-pierre (ADE II)', () => {
    const aa = findStructureById('mur-de-pierre-aa')!;
    expect(aa.encLimit).toBe(100);
    expect(aa.char).toEqual({ BE: 6, B: 50 });
    expect(aa.couvertPenalty).toBe('difficile');
    expect(aa.kind).toBe('mur');
    expect(aa.source).toEqual({ book: 'aux-armes', page: 120 });

    const adeII = findStructureById('mur-en-pierre')!;
    expect(adeII.char).toEqual({ BE: 12, B: 40 });
    expect(adeII.source).toEqual({ book: 'archives-de-l-empire-2', page: 89 });
  });

  it("Solide porte en bois : SEULE entrée AA de kind 'porte' (Bélier applicable)", () => {
    const aa = structures.filter((s) => s.source.book === 'aux-armes');
    expect(aa.length, 'le catalogue porte des Structures AA').toBeGreaterThan(0);
    expect(aa.filter((s) => s.kind === 'porte').map((s) => s.id)).toEqual(['solide-porte-en-bois']);
  });

  /**
   * `AA 10 l.98` exige une Taille pour compter le Bonus d'Endurance d'une Structure, et le RAW la laisse
   * à déterminer (« Le MJ doit déterminer la Taille de la Structure attaquée ») : chaque entrée la porte
   * en valeur MAISON, avec sa raison. DÉRIVÉ du dataset (aucun cardinal, aucune liste re-tapée).
   */
  it('Toute Structure porte sa Taille et la RAISON maison qui la nomme (AA 10 l.98)', () => {
    const sansTaille = structures.filter((s) => !(s.taille in SIZE_ORDER));
    expect(sansTaille.map((s) => s.id)).toEqual([]);
    const sansRaison = structures.filter((s) => !s.maison?.includes('Taille maison'));
    expect(sansRaison.map((s) => s.id)).toEqual([]);
  });
});
