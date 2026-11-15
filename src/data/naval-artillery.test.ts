import { describe, it, expect } from 'vitest';
import { findTrappingById, qualities } from './index';

const byId = (id: string) => findTrappingById(id);
const qIds = new Set<string>(qualities.map((q) => q.id));

describe('Artillerie navale — munitions MDG 12 (verbatim) + qualité Brise-coque', () => {
  it('8 munitions navales extraites, qualités toutes définies', () => {
    const ids = ['carreau-de-baliste', 'carreau-nain-norse', 'boulet-et-poudre', 'mitraille-et-poudre',
      'bombe-de-mortier', 'bombe-incendiaire-mortier', 'balles-et-poudre-pierrier', 'petites-munitions-et-poudre-pierrier'];
    for (const id of ids) {
      const m = byId(id);
      expect(m, id).toBeTruthy();
      expect(m?.subType?.id).toBe('munition-de-siege'); // famille d'ammo « artillerie » → chargeable par une arme de siège
      expect(m?.source.book).toBe('mer-des-griffes');
      for (const q of m?.qualities ?? []) expect(qIds.has(q.id), `${id}/${q.id}`).toBe(true);
    }
  });

  it('valeurs verbatim : prix s/d, dégâts, qualités indexées', () => {
    // Carreau nain norse 8/– → 8 silver ; Brise-coque, Empaleuse, Perforante.
    expect(byId('carreau-nain-norse')?.price).toEqual({ gold: 0, silver: 8, brass: 0 });
    expect(byId('carreau-nain-norse')?.qualities.map((q) => q.id)).toEqual(['brise-coque', 'empaleuse', 'perforante']);
    // Mitraille 6/6 → 6 silver 6 brass, dégâts −5, Tir de zone 5, portée « Quart de l'arme » (= ¼ de la
    // Portée de l'arme) — STRUCTURÉE dans `ammoRangeMod:{mult:0.25}` (sortie de `reach`, qui n'est qu'une Allonge).
    expect(byId('mitraille-et-poudre')?.price).toEqual({ gold: 0, silver: 6, brass: 6 });
    expect(byId('mitraille-et-poudre')?.damage).toEqual({ plusBF: false, flat: -5 });
    expect(byId('mitraille-et-poudre')?.qualities).toEqual([{ id: 'tir-de-zone', value: 5 }]);
    expect(byId('mitraille-et-poudre')?.reach).toBeNull();
    expect(byId('mitraille-et-poudre')?.ammoRangeMod).toEqual({ mult: 0.25 });
    // Bombe (mortier) 3 CO → 3 gold, +12, Explosion 5.
    expect(byId('bombe-de-mortier')?.price).toEqual({ gold: 3, silver: 0, brass: 0 });
    expect(byId('bombe-de-mortier')?.damage).toMatchObject({ flat: 12 });
  });

  it('Bombe incendiaire : note VERBATIM (1 +DR États En flammes)', () => {
    expect(byId('bombe-incendiaire-mortier')?.desc).toBe('Une bombe incendiaire fait subir à toutes les cibles affectées 1 +DR États En flammes.');
  });

  it('qualité Brise-coque : desc verbatim (MDG) + atout sur arme', () => {
    const bc = qualities.find((q) => q.id === 'brise-coque');
    expect(bc).toBeTruthy();
    expect(bc?.polarite).toBe('atout');
    expect(bc?.source.book).toBe('mer-des-griffes');
    expect(bc?.desc).toContain('structures en bois');
    expect(bc?.desc).toContain("gagne l'atout Dévastatrice");
  });
});
